import React, { useState, useEffect, useRef } from 'react';
import { Bell, MessageCircle, Phone, Video, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/buttons/Button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Notification {
  id: string;
  type: 'message' | 'call' | 'chat_request' | 'whatsapp_contact';
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
  content: string;
  timestamp: Date;
  read: boolean;
  serviceId?: string;
  serviceTitle?: string;
}

interface NotificationBellProps {
  userId: number;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ userId }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  // Simuler des notifications pour les tests
  useEffect(() => {
    const mockNotifications: Notification[] = [
      {
        id: '1',
        type: 'chat_request',
        sender: {
          id: '123',
          name: 'Jean Dupont',
          avatar: 'https://ui-avatars.com/api/?name=Jean+Dupont&background=random'
        },
        content: 'Nouvelle demande de chat pour le service Plomberie',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        read: false,
        serviceId: '456',
        serviceTitle: 'Services de plomberie'
      },
      {
        id: '2',
        type: 'whatsapp_contact',
        sender: {
          id: '124',
          name: 'Marie Martin',
          avatar: 'https://ui-avatars.com/api/?name=Marie+Martin&background=random'
        },
        content: 'Contact WhatsApp pour le service Électricité',
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
        read: false,
        serviceId: '789',
        serviceTitle: 'Services d\'électricité'
      }
    ];

    setNotifications(mockNotifications);
    setUnreadCount(mockNotifications.filter(n => !n.read).length);
  }, []);

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
    const newNotification: Notification = {
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
      serviceId: data.service_id,
      serviceTitle: data.service_title
    };

    setNotifications(prev => [newNotification, ...prev]);
    setUnreadCount(prev => prev + 1);
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
      case 'chat_request':
        return <MessageCircle className="w-4 h-4" />;
      case 'call':
        return <Phone className="w-4 h-4" />;
      case 'whatsapp_contact':
        return <MessageCircle className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'message':
      case 'chat_request':
        return 'bg-blue-100 text-blue-800';
      case 'call':
        return 'bg-green-100 text-green-800';
      case 'whatsapp_contact':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-800"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 min-w-[20px] h-5 text-xs bg-red-500 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Tout marquer comme lu
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Aucune notification</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarFallback className="text-xs">
                          {notification.sender.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-gray-900">
                            {notification.sender.name}
                          </span>
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${getNotificationColor(notification.type)}`}
                          >
                            {getNotificationIcon(notification.type)}
                            {notification.type === 'chat_request' && 'Chat'}
                            {notification.type === 'whatsapp_contact' && 'WhatsApp'}
                            {notification.type === 'message' && 'Message'}
                            {notification.type === 'call' && 'Appel'}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-gray-700 mb-1">
                          {notification.content}
                        </p>
                        
                        {notification.serviceTitle && (
                          <p className="text-xs text-gray-500 mb-2">
                            Service: {notification.serviceTitle}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {formatTime(notification.timestamp)}
                          </span>
                          
                          <div className="flex items-center gap-2">
                            {!notification.read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsRead(notification.id)}
                                className="text-xs text-blue-600 hover:text-blue-700"
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Marquer comme lu
                              </Button>
                            )}
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteNotification(notification.id)}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>{notifications.length} notification{notifications.length > 1 ? 's' : ''}</span>
                <span>{unreadCount} non lu{unreadCount > 1 ? 's' : ''}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell; 