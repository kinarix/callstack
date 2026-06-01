import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import type { KeyValue } from '../../lib/types';
import { FAKER_TOKENS } from '../../lib/templateTokens';
import { analyzeTemplates, type TemplateMatch, type TokenKind } from '../../lib/template';
import { TokenTooltip, tooltipFromRect, type TooltipState } from './templateTooltip';
import styles from './TemplateInput.module.css';

interface TemplateInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  envVars?: KeyValue[];
  secrets?: KeyValue[];
  disabled?: boolean;
  autoFocus?: boolean;
  selectOnFocus?: boolean;
  showTitle?: boolean;
  /** Range within `value` to mark with a wavy error underline (e.g. an invalid URL segment). */
  errorRange?: { start: number; end: number } | null;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

interface Suggestion {
  label: string;
  type: 'env' | 'secret' | 'faker';
  detail: string;
  example?: string;
}

/** One rendered run of the overlay: a slice of text, optionally part of a token and/or the error range. */
interface Segment {
  text: string;
  kind?: TokenKind;
  matchIndex?: number;
  isError: boolean;
}

function buildSegments(
  text: string,
  matches: TemplateMatch[],
  err: { start: number; end: number } | null | undefined,
): Segment[] {
  const clampedErr =
    err && err.start < err.end
      ? { start: Math.max(0, Math.min(text.length, err.start)), end: Math.max(0, Math.min(text.length, err.end)) }
      : null;

  const points = new Set<number>([0, text.length]);
  matches.forEach((m) => { points.add(m.start); points.add(m.end); });
  if (clampedErr) { points.add(clampedErr.start); points.add(clampedErr.end); }

  const sorted = [...points].filter((p) => p >= 0 && p <= text.length).sort((a, b) => a - b);
  const segs: Segment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (a >= b) continue;
    const matchIndex = matches.findIndex((m) => m.start <= a && m.end >= b);
    const match = matchIndex >= 0 ? matches[matchIndex] : undefined;
    const isError = !!clampedErr && clampedErr.start <= a && clampedErr.end >= b;
    segs.push({ text: text.slice(a, b), kind: match?.kind, matchIndex: match ? matchIndex : undefined, isError });
  }
  return segs;
}

/** Mirror the input's box metrics onto the overlay so the colored text lines up exactly. */
interface OverlayMetrics {
  padding: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  letterSpacing: string;
  lineHeight: string;
}

