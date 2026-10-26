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

  const isPinkTheme = settings.theme === 'pink';

  if (settings.onboarding_completed) return null;

  const handleFinish = () => {
    updateSettings({ onboarding_completed: true });
  };

  const primaryButton = isPinkTheme
    ? 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 shadow-rose-300/40'
    : 'bg-emerald-600 hover:bg-emerald-500 shadow-xs';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className={`rounded-3xl p-6 max-w-sm w-full shadow-2xl border space-y-5 animate-scale-up ${
          isPinkTheme
            ? 'bg-[#FFF5F7] border-pink-200 text-[#37131D]'
            : 'bg-white dark:bg-[#151E2E] border-slate-200 dark:border-slate-800'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isPinkTheme ? 'text-pink-500' : 'text-slate-400'}`}>
            Langkah {step} dari 4
          </span>
          <button
            onClick={handleFinish}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition ${
              isPinkTheme
                ? 'text-pink-600 hover:bg-pink-100'
                : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            Lewati
          </button>
        </div>

        {/* Step Indicators */}
        <div className="flex gap-1.5" aria-hidden="true">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                step >= s
                  ? isPinkTheme
                    ? 'bg-rose-500'
                    : 'bg-emerald-600'
                  : isPinkTheme
                  ? 'bg-pink-200'
                  : 'bg-slate-200 dark:bg-slate-700'
              }`}
            ></div>
          ))}
        </div>

        {/* Screen 1: Welcome & Offline Principles */}
        {step === 1 && (
          <div className="text-center space-y-2.5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-2xs ${
              isPinkTheme
                ? 'bg-pink-100 text-pink-600'
                : 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
            }`}>
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h2
              id="onboarding-title"
              className={`text-lg font-bold tracking-tight ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}
            >
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
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-2xs">
              <Wallet className="w-7 h-7" />
            </div>
            <h2 className={`text-lg font-bold tracking-tight ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
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
            <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto shadow-2xs">
              <PieChart className="w-7 h-7" />
            </div>
            <h2 className={`text-lg font-bold tracking-tight ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
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
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-2xs">
              <Zap className="w-7 h-7" />
            </div>
            <h2 className={`text-lg font-bold tracking-tight ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
              Catat Dalam ≤ 5 Detik
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Gunakan suara, foto nota, scan QRIS, atau keypad cepat dengan tombol <strong>000</strong>.
              Data langsung terekam dengan rapi!
            </p>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="pt-1">
          {step < 4 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className={`w-full py-2.5 ${primaryButton} text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95`}
            >
              <span>Lanjut</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className={`w-full py-2.5 ${primaryButton} text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95`}
            >
              <CheckCircle className="w-4 h-4" />
              <span>Mulai Mencatat 🌸</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
