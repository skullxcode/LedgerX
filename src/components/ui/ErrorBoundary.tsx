import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Error in ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-surface-container-lowest border border-error/30 p-8 rounded-2xl max-w-lg w-full shadow-lg">
            <span className="material-symbols-outlined text-error text-5xl mb-4">error_outline</span>
            <h1 className="text-2xl font-bold text-on-surface mb-2">Something went wrong</h1>
            <p className="text-secondary text-sm mb-6">
              An unexpected application error occurred. Click below to refresh the workspace.
            </p>
            
            {this.state.error && (
              <div className="bg-surface-container p-4 rounded-lg text-left text-xs font-mono text-error overflow-auto max-h-40 mb-6 border border-outline-variant">
                <p className="font-bold mb-1">{this.state.error.toString()}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-[10px] text-secondary whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  localStorage.removeItem('ledgerx_active_tab');
                  window.location.hash = '';
                  window.location.reload();
                }}
                className="px-5 py-2.5 bg-primary text-on-primary font-bold rounded-lg hover:bg-primary/90 transition-colors"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
