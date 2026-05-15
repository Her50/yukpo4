/**
 * notify.ts - Notifications non-bloquantes (toast) centralisées
 *
 * Objectif: éviter d'utiliser Alert.alert() pour les messages simples (succès/erreur/info)
 * et standardiser l'UX sur toute l'app.
 *
 * Le ToasterProvider écoute l'événement 'toast:show' et affiche le toast.
 */
import { DeviceEventEmitter } from 'react-native';
import type { ToastType } from '../components/Toast';

export type NotifyType = ToastType;

type ToastPayload = {
  message: string;
  type: NotifyType;
};

const emitToast = (payload: ToastPayload) => {
  try {
    DeviceEventEmitter.emit('toast:show', payload);
  } catch {
    // fallback silencieux: on évite de crasher si DeviceEventEmitter n'est pas dispo
  }
};

export const notify = {
  success: (message: string) => emitToast({ message, type: 'success' }),
  error: (message: string) => emitToast({ message, type: 'error' }),
  warning: (message: string) => emitToast({ message, type: 'warning' }),
  info: (message: string) => emitToast({ message, type: 'info' }),
};


