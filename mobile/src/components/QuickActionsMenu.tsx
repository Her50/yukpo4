// Migration vers Lucide React Native pour un design moderne
import { useNavigation } from '@react-navigation/native';
import { BarChart3, Bell, Briefcase, Camera, ChatCircle, Clock, Document, Heart, Home, PlayCircle, Plus, Search, Settings, Share, Star, User, X } from 'phosphor-react-native';
import * as React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../theme/theme';

interface QuickActionsMenuProps {
    isVisible: boolean;
    onClose: () => void;
}

// Fonction pour mapper les icônes vers Lucide
const getActionIcon = (iconName: string, size: number, color: string) => {
    const iconMap: { [key: string]: any } = {
        'add': <Plus size={size} color={color} />,
        'search': <Search size={size} color={color} />,
        'settings': <Settings size={size} color={color} />,
        'person': <User size={size} color={color} />,
        'chatbubbles': <ChatCircle size={size} color={color} />,
        'camera': <Camera size={size} color={color} />,
        'document': <Document size={size} color={color} />,
        'share': <Share size={size} color={color} />,
        'heart': <Heart size={size} color={color} />,
        'star': <Star size={size} color={color} />,
        'notifications': <Bell size={size} color={color} />,
        'home': <Home size={size} color={color} />,
        'briefcase': <Briefcase size={size} color={color} />,
        'time': <Clock size={size} color={color} />,
        'analytics': <BarChart3 size={size} color={color} />,
        'card': <Document size={size} color={color} />,
        'video': <PlayCircle size={size} color={color} />,
    };

    return iconMap[iconName] || <Plus size={size} color={color} />;
};

const QuickActionsMenu: React.FC<QuickActionsMenuProps> = ({ isVisible, onClose }) => {
    const navigation = useNavigation();

    const quickActions = [
        {
            id: 'myServices',
            title: 'Mes Services',
            icon: 'briefcase',
            onPress: () => {
                (navigation as any).navigate('Main', { screen: 'Services' });
                onClose();
            }
        },
        {
            id: 'history',
            title: 'Mon Historique',
            icon: 'time',
            onPress: () => {
                navigation.navigate('SoldeDetail' as never);
                onClose();
            }
        },
        {
            id: 'recharge',
            title: 'Recharger Tokens',
            icon: 'card',
            onPress: () => {
                navigation.navigate('RechargeTokens' as never);
                onClose();
            }
        },
        {
            id: 'videoFeed',
            title: 'Flux Vidéo',
            icon: 'video',
            onPress: () => {
                navigation.navigate('VideoFeed' as never);
                onClose();
            }
        },
        {
            id: 'videoAnalytics',
            title: 'Analyse Vidéo',
            icon: 'analytics',
            onPress: () => {
                navigation.navigate('VideoAnalytics' as never);
                onClose();
            }
        },
        {
            id: 'settings',
            title: 'Paramètres',
            icon: 'settings',
            onPress: () => {
                navigation.navigate('Settings' as never);
                onClose();
            }
        }
    ];

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <View style={styles.menuContainer}>
                    <View style={styles.menuHeader}>
                        <Text style={styles.menuTitle}>Actions rapides</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.actionsGrid}>
                        {quickActions.map((action) => (
                            <TouchableOpacity
                                key={action.id}
                                style={styles.actionItem}
                                onPress={action.onPress}
                            >
                                <View style={styles.actionIcon}>
                                    {getActionIcon(action.icon, 24, theme.colors.primary)}
                                </View>
                                <Text style={styles.actionText}>{action.title}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuContainer: {
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        padding: 20,
        width: '90%',
        maxWidth: 400,
        elevation: 8,
    },
    menuHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    menuTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    closeButton: {
        padding: 4,
    },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    actionItem: {
        width: '48%',
        alignItems: 'center',
        padding: 16,
        marginBottom: 16,
        backgroundColor: theme.colors.background,
        borderRadius: 12,
        elevation: 2,
    },
    actionIcon: {
        marginBottom: 8,
    },
    actionText: {
        fontSize: 14,
        color: theme.colors.text,
        textAlign: 'center',
        fontWeight: '500',
    },
});

export default QuickActionsMenu;




