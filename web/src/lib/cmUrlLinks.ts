import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

const URL_REGEX = /https?:\/\/[^\s<>"'`)\]}]+/g;
const TRAILING_PUNCT = /[.,;:!?)\]}'"`]+$/;

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    let m: RegExpExecArray | null;
    URL_REGEX.lastIndex = 0;
    while ((m = URL_REGEX.exec(text)) !== null) {
      let matched = m[0];
      const trail = matched.match(TRAILING_PUNCT);
      if (trail) matched = matched.slice(0, matched.length - trail[0].length);
      if (matched.length < 'http://a'.length) continue;
      const start = from + m.index;
      const end = start + matched.length;
      builder.add(
        start,
        end,
        Decoration.mark({ class: 'cm-url-link', attributes: { 'data-url': matched } }),
      );
    }
  }
  return builder.finish();
}

export interface UrlClickInfo {
  url: string;
  rect: DOMRect;
}

export function urlLinkExtension(onUrlClick: (info: UrlClickInfo) => void) {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
          this.decorations = buildDecorations(view);
        }
        update(u: ViewUpdate) {
          if (u.docChanged || u.viewportChanged) {
            this.decorations = buildDecorations(u.view);
          }
        }
      },
      { decorations: (v) => v.decorations },
    ),
    EditorView.domEventHandlers({
      mousedown(event, view) {
        const target = event.target as HTMLElement | null;
        if (!target) return false;
        const linkEl = target.closest('.cm-url-link') as HTMLElement | null;
        if (!linkEl) return false;
        const url = linkEl.getAttribute('data-url');
        if (!url) return false;
        event.preventDefault();
        event.stopPropagation();
        onUrlClick({ url, rect: linkEl.getBoundingClientRect() });
        // Bypass CodeMirror's default selection handling.
        return true;
      },
    }),
  ];
}
