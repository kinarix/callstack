import {
  EditorView,
  Decoration,
  ViewPlugin,
  hoverTooltip,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import type { KeyValue } from './types';
import { analyzeTemplates } from './template';

const unresolvedMark = Decoration.mark({ class: 'cm-template-unresolved' });

/** Marks `{{token}}` runs whose key resolves to nothing (env/secret/faker/csv) so typos
 *  and missing variables stand out in red. Faker/csv tokens count as resolved. */
export function templateDecorations(envVars: KeyValue[], secrets: KeyValue[]) {
  const build = (view: EditorView): DecorationSet => {
    const builder = new RangeSetBuilder<Decoration>();
    for (const { from, to } of view.visibleRanges) {
      const text = view.state.doc.sliceString(from, to);
      for (const m of analyzeTemplates(text, envVars, secrets)) {
        if (!m.resolved) builder.add(from + m.start, from + m.end, unresolvedMark);
      }
    }
    return builder.finish();
  };

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged) this.decorations = build(u.view);
      }
    },
    { decorations: (v) => v.decorations },
  );
}

/** Hovering a `{{token}}` shows its resolved value (secrets masked, faker/csv labeled dynamic). */
export function templateHoverTooltip(envVars: KeyValue[], secrets: KeyValue[]) {
  return hoverTooltip((view, pos) => {
    const line = view.state.doc.lineAt(pos);
    const rel = pos - line.from;
    const match = analyzeTemplates(line.text, envVars, secrets).find(
      (m) => rel >= m.start && rel <= m.end,
    );
    if (!match) return null;

    return {
      pos: line.from + match.start,
      end: line.from + match.end,
      above: true,
      create() {
        const dom = document.createElement('div');
        dom.className = `cm-template-tooltip${match.resolved ? '' : ' cm-template-tooltip-error'}`;
        dom.textContent = match.displayValue;
        return { dom };
      },
    };
  });
}
