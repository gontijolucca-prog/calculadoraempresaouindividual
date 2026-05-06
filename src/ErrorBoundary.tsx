import React, { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

// Class component is required by React for componentDidCatch / getDerivedStateFromError.
// The tsconfig uses `useDefineForClassFields: false`, so explicit `declare` is needed
// for `props`/`state` to satisfy the type checker.
export default class ErrorBoundary extends Component<Props, State> {
  declare props: Readonly<Props>;
  declare state: Readonly<State>;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App crashed:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6"
      >
        <div className="bg-white rounded-[24px] p-8 md:p-10 shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-50 border-4 border-red-100 flex items-center justify-center mb-5">
            <AlertTriangle className="w-8 h-8 text-red-500" aria-hidden="true" />
          </div>
          <h1 className="text-[22px] font-[800] text-[#0F172A] leading-tight">
            Ocorreu um erro inesperado
          </h1>
          <p className="text-[14px] text-[#64748B] mt-3 font-[500] leading-relaxed">
            Algo correu mal e a aplicação não conseguiu continuar. Tente recarregar a
            página. Se o problema persistir, contacte o suporte.
          </p>
          {this.state.error?.message && (
            <pre className="mt-4 text-left bg-[#F1F5F9] rounded-[10px] p-3 text-[11px] font-mono text-[#475569] overflow-auto max-h-32">
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-[#781D1D] text-white py-3 rounded-[10px] text-[14px] font-[700] hover:bg-[#5A1313] active:scale-[0.98] transition-all shadow-md shadow-[#781D1D]/20"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
