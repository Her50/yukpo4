import React, { useEffect, useState, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Bell, X, Settings, Volume2, VolumeX } from 'lucide-react';

interface PushNotification {
  id: string;
  title: string;
  message: string;
  type: 'default' | 'success' | 'error';
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    url: string;
  };
}

interface PushNotificationManagerProps {
  userId: number;
  wsConnected: boolean;
}

export const PushNotificationManager: React.FC<PushNotificationManagerProps> = ({
  userId,
  wsConnected
}) => {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const wsRef = useRef<WebSocket | null>(null);

  // Demander la permission pour les notifications push
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(perm => {
          setPermission(perm);
          setIsEnabled(perm === 'granted');
        });
      } else {
        setIsEnabled(Notification.permission === 'granted');
      }
    }
  }, []);

  // WebSocket pour les notifications push en temps réel
  useEffect(() => {
    if (wsConnected && isEnabled) {
      const ws = new WebSocket(`ws://${window.location.host}/ws/notifications/${userId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔔 WebSocket notifications push connecté');
        // Demander les notifications non lues
        ws.send(JSON.stringify({
          message_type: 'get_unread_notifications',
          user_id: userId
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handlePushNotification(data);
        } catch (error) {
          console.error('Erreur parsing notification push:', error);
        }
      };

      ws.onclose = () => {
        console.log('🔔 WebSocket notifications push déconnecté');
      };

      return () => {
        ws.close();
      };
    }
  }, [wsConnected, isEnabled, userId]);

  const handlePushNotification = (data: any) => {
    if (data.message_type === 'push_notification') {
      const notification: PushNotification = {
        id: Date.now().toString(),
        title: data.title || 'Nouvelle notification',
        message: data.message || '',
        type: data.type || 'default',
        timestamp: new Date(),
        read: false,
        action: data.action
      };

      setNotifications(prev => [notification, ...prev]);

      // Afficher la notification push native si autorisée
      if (isEnabled && permission === 'granted') {
        const nativeNotification = new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: notification.id,
          requireInteraction: false,
          silent: false
        });

        // Gérer le clic sur la notification
        nativeNotification.onclick = () => {
          window.focus();
          if (notification.action?.url) {
            window.open(notification.action.url, '_blank');
          }
          markAsRead(notification.id);
        };

        // Auto-fermeture après 5 secondes
        setTimeout(() => {
          nativeNotification.close();
        }, 5000);
      }

      // Toast de confirmation
      toast({
        title: notification.title,
        description: notification.message,
        type: notification.type
      });
    }
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const deleteNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const toggleNotifications = () => {
    if (isEnabled) {
      setIsEnabled(false);
      toast({
        title: "Notifications désactivées",
        description: "Vous ne recevrez plus de notifications push",
        type: "default"
      });
    } else {
      if (permission === 'granted') {
        setIsEnabled(true);
        toast({
          title: "Notifications activées",
          description: "Vous recevrez maintenant les notifications push",
          type: "success"
        });
      } else {
        Notification.requestPermission().then(perm => {
          setPermission(perm);
          setIsEnabled(perm === 'granted');
        });
      }
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="relative">
      {/* Bouton principal */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        title="Gérer les notifications push"
      >
        {isEnabled ? (
          <Bell className="w-5 h-5 text-blue-600" />
        ) : (
          <Bell className="w-5 h-5 text-gray-400" />
        )}
        
        {/* Badge de notifications non lues */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panneau des paramètres */}
      {showSettings && (
        <div className="absolute right-0 top-12 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Notifications Push</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Statut de connexion WebSocket */}
            <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded">
              <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm">
                {wsConnected ? 'WebSocket connecté' : 'WebSocket déconnecté'}
              </span>
            </div>

            {/* Contrôles */}
            <div className="space-y-3">
              <button
                onClick={toggleNotifications}
                className={`w-full p-2 rounded text-sm font-medium transition-colors ${
                  isEnabled
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {isEnabled ? 'Désactiver' : 'Activer'} les notifications
              </button>

              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="w-full p-2 bg-green-100 text-green-700 rounded text-sm font-medium hover:bg-green-200 transition-colors"
                >
                  Marquer tout comme lu ({unreadCount})
                </button>
              )}
            </div>

            {/* Liste des notifications récentes */}
            {notifications.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Notifications récentes
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {notifications.slice(0, 5).map(notification => (
                    <div
                      key={notification.id}
                      className={`p-2 rounded text-sm ${
                        notification.read ? 'bg-gray-50' : 'bg-blue-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {notification.title}
                          </p>
                          <p className="text-gray-600 text-xs">
                            {notification.message}
                          </p>
                          <p className="text-gray-400 text-xs mt-1">
                            {notification.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="flex gap-1 ml-2">
                          {!notification.read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded text-xs"
                            >
                              Marquer lu
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded text-xs"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 