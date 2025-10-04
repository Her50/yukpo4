// Remplacement des Ionicons par des emojis pour éviter les crashes
import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Badge, Card, Title } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { notificationsApi } from '../services/api';
import { theme } from '../theme/theme';

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

interface NotificationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationHistoryModal: React.FC<NotificationHistoryModalProps> = ({
  isOpen,
  onClose
}) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showRead, setShowRead] = useState(true);

  useEffect(() => {
    if (isOpen && user?.id) {
      loadNotifications();
    }
  }, [isOpen, user?.id]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await notificationsApi.getNotifications();

      if (response.data) {
        const notificationsData = (response.data as NotificationItem[]) || [];
        setNotifications(notificationsData);
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
      Alert.alert('Erreur', 'Impossible de charger l\'historique des notifications');
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
      await notificationsApi.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId
            ? { ...notif, isRead: true }
            : notif
        )
      );
    } catch (error) {
      console.error('Erreur marquer comme lu:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      // TODO: Implémenter l'API pour marquer toutes les notifications comme lues
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, isRead: true }))
      );
      Alert.alert('Succès', 'Toutes les notifications ont été marquées comme lues');
    } catch (error) {
      console.error('Erreur marquer tout comme lu:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      // TODO: Implémenter l'API pour supprimer une notification
      setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
      Alert.alert('Supprimé', 'Notification supprimée');
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
      case 'success': return 'checkmark-circle';
      case 'warning': return 'warning';
      case 'error': return 'alert-circle';
      case 'info': return 'information-circle';
      default: return 'notifications';
    }
  };

  const getTypeIconEmoji = (type: string) => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'info': return 'ℹ️';
      default: return '🔔';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return '#4CAF50';
      case 'warning': return '#FF9800';
      case 'error': return '#F44336';
      case 'info': return '#2196F3';
      default: return '#9E9E9E';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'service': return '#9C27B0';
      case 'payment': return '#4CAF50';
      case 'system': return '#2196F3';
      case 'security': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Title style={styles.headerTitle}>
              🔔 Historique des notifications
            </Title>
            {unreadCount > 0 && (
              <Badge style={styles.unreadBadge}>{`${unreadCount} non lues`}</Badge>
            )}
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.markAllButton}
              onPress={markAllAsRead}
              disabled={unreadCount === 0}
            >
              <Text style={styles.checkIcon}>✅</Text>
              <Text style={[
                styles.markAllText,
                { color: unreadCount === 0 ? '#9E9E9E' : theme.colors.primary }
              ]}>
                Tout marquer comme lu
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={styles.closeIconButton}>
              <Text style={styles.closeIconText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filtres */}
        <View style={styles.filtersContainer}>
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher..."
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
            <TouchableOpacity
              style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]}
              onPress={() => setFilterType('all')}
            >
              <Text style={[styles.filterChipText, filterType === 'all' && styles.filterChipTextActive]}>
                Tous les types
              </Text>
            </TouchableOpacity>

            {['info', 'success', 'warning', 'error'].map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.filterChip, filterType === type && styles.filterChipActive]}
                onPress={() => setFilterType(type)}
              >
                <Text style={[styles.filterChipText, filterType === type && styles.filterChipTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.filterChip, !showRead && styles.filterChipActive]}
              onPress={() => setShowRead(!showRead)}
            >
              <Text style={styles.filterIcon}>
                {showRead ? "🙈" : "👁️"}
              </Text>
              <Text style={[styles.filterChipText, !showRead && styles.filterChipTextActive]}>
                {showRead ? 'Masquer lues' : 'Afficher lues'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Liste des notifications */}
        <ScrollView style={styles.notificationsList}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Chargement...</Text>
            </View>
          ) : filteredNotifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>Aucune notification trouvée</Text>
            </View>
          ) : (
            filteredNotifications.map((notification) => (
              <Card
                key={notification.id}
                style={[
                  styles.notificationCard,
                  !notification.isRead && styles.unreadCard
                ]}
              >
                <Card.Content>
                  <View style={styles.notificationHeader}>
                    <View style={styles.notificationLeft}>
                      <Text style={styles.typeIcon}>
                        {getTypeIconEmoji(notification.type)}
                      </Text>

                      <View style={styles.notificationInfo}>
                        <View style={styles.notificationTitleRow}>
                          <Text style={[
                            styles.notificationTitle,
                            !notification.isRead && styles.unreadText
                          ]}>
                            {notification.title}
                          </Text>

                          <View style={styles.badgesContainer}>
                            <Badge style={[styles.typeBadge, { backgroundColor: getTypeColor(notification.type) }]}>
                              {notification.type}
                            </Badge>
                            <Badge style={[styles.categoryBadge, { backgroundColor: getCategoryColor(notification.category) }]}>
                              {notification.category}
                            </Badge>
                          </View>
                        </View>

                        <Text style={styles.notificationMessage}>
                          {notification.message}
                        </Text>

                        <View style={styles.notificationMeta}>
                          <Text style={styles.timestamp}>
                            {formatTime(notification.timestamp)}
                          </Text>
                          {!notification.isRead && (
                            <View style={styles.unreadDot} />
                          )}
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.notificationActions}>
                    {notification.actionUrl && (
                      <TouchableOpacity
                        onPress={() => {
                          // TODO: Naviguer vers l'action
                          Alert.alert('Action', `Action: ${notification.actionText || 'Voir'}`);
                        }}
                      >
                        <Text>{notification.actionText || 'Voir'}</Text>
                      </TouchableOpacity>
                    )}

                    <View style={styles.actionButtons}>
                      {!notification.isRead && (
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => markAsRead(notification.id)}
                        >
                          <Text style={styles.actionIcon}>✅</Text>
                          <Text style={styles.actionButtonText}>Marquer lu</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => deleteNotification(notification.id)}
                      >
                        <Text style={styles.deleteIcon}>🗑️</Text>
                        <Text style={[styles.actionButtonText, { color: '#F44336' }]}>Supprimer</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  unreadBadge: {
    backgroundColor: '#F44336',
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  markAllText: {
    fontSize: 12,
    marginLeft: 4,
  },
  filtersContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  checkIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  filterIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  emptyIcon: {
    fontSize: 48,
    textAlign: 'center',
    opacity: 0.5,
    marginBottom: 16,
  },
  typeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  actionIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  deleteIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    paddingVertical: 12,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: theme.colors.text,
    marginLeft: 4,
  },
  filterChipTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  notificationsList: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 16,
  },
  notificationCard: {
    marginBottom: 12,
    elevation: 1,
  },
  unreadCard: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  notificationHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  notificationLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  notificationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginRight: 8,
  },
  unreadText: {
    fontWeight: 'bold',
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  typeBadge: {
    fontSize: 10,
  },
  categoryBadge: {
    fontSize: 10,
  },
  notificationMessage: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timestamp: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  notificationActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    color: theme.colors.text,
    marginLeft: 4,
  },
  closeIconButton: {
    padding: 8,
  },
  closeIconText: {
    fontSize: 24,
    color: theme.colors.text,
    fontWeight: 'bold',
  },
});

export default NotificationHistoryModal;






