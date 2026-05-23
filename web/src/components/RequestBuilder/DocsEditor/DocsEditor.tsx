import { useMemo } from 'react';
import type { DocumentationFields, KeyValue, Request, Response as AppResponse } from '../../../lib/types';
import { generateOperation } from '../../../lib/openapi/generate';
import { toYAML } from '../../../lib/openapi/stringify';
import DocsEditorForm from './DocsEditorForm';
import DocsEditorPreview from './DocsEditorPreview';
import styles from './DocsEditor.module.css';

interface Props {
  request: Request;
  response: AppResponse | null;
  docs: DocumentationFields;
  envVars?: KeyValue[];
  onChange: (next: DocumentationFields) => void;
}

export default function DocsEditor({ request, response, docs, envVars, onChange }: Props) {
  const responseForDoc = response && response.request_id === request.id ? response : null;

  const autoYaml = useMemo(() => {
    const op = generateOperation(request, responseForDoc, docs, envVars || []);
    try {
      return toYAML(op);
    } catch (e) {
      return `# Failed to render YAML: ${(e as Error).message}`;
    }
  }, [request, responseForDoc, docs, envVars]);

  const hasOverride = typeof docs.yamlOverride === 'string' && docs.yamlOverride.length > 0;
  const yamlText = hasOverride ? (docs.yamlOverride as string) : autoYaml;

  const handleYamlChange = (next: string) => {
    if (next === autoYaml) {
      const { yamlOverride: _drop, ...rest } = docs;
      void _drop;
      onChange(rest);
    } else {
      onChange({ ...docs, yamlOverride: next });
    }
  };

  const handleReset = () => {
    const { yamlOverride: _drop, ...rest } = docs;
    void _drop;
    onChange(rest);
  };

  return (
    <div className={styles.docsRoot}>
      <div className={styles.docsSplit}>
        <div className={styles.docsForm}>
          <DocsEditorForm value={docs} request={request} response={responseForDoc} envVars={envVars} onChange={onChange} />
        </div>
        <DocsEditorPreview
          yamlText={yamlText}
          filenameStem={request.name || 'operation'}
          edited={hasOverride}
          onChange={handleYamlChange}
          onReset={handleReset}
        />
      </div>
    </div>
  );
}
