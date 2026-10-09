import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Moon, Sun, Lock, Layers } from 'lucide-react';
import { WidgetPreviewModal } from './WidgetPreviewModal';

interface IOSFrameProps {
  children: React.ReactNode;
}

export const IOSFrame: React.FC<IOSFrameProps> = ({ children }) => {
  const { settings, updateSettings, setIsLocked, isBackendConnected } = useApp();
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060910] text-slate-900 dark:text-slate-100 flex justify-center antialiased">
      {/* Centered Mobile-First App Container */}
      <div className="w-full max-w-md min-h-screen bg-white dark:bg-[#0B0F19] border-x border-slate-200/60 dark:border-slate-800/60 flex flex-col relative shadow-xs">
        {/* Clean Application Top Bar with Safe Area Clearance */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-md px-4 pb-2.5 pt-safe-top flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 transition-all">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
              Brilliant Budget
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {isBackendConnected ? 'Offline SQLite' : 'On-Device'}
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            {/* Widget Simulator */}
            <button
              onClick={() => setIsWidgetModalOpen(true)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
              title="Widget iOS (PRD 7.4)"
              aria-label="Simulasi Widget"
            >
              <Layers className="w-4 h-4" />
            </button>

            {/* Lock App */}
            <button
              onClick={() => setIsLocked(true)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
              title="Kunci Aplikasi"
              aria-label="Kunci Aplikasi"
            >
              <Lock className="w-4 h-4" />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() =>
                updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
              }
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
              title="Ganti Tema"
              aria-label="Ganti Tema"
            >
              {settings.theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>
          </div>
        </header>

        {/* Main Content Area with Bottom Clearance for TabBar */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col pb-tabbar-clearance">
          {children}
        </main>
      </div>

      {/* Widget Preview Modal */}
      <WidgetPreviewModal
        isOpen={isWidgetModalOpen}
        onClose={() => setIsWidgetModalOpen(false)}
      />
    </div>
  );
};
