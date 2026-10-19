import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from '@/app/AppContext';
import { App } from '@/app/App';
import { registerServiceWorker } from '@/pwa';
import '@/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

// Register Progressive Web App Service Worker
registerServiceWorker();
