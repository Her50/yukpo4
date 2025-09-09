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

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {currentToast && (
        <div className="fixed bottom-4 right-4 p-4 bg-white border rounded-lg shadow-lg z-50">
          <div className="font-semibold">{currentToast.title}</div>
          {currentToast.description && (
            <div className="text-sm text-muted-foreground">{currentToast.description}</div>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
};
