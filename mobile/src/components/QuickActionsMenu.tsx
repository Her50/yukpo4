import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../theme/theme';

interface QuickActionsMenuProps {
    isVisible: boolean;
    onClose: () => void;
}

const QuickActionsMenu: React.FC<QuickActionsMenuProps> = ({ isVisible, onClose }) => {
    const navigation = useNavigation();

    const quickActions = [
        {
            id: 'myServices',
            title: 'Mes Services',
            icon: 'briefcase',
            onPress: () => {
                navigation.navigate('MyServices' as never);
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
            id: 'dashboard',
            title: 'Dashboard',
            icon: 'analytics',
            onPress: () => {
                navigation.navigate('Dashboard' as never);
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
                            <Ionicons name="close" size={24} color={theme.colors.text} />
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
                                    <Ionicons name={action.icon as any} size={24} color={theme.colors.primary} />
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




