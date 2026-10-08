import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatCompactIDR } from '../../utils/formatters';
import {
  X,
  Plus,
  Mic,
  Smartphone,
  Lock,
} from 'lucide-react';

interface WidgetPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WidgetPreviewModal: React.FC<WidgetPreviewModalProps> = ({ isOpen, onClose }) => {
  const { openCatat, getMonthSummary, budget } = useApp();

  if (!isOpen) return null;

  const summary = getMonthSummary();
  const remainingBudget = Math.max(0, budget.total_limit - summary.expense);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#111827] text-white rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-800 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm">Pintasan Cepat iOS</h3>
              <p className="text-[11px] text-slate-400">Simulasi Home Screen Widget (PRD 7.4)</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. iOS Home Screen Widget Small (2x2) */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            1. Widget Home Screen (2x2) — Jalur Cepat ≤ 5 Detik
          </span>
          <div className="bg-[#151E2E] rounded-xl p-3.5 border border-slate-700/80 shadow-xs space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Sisa Budget</span>
                <div className="text-base font-extrabold text-emerald-400 tabular-nums">
                  {formatCompactIDR(remainingBudget)}
                </div>
              </div>
              <span className="text-[9px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-md font-bold">
                Brilliant
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => {
                  onClose();
                  openCatat('manual');
                }}
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ketik</span>
              </button>
              <button
                onClick={() => {
                  onClose();
                  openCatat('voice');
                }}
                className="py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Suara</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. iOS Lock Screen Widget */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            2. Lock Screen & Action Button
          </span>
          <div className="bg-[#151E2E] rounded-xl p-3 border border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-bold">Akses Layar Kunci</div>
                <div className="text-[10px] text-slate-400">Rekam instan dari Lock Screen</div>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                openCatat('voice');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900 transition font-semibold text-xs flex items-center gap-1"
            >
              <Mic className="w-3 h-3" />
              <span>Rekam</span>
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
        >
          Tutup
        </button>
      </div>
    </div>
  );
};
