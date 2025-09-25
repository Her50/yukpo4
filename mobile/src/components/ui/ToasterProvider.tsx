import React, { createContext, useContext, ReactNode } from 'react';
import { Alert } from 'react-native';

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
  const success = (message: string) => {
    Alert.alert('Succès', message);
  };

  const error = (message: string) => {
    Alert.alert('Erreur', message);
  };

  const info = (message: string) => {
    Alert.alert('Information', message);
  };

  const warning = (message: string) => {
    Alert.alert('Attention', message);
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

