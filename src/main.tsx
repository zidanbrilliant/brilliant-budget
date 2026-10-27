import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { applyIosNavGapFix } from './utils/iosViewport';

applyIosNavGapFix();
if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', applyIosNavGapFix);
  window.addEventListener('orientationchange', applyIosNavGapFix);
  window.addEventListener('resize', applyIosNavGapFix);
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
