import { useState, useEffect } from 'react';
import { notificationService } from '../services/notificationService';

interface NotificationCounts {
  notifications: number;
  conversations: number;
  loading: boolean;
  error: string | null;
}

export const useNotificationCounts = () => {
  const [counts, setCounts] = useState<NotificationCounts>({
    notifications: 0,
    conversations: 0,
    loading: false,
    error: null
  });

  const fetchCounts = async () => {
    try {
      setCounts(prev => ({ ...prev, loading: true, error: null }));

      // Récupérer le nombre de notifications non lues
      const notificationsData = await notificationService.getUnreadNotificationCount();
      const notificationsCount = notificationsData.count || 0;

      // Récupérer le nombre de conversations non lues
      const conversationsData = await notificationService.getUnreadConversationCount();
      const conversationsCount = conversationsData.count || 0;

      setCounts({
        notifications: notificationsCount,
        conversations: conversationsCount,
        loading: false,
        error: null
      });

    } catch (error) {
      console.error('Erreur lors du chargement des compteurs:', error);
      setCounts(prev => ({
        ...prev,
        loading: false,
        error: 'Erreur de chargement'
      }));
    }
  };

  // Charger les compteurs au montage
  useEffect(() => {
    fetchCounts();
  }, []);

  // Écouter les événements de mise à jour
  useEffect(() => {
    const handleNotificationUpdate = () => {
      fetchCounts();
    };

    const handleConversationUpdate = () => {
      fetchCounts();
    };

    // Écouter les événements personnalisés
    window.addEventListener('notification:updated', handleNotificationUpdate);
    window.addEventListener('conversation:updated', handleConversationUpdate);
    window.addEventListener('message:received', handleConversationUpdate);

    return () => {
      window.removeEventListener('notification:updated', handleNotificationUpdate);
      window.removeEventListener('conversation:updated', handleConversationUpdate);
      window.removeEventListener('message:received', handleConversationUpdate);
    };
  }, []);

  // Rafraîchir les compteurs
  const refreshCounts = () => {
    fetchCounts();
  };

  // Marquer les notifications comme lues
  const markNotificationsAsRead = async () => {
    try {
      await notificationService.markAllNotificationsAsRead();
      setCounts(prev => ({ ...prev, notifications: 0 }));
    } catch (error) {
      console.error('Erreur lors du marquage des notifications:', error);
    }
  };

  // Marquer les conversations comme lues
  const markConversationsAsRead = async () => {
    try {
      await notificationService.markAllConversationsAsRead();
      setCounts(prev => ({ ...prev, conversations: 0 }));
    } catch (error) {
      console.error('Erreur lors du marquage des conversations:', error);
    }
  };

  return {
    ...counts,
    refreshCounts,
    markNotificationsAsRead,
    markConversationsAsRead
  };
};
