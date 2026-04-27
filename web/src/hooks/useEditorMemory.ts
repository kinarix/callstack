import { useCallback, useEffect, useMemo, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { forceParsing } from '@codemirror/language';

interface EditorPosition {
  anchor: number;
  head: number;
  topLine: number;
  scrollLeft: number;
}

const cache = new Map<string, EditorPosition>();

export function useEditorMemory(memoryKey: string | undefined) {
  const viewRef = useRef<EditorView | null>(null);
  const keyRef = useRef(memoryKey);
  keyRef.current = memoryKey;

  const save = useCallback(() => {
    const view = viewRef.current;
    const k = keyRef.current;
    if (!view || !k) return;
    const sel = view.state.selection.main;
    let topLine = 1;
    try {
      const block = view.lineBlockAtHeight(view.scrollDOM.scrollTop);
      topLine = view.state.doc.lineAt(block.from).number;
    } catch {
      // ignore
    }
    cache.set(k, {
      anchor: sel.anchor,
      head: sel.head,
      topLine,
      scrollLeft: view.scrollDOM.scrollLeft,
    });
  }, []);

  const memoryExtension = useMemo(
    () => EditorView.updateListener.of((u) => {
      if (u.selectionSet) save();
    }),
    [save],
  );

  const onCreateEditor = useCallback((view: EditorView) => {
    viewRef.current = view;
    view.scrollDOM.addEventListener('scroll', save, { passive: true });
    const k = keyRef.current;
    const saved = k ? cache.get(k) : undefined;
    if (saved) {
      const len = view.state.doc.length;
      const anchor = Math.min(Math.max(0, saved.anchor), len);
      const head = Math.min(Math.max(0, saved.head), len);
      const totalLines = view.state.doc.lines;
      const lineNum = Math.min(Math.max(1, saved.topLine), totalLines);
      const linePos = view.state.doc.line(lineNum).from;
      // Force the parser to advance past the destination so syntax highlighting
      // is ready in the viewport on the same frame as the scroll.
      const parseUpTo = Math.min(view.state.doc.length, linePos + 50_000);
      try {
        forceParsing(view, parseUpTo, 250);
      } catch {
        // ignore
      }
      try {
        view.dispatch({
          selection: { anchor, head },
          effects: EditorView.scrollIntoView(linePos, { y: 'start' }),
        });
      } catch {
        try {
          view.dispatch({
            effects: EditorView.scrollIntoView(linePos, { y: 'start' }),
          });
        } catch {
          // ignore
        }
      }
      if (saved.scrollLeft) {
        requestAnimationFrame(() => {
          view.scrollDOM.scrollLeft = saved.scrollLeft;
        });
      }
    }
  }, [save]);

  useEffect(() => () => { save(); }, [save]);

  return { memoryExtension, onCreateEditor };
}
