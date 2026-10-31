import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { applyIosNavGapFix } from './utils/iosViewport';
import { ErrorBoundary } from './components/common/ErrorBoundary';

applyIosNavGapFix();
if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', applyIosNavGapFix);
  window.addEventListener('orientationchange', applyIosNavGapFix);
  window.addEventListener('resize', applyIosNavGapFix);

  // Request persistent storage to protect local storage from WebKit / iOS 7-day inactivity eviction
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
