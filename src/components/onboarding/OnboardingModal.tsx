import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck,
  Zap,
  Wallet,
  PieChart,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';

export const OnboardingModal: React.FC = () => {
  const { settings, updateSettings } = useApp();
  const [step, setStep] = useState(1);

  if (settings.onboarding_completed) return null;

  const handleFinish = () => {
    updateSettings({ onboarding_completed: true });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white dark:bg-[#151E2E] rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-scale-up">
        {/* Step Indicators */}
        <div className="flex justify-center gap-1.5">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`h-1 rounded-full transition-all duration-300 ${
                step === s ? 'w-6 bg-emerald-600' : 'w-2 bg-slate-200 dark:bg-slate-700'
              }`}
            ></div>
          ))}
        </div>

        {/* Screen 1: Welcome & Offline Principles */}
        {step === 1 && (
          <div className="text-center space-y-2.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-2xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Selamat Datang di Brilliant Budget
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Aplikasi keuangan pribadi <strong>100% offline</strong>. Seluruh data tersimpan aman
              di perangkat Anda tanpa server dan tanpa pelacakan luar.
            </p>
          </div>
        )}

        {/* Screen 2: Dompet Awal */}
        {step === 2 && (
          <div className="text-center space-y-2.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-2xs">
              <Wallet className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Siapkan Dompet Anda
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Brilliant Budget mendukung rekening bank, e-wallet (GoPay, OVO, ShopeePay), dan tunai.
              Saldo awal dapat disesuaikan kapan saja.
            </p>
          </div>
        )}

        {/* Screen 3: Metode Budgeting */}
        {step === 3 && (
          <div className="text-center space-y-2.5">
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto shadow-2xs">
              <PieChart className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Pilih Gaya Budgeting
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Pilih metode anggaran: batas total bulanan, amplop pengeluaran, atau aturan 50/30/20.
              Dapat berganti kapan saja tanpa kehilangan data.
            </p>
          </div>
        )}

        {/* Screen 4: Kecepatan Mencatat */}
        {step === 4 && (
          <div className="text-center space-y-2.5">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-2xs">
              <Zap className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Catat Dalam ≤ 5 Detik
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Gunakan suara, foto nota, scan QRIS, atau keypad pintasan "rb". Data langsung
              terekam dengan rapi!
            </p>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="pt-1">
          {step < 4 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95"
            >
              <span>Lanjut</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Mulai Mencatat</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
