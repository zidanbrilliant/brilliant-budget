import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { IOSFrame } from './components/common/iOSFrame';
import { TabBar } from './components/common/TabBar';
import { Toast } from './components/common/Toast';
import { CatatModal } from './components/catat/CatatModal';
import { BerandaView } from './components/beranda/BerandaView';
import { TransaksiView } from './components/transaksi/TransaksiView';
import { BudgetView } from './components/budget/BudgetView';
import { LainnyaView } from './components/lainnya/LainnyaView';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { consumePendingUpload } from './utils/cameraHelper';
import { AlertTriangle, X } from 'lucide-react';

const AppContent: React.FC = () => {
  const { activeTab, openCatat, storageWarning, dismissStorageWarning } = useApp();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector('main')?.scrollTo(0, 0);
  }, [activeTab]);

  useEffect(() => {
    const pending = consumePendingUpload();
    if (pending) {
      openCatat(pending);
      return;
    }

    // ponytail: fast-entry via URL hash or query param (e.g. /#catat or /?action=catat)
    const hash = window.location.hash.toLowerCase().replace('#', '');
    const search = new URLSearchParams(window.location.search);
    const action = search.get('action') || hash;

    if (action === 'catat' || action === 'manual') {
      openCatat('manual');
    } else if (action === 'voice') {
      openCatat('voice');
    } else if (action === 'ocr') {
      openCatat('ocr');
    }
  }, []);

  return (
    <>
      <IOSFrame>
        {activeTab === 'beranda' && <BerandaView />}
        {activeTab === 'transaksi' && <TransaksiView />}
        {activeTab === 'budget' && <BudgetView />}
        {activeTab === 'lainnya' && <LainnyaView />}
      </IOSFrame>

      {/* Global Modals & Navigation placed outside scroll container for iOS WebKit stability */}
      {storageWarning && (
        <aside
          role="alert"
          aria-live="polite"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3.75rem)' }}
          className="fixed left-4 right-4 z-50 max-w-md mx-auto bg-amber-500 text-slate-950 px-3.5 py-2.5 rounded-2xl shadow-xl flex items-start gap-2.5 border border-amber-600/40 text-xs animate-scale-up"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-slate-950" />
          <p className="flex-1 font-medium leading-snug">{storageWarning}</p>
          <button
            onClick={dismissStorageWarning}
            className="min-w-[44px] min-h-[44px] -mr-2 -my-2 flex items-center justify-center hover:bg-amber-600/25 rounded-md transition"
            aria-label="Tutup pemberitahuan"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </aside>
      )}
      <TabBar />
      <CatatModal />
      <Toast />
      <OnboardingModal />
    </>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