export function TemplateInput({
  value,
  onChange,
  placeholder = '',
  envVars = [],
  secrets = [],
  disabled = false,
  autoFocus = false,
  selectOnFocus = false,
  showTitle = false,
  errorRange = null,
  onKeyDown: onKeyDownProp,
  onBlur: onBlurProp,
  onFocus: onFocusProp,
}: TemplateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [metrics, setMetrics] = useState<OverlayMetrics | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const matches = useMemo(() => analyzeTemplates(value, envVars, secrets), [value, envVars, secrets]);
  const segments = useMemo(() => buildSegments(value, matches, errorRange), [value, matches, errorRange]);
  const hasOverlay = matches.length > 0 || (errorRange != null && errorRange.start < errorRange.end);

  // Mirror the input's effective padding/font onto the overlay. Padding is set by the parent
  // context (the URL bar adds a 130px right pad; KeyValueEditor differs), so read it live.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const measure = () => {
      const cs = getComputedStyle(input);
      const sum = (p: string, b: string) => `${(parseFloat(cs.getPropertyValue(p)) || 0) + (parseFloat(cs.getPropertyValue(b)) || 0)}px`;
      setMetrics({
        padding: [
          sum('padding-top', 'border-top-width'),
          sum('padding-right', 'border-right-width'),
          sum('padding-bottom', 'border-bottom-width'),
          sum('padding-left', 'border-left-width'),
        ].join(' '),
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        fontStyle: cs.fontStyle,
        letterSpacing: cs.letterSpacing,
        lineHeight: cs.lineHeight,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(input);
    return () => ro.disconnect();
  }, []);

  // Keep the overlay's horizontal scroll in lockstep with the input.
  const syncScroll = () => {
    if (overlayRef.current && inputRef.current) {
      overlayRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  };
  useLayoutEffect(syncScroll, [value, segments]);

  // Find `{{...` pattern before cursor
  const getTemplateContext = (text: string, pos: number) => {
    const before = text.slice(0, pos);
    const match = before.slice(-200).match(/\{\{([^}]*)$/);
    if (!match) return null;
    return {
      start: before.lastIndexOf('{{'),
      partial: match[1],
    };
  };

  const updateSuggestions = (text: string, pos: number) => {
    const ctx = getTemplateContext(text, pos);
    if (!ctx) {
      setShowDropdown(false);
      return;
    }

    const activeEnv = envVars.filter((v) => v.enabled !== false && v.key);
    const envOptions: Suggestion[] = activeEnv.map((v) => ({
      label: v.key,
      type: 'env',
      detail: 'environment variable',
    }));

    const activeSecrets = secrets.filter((s) => s.enabled !== false && s.key);
    const secretOptions: Suggestion[] = activeSecrets.map((s) => ({
      label: s.key,
      type: 'secret',
      detail: 'secret',
    }));

    const fakerOptions: Suggestion[] = FAKER_TOKENS.map((t) => ({
      label: t.name,
      type: 'faker',
      detail: t.detail,
      example: t.example,
    }));

    const all = [...envOptions, ...secretOptions, ...fakerOptions];
    const filtered = all.filter((s) => s.label.toLowerCase().includes(ctx.partial.toLowerCase()));

    setSuggestions(filtered);
    setSelectedIndex(0);
    setShowDropdown(filtered.length > 0);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    const pos = e.currentTarget.selectionStart ?? 0;
    updateSuggestions(newValue, pos);
  };

  const insertSuggestion = (label: string) => {
    if (!inputRef.current) return;

    const pos = inputRef.current.selectionStart ?? 0;
    const text = value;
    const ctx = getTemplateContext(text, pos);

    if (!ctx) return;

    const before = text.slice(0, ctx.start);
    const after = text.slice(pos);
    const newValue = `${before}{{${label}}}${after}`;

    onChange(newValue);
    setShowDropdown(false);

    // Move cursor after the inserted token
    setTimeout(() => {
      if (inputRef.current) {
        const newPos = before.length + `{{${label}}}`.length;
        inputRef.current.setSelectionRange(newPos, newPos);
        inputRef.current.focus();
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle template dropdown navigation if open
    if (showDropdown && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % suggestions.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        insertSuggestion(suggestions[selectedIndex].label);
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
        return;
      } else if (e.key === 'Tab') {
        // Allow Tab to insert suggestion and move to next field
        const ctx = getTemplateContext(value, inputRef.current?.selectionStart ?? 0);
        if (ctx && ctx.partial) {
          e.preventDefault();
          insertSuggestion(suggestions[selectedIndex].label);
          return;
        }
      }
    }

    // Call the parent's onKeyDown handler for other keys (e.g. Enter to send)
    if (onKeyDownProp) {
      onKeyDownProp(e);
    }
  };

  // Hit-test the pointer against the laid-out token spans. The overlay is pointer-events:none,
  // so native editing is untouched; we read live rects to position a tooltip.
  const handleMouseMove = (e: React.MouseEvent<HTMLInputElement>) => {
    const overlay = overlayRef.current;
    if (!overlay) { if (tooltip) setTooltip(null); return; }
    const { clientX } = e;
    const spans = overlay.querySelectorAll<HTMLElement>('[data-tok]');
    for (const span of spans) {
      const r = span.getBoundingClientRect();
      // Single-line input: match on the horizontal span only so the hit area is forgiving.
      if (clientX >= r.left && clientX <= r.right) {
        const idx = Number(span.dataset.tok);
        const match = matches[idx];
        if (match) {
          setTooltip(tooltipFromRect(r, match.displayValue, !match.resolved));
          return;
        }
      }
    }
    if (tooltip) setTooltip(null);
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
      setShowDropdown(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={styles.wrapper}>
      {hasOverlay && metrics && (
        <div
          ref={overlayRef}
          className={styles.overlay}
          aria-hidden
          style={{
            padding: metrics.padding,
            fontFamily: metrics.fontFamily,
            fontSize: metrics.fontSize,
            fontWeight: metrics.fontWeight,
            fontStyle: metrics.fontStyle,
            letterSpacing: metrics.letterSpacing,
            lineHeight: metrics.lineHeight,
          }}
        >
          {segments.map((seg, i) => {
            const cls = [
              seg.kind ? styles.token : '',
              seg.kind === 'unresolved' ? styles.unresolved : '',
              seg.isError ? styles.errorSpan : '',
            ].filter(Boolean).join(' ');
            return (
              <span
                key={i}
                className={cls || undefined}
                data-tok={seg.matchIndex != null ? seg.matchIndex : undefined}
              >
                {seg.text}
              </span>
            );
          })}
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        className={`${styles.input} ${hasOverlay ? styles.inputOverlaid : ''}`}
        value={value}
        title={showTitle && !tooltip ? value || undefined : undefined}
        onChange={handleChange}
        onScroll={syncScroll}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        onKeyDown={handleKeyDown}
        onBlur={onBlurProp}
        onFocus={(e) => {
          if (selectOnFocus) {
            const el = e.currentTarget;
            setTimeout(() => el.select(), 0);
          }
          onFocusProp?.(e);
        }}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      <TokenTooltip tooltip={tooltip} />
      {showDropdown && suggestions.length > 0 && (
        <div className={styles.dropdown}>
          {suggestions.map((s, i) => (
            <div
              key={`${s.type}-${s.label}`}
              className={`${styles.option} ${i === selectedIndex ? styles.selected : ''}`}
              onClick={() => insertSuggestion(s.label)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <div className={styles.label}>{s.label}</div>
              <div className={styles.detail}>{s.detail}</div>
              {s.example && <div className={styles.example}>{s.example}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
