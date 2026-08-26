import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import './index.css';
import AppRoutes from './Routes';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <AppRoutes />
  </React.StrictMode>
);
