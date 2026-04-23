import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppRouter } from './app/router';
import { AppProviders } from './app/providers';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </React.StrictMode>,
);
