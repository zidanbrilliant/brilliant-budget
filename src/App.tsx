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

const AppContent: React.FC = () => {
  const { activeTab, openCatat } = useApp();

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
    } else if (action === 'qr') {
      openCatat('qr');
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
