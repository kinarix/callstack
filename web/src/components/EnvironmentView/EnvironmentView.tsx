import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useDatabase } from '../../hooks/useDatabase';
import { KeyValueEditor } from '../RequestBuilder/KeyValueEditor';
import { loadSecrets, saveSecrets } from '../../lib/secrets';
import type { KeyValue } from '../../lib/types';
import modalStyles from '../EnvModal/EnvModal.module.css';
import styles from './EnvironmentView.module.css';

interface Props {
  environmentId: number;
  showExpandBtn?: boolean;
  onExpand?: () => void;
}

function SecretRow({
  secret,
  onChangeKey,
  onChangeValue,
  onDelete,
}: {
  secret: KeyValue;
  onChangeKey: (key: string) => void;
  onChangeValue: (value: string) => void;
  onDelete: () => void;
}) {
  const [revealing, setRevealing] = useState(false);
  return (
    <div className={modalStyles.secretRow}>
      <span className={modalStyles.secretLock} aria-label="secret">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
          <rect x="2" y="5" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M3.5 5V3.5a2 2 0 1 1 4 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </span>
      <input
        className={modalStyles.secretKeyInput}
        value={secret.key}
        placeholder="key"
        onChange={(e) => onChangeKey(e.target.value)}
      />
      <span className={modalStyles.secretEq}>=</span>
      <input
        className={modalStyles.secretValueInput}
        type={revealing ? 'text' : 'password'}
        value={secret.value}
        placeholder="value"
        onChange={(e) => onChangeValue(e.target.value)}
      />
      <button
        className={`${modalStyles.eyeBtn} ${revealing ? modalStyles.eyeBtnActive : ''}`}
        onMouseDown={() => setRevealing(true)}
        onMouseUp={() => setRevealing(false)}
        onMouseLeave={() => setRevealing(false)}
        onTouchStart={() => setRevealing(true)}
        onTouchEnd={() => setRevealing(false)}
        title="Hold to reveal"
        type="button"
        aria-label="Hold to reveal secret"
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
          {revealing ? (
            <>
              <ellipse cx="6.5" cy="6.5" rx="4.5" ry="3" stroke="currentColor" strokeWidth="1.2"/>
              <circle cx="6.5" cy="6.5" r="1.5" fill="currentColor"/>
            </>
          ) : (
            <>
              <ellipse cx="6.5" cy="6.5" rx="4.5" ry="3" stroke="currentColor" strokeWidth="1.2"/>
              <circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="2" y1="10.5" x2="11" y2="2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </>
          )}
        </svg>
      </button>
      <button className={modalStyles.secretDeleteBtn} onClick={onDelete} title="Remove secret" type="button">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

export default function EnvironmentView({ environmentId, showExpandBtn, onExpand }: Props) {
  const { state, dispatch } = useApp();
  const { updateEnvironment } = useDatabase();
  const env = useMemo(
    () => state.environments.find((e) => e.id === environmentId) ?? null,
    [state.environments, environmentId]
  );

  const [name, setName] = useState(env?.name ?? '');
  const [variables, setVariables] = useState<KeyValue[]>(env?.variables ?? []);
  const [secrets, setSecrets] = useState<KeyValue[]>(() =>
    env ? loadSecrets(env.id) : []
  );
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  // Load fresh state when switching envs
  useEffect(() => {
    if (!env) return;
    setName(env.name);
    setVariables(env.variables);
    setSecrets(loadSecrets(env.id));
  }, [env?.id]);

  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingName]);

  // Debounced autosave of name + variables to DB
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!env) return;
    const trimmed = name.trim() || env.name;
    const nameChanged = trimmed !== env.name;
    const varsChanged = JSON.stringify(variables) !== JSON.stringify(env.variables);
    if (!nameChanged && !varsChanged) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const updated = await updateEnvironment(env.id, trimmed, variables);
      dispatch({ type: 'UPDATE_ENVIRONMENT', payload: updated });
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [name, variables, env?.id]);

  // Persist secrets to localStorage as user types (filter empty keys)
  useEffect(() => {
    if (!env) return;
    saveSecrets(env.id, secrets.filter((s) => s.key));
  }, [secrets, env?.id]);

  if (!env) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>Environment not found.</div>
      </div>
    );
  }

  const handleNameCommit = () => {
    setEditingName(false);
    if (!name.trim()) setName(env.name);
  };

  const addSecret = () =>
    setSecrets((prev) => [...prev, { key: '', value: '', enabled: true }]);
  const updateSecretKey = (i: number, key: string) =>
    setSecrets((prev) => prev.map((s, idx) => (idx === i ? { ...s, key } : s)));
  const updateSecretValue = (i: number, value: string) =>
    setSecrets((prev) => prev.map((s, idx) => (idx === i ? { ...s, value } : s)));
  const deleteSecret = (i: number) =>
    setSecrets((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        {showExpandBtn && (
          <button className={styles.expandBtn} onClick={onExpand} title="Show navigator">
            ›
          </button>
        )}
        <div className={styles.nameWrapper}>
          {editingName ? (
            <input
              ref={nameInputRef}
              className={styles.nameInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameCommit();
                if (e.key === 'Escape') {
                  setName(env.name);
                  setEditingName(false);
                }
              }}
            />
          ) : (
            <button
              className={styles.nameBtn}
              onClick={() => setEditingName(true)}
              title="Rename"
            >
              {name}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className={styles.body}>
        <div>
          <div className={modalStyles.variablesSectionHeader}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
              <rect x="1" y="1" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M3 5.5h5M3 3.5h3M3 7.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Variables
          </div>
          <KeyValueEditor items={variables} onChange={setVariables} />
        </div>

        <div className={modalStyles.secretsSection}>
          <div className={modalStyles.secretsSectionHeader}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
              <rect x="2" y="5" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M3.5 5V3.5a2 2 0 1 1 4 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Secrets
            <span className={modalStyles.secretsHint}>local only · never exported</span>
          </div>
          <div className={modalStyles.secretsList}>
            {secrets.map((s, i) => (
              <SecretRow
                key={i}
                secret={s}
                onChangeKey={(key) => updateSecretKey(i, key)}
                onChangeValue={(value) => updateSecretValue(i, value)}
                onDelete={() => deleteSecret(i)}
              />
            ))}
            <button className={modalStyles.addSecretBtn} onClick={addSecret} type="button">
              + Add Secret
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
