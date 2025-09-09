import { useState, useEffect, useCallback } from 'react';
import { useUser } from './useUser';

// Hook pour gérer le statut du prestataire - VERSION TEST
export const usePrestataireStatus = (userId: number) => {
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userStatus, setUserStatus] = useState<any>(null);
  const { user } = useUser();

  // Fonction pour vérifier le statut de l'utilisateur
  const checkUserStatus = useCallback((targetUserId: number) => {
    // Simulation de la vérification du statut
    setIsOnline(true);
    setLastSeen(new Date());
    setUserStatus({ id: targetUserId, status: 'online' });
    
    // Simuler une connexion WebSocket
    setIsConnected(true);
  }, []);

  useEffect(() => {
    if (userId > 0) {
      // Simulation du statut en ligne
      setIsOnline(true);
      setIsConnected(true);
      setLastSeen(new Date());
      // Initialiser userStatus pour éviter l'affichage "Hors ligne"
      setUserStatus({ id: userId, status: 'online' });
    }
  }, [userId]);

  return {
    isOnline,
    lastSeen,
    status: isOnline ? 'online' : 'offline',
    isConnected,
    checkUserStatus,
    userStatus
  };
};

// Hook pour gérer les notifications WebSocket
export const useNotificationsWebSocket = (userId: number) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useUser();

  // Fonction pour marquer une notification comme lue
  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, read: true }
          : notif
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Fonction pour marquer toutes les notifications comme lues
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    );
    setUnreadCount(0);
  }, []);

  // Fonction pour supprimer une notification
  const removeNotification = useCallback((notificationId: string) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === notificationId);
      if (notification && !notification.read) {
        setUnreadCount(count => Math.max(0, count - 1));
      }
      return prev.filter(n => n.id !== notificationId);
    });
  }, []);

  // Fonction pour ajouter une nouvelle notification
  const addNotification = useCallback((notification: any) => {
    setNotifications(prev => [notification, ...prev]);
    if (!notification.read) {
      setUnreadCount(prev => prev + 1);
    }
  }, []);

  // Simulation de la connexion WebSocket
  useEffect(() => {
    if (userId > 0) {
      // Simuler une connexion WebSocket
      setIsConnected(true);
      
      // Simuler quelques notifications de test
      const testNotifications = [
        {
          id: '1',
          type: 'message',
          title: 'Nouveau message',
          content: 'Vous avez reçu un nouveau message',
          timestamp: new Date(),
          read: false
        },
        {
          id: '2',
          type: 'service',
          title: 'Service mis à jour',
          content: 'Votre service a été mis à jour',
          timestamp: new Date(Date.now() - 3600000),
          read: true
        }
      ];

      setNotifications(testNotifications);
      setUnreadCount(testNotifications.filter(n => !n.read).length);

      // Simuler la déconnexion après 5 minutes
      const disconnectTimeout = setTimeout(() => {
        setIsConnected(false);
      }, 300000);

      return () => {
        clearTimeout(disconnectTimeout);
        setIsConnected(false);
      };
    }
  }, [userId]);

  return {
    notifications,
    isConnected,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    addNotification
  };
}; 