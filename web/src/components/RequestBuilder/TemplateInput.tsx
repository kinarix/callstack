import { useState, useRef, useEffect } from 'react';
import type { KeyValue } from '../../lib/types';
import { FAKER_TOKENS } from '../../lib/templateTokens';
import styles from './TemplateInput.module.css';

interface TemplateInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  envVars?: KeyValue[];
  secrets?: KeyValue[];
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

interface Suggestion {
  label: string;
  type: 'env' | 'secret' | 'faker';
  detail: string;
  example?: string;
}

export function TemplateInput({
  value,
  onChange,
  placeholder = '',
  envVars = [],
  secrets = [],
  disabled = false,
  onKeyDown: onKeyDownProp,
  onBlur: onBlurProp,
}: TemplateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [caretPos, setCaretPos] = useState(0);

  // Find `{{...` pattern before cursor
  const getTemplateContext = (text: string, pos: number) => {
    const before = text.slice(0, pos);
    const match = before.match(/\{\{([^}]*)$/);
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
    setCaretPos(pos);
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
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={onBlurProp}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
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
