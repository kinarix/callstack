import { useState } from 'react';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import styles from './ScriptEditor.module.css';

import { EXAMPLES, CATEGORIES } from '../../data/scriptExamples';
import type { Example } from '../../data/scriptExamples';

const DOCS_BASE = 'https://velocity.kinarix.com/docs/scripting-examples.html';

function openDocs(id?: string) {
  const url = id ? `${DOCS_BASE}#${encodeURIComponent(id)}` : DOCS_BASE;
  // Use Tauri's shell plugin so the link opens in the user's default browser
  // instead of being blocked by the webview. Falls back to window.open in
  // non-Tauri contexts (e.g. `make web-dev`).
  openExternal(url).catch(() => {
    window.open(url, '_blank', 'noopener,noreferrer');
  });
}

interface ExampleRowProps {
  example: Example;
  onCopy: (code: string, target: 'pre' | 'post') => void;
}

function ExampleRow({ example, onCopy }: ExampleRowProps) {
  const [copied, setCopied] = useState<'pre' | 'post' | null>(null);

  const handleCopy = (target: 'pre' | 'post') => {
    if (example.target !== 'both' && example.target !== target) return;
    navigator.clipboard.writeText(example.code).then(() => {
      onCopy(example.code, target);
      setCopied(target);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const targetClass = example.target === 'pre'
    ? styles.targetPillPre
    : example.target === 'post' ? styles.targetPillPost : styles.targetPillBoth;

  return (
    <div className={styles.exampleRow}>
      <span className={`${styles.targetPill} ${targetClass}`}>
        {example.target === 'both' ? 'pre · post' : example.target}
      </span>
      <button
        type="button"
        className={styles.exampleRowLink}
        onClick={() => openDocs(example.id)}
        title="Open in docs"
      >
        <span className={styles.exampleRowTitle}>{example.title}</span>
        <span className={styles.exampleRowDesc}>{example.description}</span>
      </button>
      <div className={styles.exampleRowActions}>
        {(example.target === 'pre' || example.target === 'both') && (
          <button
            className={`${styles.exampleRowBtn} ${copied === 'pre' ? styles.copied : ''}`}
            onClick={() => handleCopy('pre')}
            title="Insert into Pre-request script"
          >
            {copied === 'pre' ? '✓ Pre' : '+ Pre'}
          </button>
        )}
        {(example.target === 'post' || example.target === 'both') && (
          <button
            className={`${styles.exampleRowBtn} ${copied === 'post' ? styles.copied : ''}`}
            onClick={() => handleCopy('post')}
            title="Insert into Post-request script"
          >
            {copied === 'post' ? '✓ Post' : '+ Post'}
          </button>
        )}
        <button
          className={styles.exampleRowExt}
          onClick={() => openDocs(example.id)}
          title="Open full example in docs"
          aria-label="Open in docs"
        >
          ↗
        </button>
      </div>
    </div>
  );
}

interface ScriptExamplesProps {
  onCopy: (code: string, target: 'pre' | 'post') => void;
}

export function ScriptExamples({ onCopy }: ScriptExamplesProps) {
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0]);

  const filtered = EXAMPLES.filter(ex => ex.category === activeCategory);

  return (
    <div className={styles.examplesRoot}>
      <div className={styles.examplesIntro}>
        Click a title to read the full example with code in the docs (
        <a href="#" onClick={(e) => { e.preventDefault(); openDocs(); }}>open all</a>
        ), or use the + buttons to drop the snippet straight into this script.
      </div>
      <div className={styles.examplesNav}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`${styles.examplesPill} ${activeCategory === cat ? styles.examplesPillActive : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className={styles.examplesBody}>
        {filtered.map(example => (
          <ExampleRow key={example.id} example={example} onCopy={onCopy} />
        ))}
      </div>
    </div>
  );
}
