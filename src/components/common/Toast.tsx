import React from 'react';
import { useApp } from '../../context/AppContext';
import { RotateCcw, X } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toast, clearToast, settings } = useApp();

  if (!toast) return null;
  const isPinkTheme = settings.theme === 'pink';

  return (
    <div className="fixed bottom-safe-toast left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm animate-scale-up pointer-events-auto">
      <div className={`${isPinkTheme ? 'bg-[#37131D]/95 border-pink-500/40' : 'bg-[#0F172A]/95 dark:bg-[#1E293B]/95 border-slate-700/50'} backdrop-blur-md text-white px-3.5 py-2.5 rounded-xl shadow-lg flex items-center justify-between border`}>
        <span className="text-xs font-medium leading-snug truncate pr-2">{toast.message}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {toast.undo && (
            <button
              onClick={() => {
                toast.undo?.();
                clearToast();
              }}
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 transition ${
                isPinkTheme ? 'bg-pink-500/30 text-pink-200 hover:bg-pink-500/40' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              <span>Urungkan</span>
            </button>
          )}
          <button
            onClick={clearToast}
            className="p-1 text-slate-400 hover:text-white rounded-md transition"
            aria-label="Tutup"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
