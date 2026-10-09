import React, { useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Home, ListFilter, Plus, PieChart, MoreHorizontal } from 'lucide-react';

export const TabBar: React.FC = () => {
  const { activeTab, setActiveTab, openCatat, transactions } = useApp();

  const draftCount = transactions.filter(t => t.status === 'draft' && !t.deleted_at).length;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 flex justify-center pointer-events-none">
      <nav
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        className="w-full max-w-md bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-xl border-t border-slate-200/70 dark:border-slate-800/80 md:border-x md:border-slate-200/60 md:dark:border-slate-800/60 flex flex-col pointer-events-auto shadow-xs transition-all"
      >
        <div className="h-14 flex items-center justify-around px-2 relative">
          {/* Beranda */}
          <button
            onClick={() => setActiveTab('beranda')}
            className={`w-14 h-12 flex flex-col items-center justify-center transition-all ${
              activeTab === 'beranda'
                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <div className="relative">
              <Home className="w-5 h-5 stroke-[2.2]" />
              {draftCount > 0 && (
                <span className="absolute -top-1 -right-2 px-1.5 py-0.2 bg-amber-500 text-white text-[9px] font-bold rounded-full">
                  {draftCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 font-medium tracking-tight">Beranda</span>
          </button>

          {/* Transaksi */}
          <button
            onClick={() => setActiveTab('transaksi')}
            className={`w-14 h-12 flex flex-col items-center justify-center transition-all ${
              activeTab === 'transaksi'
                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <ListFilter className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] mt-0.5 font-medium tracking-tight">Transaksi</span>
          </button>

          {/* Center Action Button: + Catat */}
          <div className="relative -top-3 flex flex-col items-center">
            <button
              onClick={() => openCatat('manual')}
              className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-90 text-white shadow-md shadow-emerald-600/25 flex items-center justify-center transition-all ring-4 ring-white dark:ring-[#0B0F19]"
              title="Catat Transaksi Cepat"
              aria-label="Catat Transaksi"
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </button>
            <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              Catat
            </span>
          </div>

          {/* Budget */}
          <button
            onClick={() => setActiveTab('budget')}
            className={`w-14 h-12 flex flex-col items-center justify-center transition-all ${
              activeTab === 'budget'
                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <PieChart className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] mt-0.5 font-medium tracking-tight">Budget</span>
          </button>

          {/* Lainnya */}
          <button
            onClick={() => setActiveTab('lainnya')}
            className={`w-14 h-12 flex flex-col items-center justify-center transition-all ${
              activeTab === 'lainnya'
                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <MoreHorizontal className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] mt-0.5 font-medium tracking-tight">Lainnya</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
