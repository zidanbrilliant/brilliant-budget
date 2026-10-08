import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { IOSFrame } from './components/common/iOSFrame';
import { TabBar } from './components/common/TabBar';
import { Toast } from './components/common/Toast';
import { CatatModal } from './components/catat/CatatModal';
import { BerandaView } from './components/beranda/BerandaView';
import { TransaksiView } from './components/transaksi/TransaksiView';
import { BudgetView } from './components/budget/BudgetView';
import { LainnyaView } from './components/lainnya/LainnyaView';
import { LockScreen } from './components/security/LockScreen';
import { OnboardingModal } from './components/onboarding/OnboardingModal';

const AppContent: React.FC = () => {
  const { activeTab } = useApp();

  return (
    <IOSFrame>
      {activeTab === 'beranda' && <BerandaView />}
      {activeTab === 'transaksi' && <TransaksiView />}
      {activeTab === 'budget' && <BudgetView />}
      {activeTab === 'lainnya' && <LainnyaView />}

      <TabBar />
      <CatatModal />
      <Toast />
      <LockScreen />
      <OnboardingModal />
    </IOSFrame>
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
