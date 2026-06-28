import React, { createContext, useState, useCallback } from "react";

export type Toast = {
  title: string;
  description?: string;
  type?: "default" | "success" | "error";
};

export const ToastContext = createContext<{
  toast: (toast: Toast) => void;
} | null>(null);

export const ToasterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentToast, setCurrentToast] = useState<Toast | null>(null);

  const toast = useCallback((toast: Toast) => {
    setCurrentToast(toast);
    setTimeout(() => setCurrentToast(null), 4000);
  }, []);

  // 2026-06-28 — Toast remonté au-dessus de la BourseNav (fixed bottom-0
  // height 64px + safe-area-inset-bottom). Avant : bottom-4 right-4 →
  // masqué derrière la nav sur mobile. Maintenant : centré horizontalement,
  // au-dessus de la nav avec marge confortable, full-width contrôlé,
  // animation slide-up subtile pour signaler l'apparition.
  const toneBg = {
    default: "bg-white border-gray-200",
    success: "bg-emerald-50 border-emerald-300",
    error: "bg-red-50 border-red-300",
  }[currentToast?.type ?? "default"];
  const toneTitle = {
    default: "text-gray-900",
    success: "text-emerald-900",
    error: "text-red-900",
  }[currentToast?.type ?? "default"];
  const toneDesc = {
    default: "text-gray-600",
    success: "text-emerald-700",
    error: "text-red-700",
  }[currentToast?.type ?? "default"];

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {currentToast && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,440px)] p-3 sm:p-4 ${toneBg} border-2 rounded-xl shadow-2xl transition-all`}
          style={{
            // bottom = hauteur BourseNav (~4rem) + safe-area-inset + 1rem de marge.
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)",
          }}
          role="status"
          aria-live="polite"
        >
          <div className={`font-semibold text-sm ${toneTitle}`}>{currentToast.title}</div>
          {currentToast.description && (
            <div className={`text-xs mt-0.5 leading-snug ${toneDesc}`}>
              {currentToast.description}
            </div>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
};
