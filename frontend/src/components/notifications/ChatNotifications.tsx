import React, { useState, useEffect, useRef } from 'react';
import { Bell, MessageCircle, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/buttons';

interface ChatNotification {
  id: string;
  type: 'message' | 'call' | 'mention';
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
  content: string;
  timestamp: Date;
  read: boolean;
  serviceId?: string;
}

interface ChatNotificationsProps {
  userId: number;
}

const ChatNotifications: React.FC<ChatNotificationsProps> = ({ userId }) => {
  const [notifications, setNotifications] = useState<ChatNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  // Charger les vraies notifications depuis l'API
  useEffect(() => {
    const loadRealNotifications = async () => {
      try {
        const response = await fetch(`/api/notifications/${userId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          const realNotifications = await response.json();
          setNotifications(realNotifications);
          setUnreadCount(realNotifications.filter((n: ChatNotification) => !n.read).length);
        } else {
          // Si pas de notifications, laisser la liste vide
          setNotifications([]);
          setUnreadCount(0);
        }
      } catch (error) {
        console.error('❌ [ChatNotifications] Erreur chargement notifications:', error);
        // En cas d'erreur, laisser la liste vide
        setNotifications([]);
        setUnreadCount(0);
      }
    };

    loadRealNotifications();
  }, [userId]);

  // WebSocket pour les notifications en temps réel
  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws/notifications/${userId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket notifications connecté');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleNewNotification(data);
      } catch (error) {
        console.error('Erreur parsing notification:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket notifications déconnecté');
    };

    return () => {
      ws.close();
    };
  }, [userId]);

  const handleNewNotification = (data: any) => {
    const newNotification: ChatNotification = {
      id: Date.now().toString(),
      type: data.type || 'message',
      sender: {
        id: data.sender_id,
        name: data.sender_name,
        avatar: data.sender_avatar
      },
      content: data.content,
      timestamp: new Date(),
      read: false,
      serviceId: data.service_id
    };

    setNotifications(prev => [newNotification, ...prev]);
    setUnreadCount(prev => prev + 1);

    // Notification toast
    toast.success(`Nouveau message de ${newNotification.sender.name}`, {
      duration: 4000,
      icon: '💬',
    });
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
    setUnreadCount(0);
  };

  const deleteNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    setUnreadCount(prev => {
      const notification = notifications.find(n => n.id === notificationId);
      return notification && !notification.read ? Math.max(0, prev - 1) : prev;
    });
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes}min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case 'call':
        return <Bell className="h-4 w-4 text-green-500" />;
      case 'mention':
        return <MessageCircle className="h-4 w-4 text-purple-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="relative">
      {/* Bouton de notification */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Panneau de notifications */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Notifications
            </h3>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs"
                >
                  Tout marquer comme lu
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Liste des notifications */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                Aucune notification
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      {notification.sender.avatar ? (
                        <img
                          src={notification.sender.avatar}
                          alt={notification.sender.name}
                          className="h-8 w-8 rounded-full"
                        />
                      ) : (
                        <div className="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                          {getNotificationIcon(notification.type)}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {notification.sender.name}
                        </p>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTime(notification.timestamp)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="h-4 w-4 p-0 text-gray-400 hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 mt-1">
                        {getNotificationIcon(notification.type)}
                        <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                          {notification.content}
                        </p>
                      </div>
                      
                      {!notification.read && (
                        <div className="mt-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-sm"
                onClick={() => {
                  // Ouvrir la page des notifications complète
                  window.location.href = '/notifications';
                }}
              >
                Voir toutes les notifications
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatNotifications; 