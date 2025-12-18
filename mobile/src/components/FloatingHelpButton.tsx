// src/components/ui/FloatingHelpButton.tsx
import React from 'react';

const FloatingHelpButton: React.FC = () => (
  <a
    href="https://wa.me/237695000000"
    style="fixed bottom-6 right-6 bg-green-500 text-white px-4 py-2 rounded-full shadow-lg z-50 hover:bg-green-600 transition"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="💬 besoin d’aide ?"
  >
    💬 besoin d’aide ?
  </a>
);

export default FloatingHelpButton;





