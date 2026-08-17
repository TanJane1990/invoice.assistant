import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught Error in App:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0E172B] text-white flex flex-col items-center justify-center p-6 font-sans">
          <div className="bg-white rounded-3xl p-8 max-w-md text-center shadow-2xl border border-slate-200" style={{ backgroundColor: "#ffffff" }}>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-black" style={{ backgroundColor: "#fee2e2", color: "#E8000A" }}>
              ⚠️
            </div>
            <h2 className="text-xl font-extrabold mb-2" style={{ color: "#0f172a" }}>
              应用运行遇到轻微异常
            </h2>
            <p className="text-xs mb-6 leading-relaxed" style={{ color: "#475569" }}>
              {this.state.error?.message || "页面已被捕获保护，点击下方按钮即可快速恢复运行。"}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{ backgroundColor: "#E8000A", color: "#ffffff" }}
              className="w-full py-3 hover:bg-[#C80009] text-white font-extrabold rounded-xl text-sm transition-colors cursor-pointer shadow-md"
            >
              🔄 重新载入应用
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
