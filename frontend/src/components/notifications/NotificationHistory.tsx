import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  X, 
  Search,
  Filter,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/components/ui/use-toast';

interface NotificationItem {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  category: 'service' | 'system' | 'payment' | 'security';
  actionUrl?: string;
  actionText?: string;
  metadata?: any;
}

interface NotificationHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationHistory: React.FC<NotificationHistoryProps> = ({
  isOpen,
  onClose
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showRead, setShowRead] = useState(true);
  const { user } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && user?.id) {
      loadNotifications();
    }
  }, [isOpen, user?.id]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/notifications/history', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      } else {
        // Simulation pour le développement
        const mockNotifications: NotificationItem[] = [
          {
            id: '1',
            type: 'warning',
            title: 'Service désactivé automatiquement',
            message: 'Votre service "Réparation iPhone" a été désactivé automatiquement après 30 jours d\'inactivité. Vous pouvez le réactiver pour 1000 FCFA.',
            timestamp: new Date(Date.now() - 1000 * 60 * 30),
            isRead: false,
            category: 'service',
            actionUrl: '/mes-services',
            actionText: 'Réactiver le service',
            metadata: { serviceId: 'service-1', reactivationCost: 1000 }
          },
          {
            id: '2',
            type: 'success',
            title: 'Paiement reçu',
            message: 'Vous avez reçu un paiement de 15,000 FCFA pour le service "Cours de guitare".',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
            isRead: true,
            category: 'payment',
            actionUrl: '/mon-solde',
            actionText: 'Voir le solde'
          },
          {
            id: '3',
            type: 'info',
            title: 'Nouvelle fonctionnalité disponible',
            message: 'Les appels vidéo sont maintenant disponibles ! Vous pouvez maintenant communiquer en temps réel avec vos clients.',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
            isRead: true,
            category: 'system',
            actionUrl: '/dashboard',
            actionText: 'Découvrir'
          },
          {
            id: '4',
            type: 'error',
            title: 'Échec de paiement',
            message: 'Le paiement de 5,000 FCFA a échoué. Vérifiez votre méthode de paiement.',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
            isRead: false,
            category: 'payment',
            actionUrl: '/recharge-tokens',
            actionText: 'Recharger'
          },
          {
            id: '5',
            type: 'warning',
            title: 'Tentative de connexion suspecte',
            message: 'Une tentative de connexion depuis un nouvel appareil a été détectée. Si ce n\'était pas vous, changez votre mot de passe.',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72),
            isRead: true,
            category: 'security',
            actionUrl: '/mon-profil',
            actionText: 'Sécurité'
          }
        ];
        setNotifications(mockNotifications);
      }
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger l'historique des notifications",
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredNotifications = notifications
    .filter(notification => {
      const matchesSearch = notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           notification.message.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || notification.type === filterType;
      const matchesCategory = filterCategory === 'all' || notification.category === filterCategory;
      const matchesRead = showRead || !notification.isRead;
      return matchesSearch && matchesType && matchesCategory && matchesRead;
    })
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId 
              ? { ...notif, isRead: true }
              : notif
          )
        );
      }
    } catch (error) {
      console.error('Erreur marquer comme lu:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, isRead: true }))
        );
        toast({
          title: "Succès",
          description: "Toutes les notifications ont été marquées comme lues",
          type: "success"
        });
      }
    } catch (error) {
      console.error('Erreur marquer tout comme lu:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
        toast({
          title: "Supprimé",
          description: "Notification supprimée",
          type: "success"
        });
      }
    } catch (error) {
      console.error('Erreur suppression notification:', error);
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `Il y a ${minutes}min`;
    if (hours < 24) return `Il y a ${hours}h`;
    return `Il y a ${days}j`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'info': return <Info className="w-4 h-4 text-blue-500" />;
      default: return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'info': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'service': return 'bg-purple-100 text-purple-800';
      case 'payment': return 'bg-green-100 text-green-800';
      case 'system': return 'bg-blue-100 text-blue-800';
      case 'security': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Historique des notifications
            </CardTitle>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unreadCount} non lues
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Tout marquer comme lu
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden">
          {/* Filtres */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les types</option>
              <option value="info">Info</option>
              <option value="success">Succès</option>
              <option value="warning">Avertissement</option>
              <option value="error">Erreur</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Toutes les catégories</option>
              <option value="service">Service</option>
              <option value="payment">Paiement</option>
              <option value="system">Système</option>
              <option value="security">Sécurité</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRead(!showRead)}
              className="flex items-center gap-2"
            >
              {showRead ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showRead ? 'Masquer lues' : 'Afficher lues'}
            </Button>
          </div>

          {/* Liste des notifications */}
          <div className="space-y-3 overflow-y-auto max-h-96">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Chargement...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Aucune notification trouvée</p>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border transition-all hover:shadow-md ${
                    notification.isRead 
                      ? 'bg-white border-gray-200' 
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getTypeIcon(notification.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className={`font-medium ${notification.isRead ? 'text-gray-900' : 'text-gray-900 font-semibold'}`}>
                            {notification.title}
                          </h4>
                          <Badge className={getTypeColor(notification.type)}>
                            {notification.type}
                          </Badge>
                          <Badge className={getCategoryColor(notification.category)}>
                            {notification.category}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(notification.timestamp)}
                          </span>
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 mb-3">
                        {notification.message}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {notification.actionUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Navigation vers l'action
                                window.location.href = notification.actionUrl!;
                              }}
                            >
                              {notification.actionText || 'Voir'}
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {!notification.isRead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markAsRead(notification.id)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Marquer lu
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteNotification(notification.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationHistory;
