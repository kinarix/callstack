import { Component, ReactNode } from 'react';

function clearUIState() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith('callstack.'))
    .forEach((k) => localStorage.removeItem(k));
  window.location.reload();
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: String(error) };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{
          background: '#1e1e2e',
          border: '1px solid #3b3b52',
          borderRadius: 10,
          padding: '24px',
          minWidth: 300,
          maxWidth: 420,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          color: '#cdd6f4',
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 600, fontSize: 14 }}>
            Something went wrong
          </p>
          <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#a6adc8', wordBreak: 'break-word' }}>
            {this.state.message}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => this.setState({ hasError: false, message: '' })}
              style={{
                background: 'transparent',
                border: '1px solid #3b3b52',
                borderRadius: 6,
                color: '#a6adc8',
                padding: '5px 14px',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
            <button
              onClick={clearUIState}
              style={{
                background: '#f59e0b',
                border: 'none',
                borderRadius: 6,
                color: '#1e1e2e',
                padding: '5px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Clear UI State &amp; Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
