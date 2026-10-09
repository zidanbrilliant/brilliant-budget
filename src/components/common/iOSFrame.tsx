import React from 'react';
import { useApp } from '../../context/AppContext';
import { Moon, Sun, Lock, Heart, Sparkles } from 'lucide-react';

interface IOSFrameProps {
  children: React.ReactNode;
}

export const IOSFrame: React.FC<IOSFrameProps> = ({ children }) => {
  const { settings, updateSettings, setIsLocked, isBackendConnected } = useApp();

  const cycleTheme = () => {
    if (settings.theme === 'pink') {
      updateSettings({ theme: 'light' });
    } else if (settings.theme === 'light') {
      updateSettings({ theme: 'dark' });
    } else {
      updateSettings({ theme: 'pink' });
    }
  };

  const isPinkTheme = settings.theme === 'pink';

  return (
    <div className={`min-h-screen ${isPinkTheme ? 'bg-[#FFF0F3]' : 'bg-slate-50 dark:bg-[#060910]'} text-slate-900 dark:text-slate-100 flex justify-center antialiased transition-colors duration-200`}>
      {/* Centered Mobile-First App Container */}
      <div className={`w-full max-w-md min-h-screen ${isPinkTheme ? 'bg-[#FFF5F7] text-[#37131D]' : 'bg-white dark:bg-[#0B0F19]'} border-x border-pink-100/80 dark:border-slate-800/60 flex flex-col relative shadow-xs`}>
        {/* Clean Application Top Bar with Safe Area Clearance */}
        <header className={`sticky top-0 z-30 ${isPinkTheme ? 'bg-[#FFF5F7]/95 border-pink-100' : 'bg-white/95 dark:bg-[#0B0F19]/95 border-slate-100 dark:border-slate-800/80'} backdrop-blur-md px-4 pb-2.5 pt-safe-top flex items-center justify-between border-b transition-all`}>
          <div className="flex items-center gap-2">
            <span className={`font-extrabold text-base tracking-tight flex items-center gap-1.5 ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
              <span>Brilliant Budget</span>
              {isPinkTheme && <Sparkles className="w-3.5 h-3.5 text-pink-500 fill-pink-400" />}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${isPinkTheme ? 'bg-pink-100/80 text-pink-700 border border-pink-200' : 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isPinkTheme ? 'bg-pink-500' : 'bg-emerald-500'} animate-pulse`}></span>
              {isBackendConnected ? 'Offline SQLite' : 'On-Device'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Lock App */}
            <button
              onClick={() => setIsLocked(true)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition active:scale-95 ${isPinkTheme ? 'text-pink-600 hover:bg-pink-100/60' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              title="Kunci Aplikasi"
              aria-label="Kunci Aplikasi"
            >
              <Lock className="w-4 h-4" />
            </button>

            {/* 3-Mode Theme Cycler: Pink Cute -> Light -> Dark */}
            <button
              onClick={cycleTheme}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition active:scale-95 ${isPinkTheme ? 'text-pink-600 hover:bg-pink-100/60' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              title={`Ganti Tema (Aktif: ${settings.theme === 'pink' ? 'Soft Pink Cute' : settings.theme === 'light' ? 'Minimalist Light' : 'Midnight Dark'})`}
              aria-label="Ganti Tema"
            >
              {settings.theme === 'pink' ? (
                <Heart className="w-4 h-4 text-pink-500 fill-pink-400" />
              ) : settings.theme === 'light' ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>
        </header>

        {/* Main Content Area with Bottom Clearance for TabBar */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col pb-tabbar-clearance">
          {children}
        </main>
      </div>
    </div>
  );
};
