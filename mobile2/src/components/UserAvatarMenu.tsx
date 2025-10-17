import React, { useState } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../theme/theme';

interface UserAvatarMenuProps {
    onNavigate: (route: string) => void;
}

const UserAvatarMenu: React.FC<UserAvatarMenuProps> = ({ onNavigate }) => {
    const { user, logout } = useAuth();
    const [showMenu, setShowMenu] = useState(false);

    const menuItems = [
        {
            title: 'Mon historique',
            icon: '📊',
            route: 'Historique',
            description: 'Voir mon historique de transactions'
        },
        {
            title: 'Recharger Tokens',
            icon: '💰',
            route: 'RechargeTokens',
            description: 'Ajouter des tokens à votre compte'
        },
        {
            title: 'Paramètres',
            icon: '⚙️',
            route: 'Settings',
            description: 'Configurer votre compte'
        },
        {
            title: 'Contacter le Support',
            icon: '💬',
            route: 'Contact',
            description: 'Besoin d\'aide ?'
        },
        {
            title: 'Déconnexion',
            icon: '🚪',
            route: 'logout',
            description: 'Se déconnecter de l\'application'
        }
    ];

    const handleMenuItemPress = (item: any) => {
        setShowMenu(false);

        if (item.route === 'logout') {
            logout();
        } else {
            onNavigate(item.route);
        }
    };

    const getInitials = (name: string) => {
        if (!name) return 'U';
        const words = name.split(' ');
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        return name[0].toUpperCase();
    };

    return (
        <>
            {/* Avatar cliquable */}
            <TouchableOpacity
                style={styles.avatarContainer}
                onPress={() => setShowMenu(true)}
            >
                {user?.avatar ? (
                    <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
                ) : (
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>
                            {getInitials(user?.name || 'Utilisateur')}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>

            {/* Menu déroulant */}
            <Modal
                visible={showMenu}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowMenu(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowMenu(false)}
                >
                    <View style={styles.menuContainer}>
                        {/* Header du menu */}
                        <View style={styles.menuHeader}>
                            <View style={styles.menuAvatar}>
                                {user?.avatar ? (
                                    <Image source={{ uri: user.avatar }} style={styles.menuAvatarImage} />
                                ) : (
                                    <View style={styles.menuAvatarPlaceholder}>
                                        <Text style={styles.menuAvatarText}>
                                            {getInitials(user?.name || 'Utilisateur')}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <View style={styles.menuUserInfo}>
                                <Text style={styles.menuUserName}>{user?.name || 'Utilisateur'}</Text>
                                <Text style={styles.menuUserEmail}>{user?.email || 'email@example.com'}</Text>
                            </View>
                        </View>

                        {/* Items du menu */}
                        <View style={styles.menuItems}>
                            {menuItems.map((item, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.menuItem,
                                        item.route === 'logout' && styles.logoutItem
                                    ]}
                                    onPress={() => handleMenuItemPress(item)}
                                >
                                    <Text style={styles.menuItemIcon}>{item.icon}</Text>
                                    <View style={styles.menuItemContent}>
                                        <Text style={[
                                            styles.menuItemTitle,
                                            item.route === 'logout' && styles.logoutText
                                        ]}>
                                            {item.title}
                                        </Text>
                                        <Text style={styles.menuItemDescription}>{item.description}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    avatarContainer: {
        marginRight: 12,
    },
    avatarImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    avatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#10B981', // Vert moderne
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-start',
        paddingTop: 60,
    },
    menuContainer: {
        backgroundColor: 'white',
        marginHorizontal: 20,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    menuHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    menuAvatar: {
        marginRight: 12,
    },
    menuAvatarImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    menuAvatarPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuAvatarText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    menuUserInfo: {
        flex: 1,
    },
    menuUserName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    menuUserEmail: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginTop: 2,
    },
    menuItems: {
        paddingVertical: 8,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F9FAFB',
    },
    logoutItem: {
        borderBottomWidth: 0,
    },
    menuItemIcon: {
        fontSize: 20,
        marginRight: 16,
        width: 24,
        textAlign: 'center',
    },
    menuItemContent: {
        flex: 1,
    },
    menuItemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
    },
    logoutText: {
        color: '#EF4444',
    },
    menuItemDescription: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginTop: 2,
    },
});

export default UserAvatarMenu;


