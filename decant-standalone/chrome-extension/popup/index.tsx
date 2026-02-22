// ============================================================
// Popup entry point
// ============================================================

import { createRoot } from 'react-dom/client';
import { DecantPopup } from './popup.js';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<DecantPopup />);
}
