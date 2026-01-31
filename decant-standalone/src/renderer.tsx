// ============================================================
// Decant Renderer Entry Point
// ============================================================

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './renderer/App';
import './renderer/styles/globals.css';

// Mount the React app
const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('Decant renderer initialized');
