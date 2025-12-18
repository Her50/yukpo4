import * as React from "react";
import { createContext, ReactNode, useContext, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Toast, { ToastType } from './Toast';

interface ToastData {
  id: string;
  message: string;
  type: ToastType;
}

interface ToasterContextType {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToasterContext = createContext<ToasterContextType | undefined>(undefined);

interface ToasterProviderProps {
  children: ReactNode;
}

export const ToasterProvider: React.FC<ToasterProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = (message: string, type: ToastType) => {
    const id = `${Date.now()}-${Math.random()}`;
    const newToast: ToastData = { id, message, type };

    setToasts(prev => [...prev, newToast]);

    // Auto-remove après 3 secondes
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const success = (message: string) => {
    showToast(message, 'success');
  };

  const error = (message: string) => {
    showToast(message, 'error');
  };

  const info = (message: string) => {
    showToast(message, 'info');
  };

  const warning = (message: string) => {
    showToast(message, 'warning');
  };

  const value: ToasterContextType = {
    success,
    error,
    info,
    warning,
  };

  return (
    <ToasterContext.Provider value={value}>
      {children}
      <View style={styles.toastContainer} pointerEvents="box-none">
        {toasts.map((toast, index) => (
          <View
            key={toast.id}
            style={[
              styles.toastWrapper,
              { top: 60 + index * 80 } // Empiler les toasts
            ]}
          >
            <Toast
              message={toast.message}
              type={toast.type}
              onHide={() => {
                setToasts(prev => prev.filter(t => t.id !== toast.id));
              }}
            />
          </View>
        ))}
      </View>
    </ToasterContext.Provider>
  );
};

export const useToaster = (): ToasterContextType => {
  const context = useContext(ToasterContext);
  if (context === undefined) {
    throw new Error('useToaster must be used within a ToasterProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    pointerEvents: 'box-none',
  },
  toastWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
  },
});






