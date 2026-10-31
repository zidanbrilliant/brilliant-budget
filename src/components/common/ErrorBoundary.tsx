import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application render:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    if (
      window.confirm(
        'PERINGATAN: Tindakan ini akan mengosongkan penyimpanan lokal aplikasi jika data mengalami kerusakan parah. Lanjutkan?'
      )
    ) {
      try {
        localStorage.clear();
      } catch {}
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-800 rounded-3xl p-6 shadow-2xl border border-slate-700/80 space-y-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-lg font-bold tracking-tight text-white">
                Terjadi Kendala Tampilan
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                Aplikasi mengalami kesalahan saat merender data. Data Anda tetap aman di perangkat.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-900/80 rounded-xl text-left border border-slate-800 overflow-x-auto">
                <p className="text-[11px] font-mono text-rose-300 break-words">
                  {this.state.error.message || String(this.state.error)}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition active:scale-98 shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Muat Ulang Aplikasi</span>
              </button>

              <button
                onClick={this.handleReset}
                className="w-full py-2.5 bg-slate-700/60 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset Penyimpanan Rusak</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
