import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// @ts-ignore
class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught Error in App:", error, errorInfo);
  }

  render() {
    // @ts-ignore
    if (this.state?.hasError) {
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
              {/* @ts-ignore */}
              {this.state?.error?.message || "页面已被捕获保护，点击下方按钮即可快速恢复运行。"}
            </p>
            <button
              onClick={() => {
                // @ts-ignore
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

    // @ts-ignore
    return this.props?.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* @ts-ignore */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
