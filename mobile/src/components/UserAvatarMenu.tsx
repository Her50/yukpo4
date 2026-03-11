import React, { useState } from 'react';
import { Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { theme } from '../theme/theme';
import { isAdminUser } from '../utils/roleHelpers'; // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin
import WeatherWidget from './WeatherWidget';

interface UserAvatarMenuProps {
    onNavigate: (route: string) => void;
    balance?: number;
    weatherLocation?: { lat: number; lng: number } | null;
}

const UserAvatarMenu: React.FC<UserAvatarMenuProps> = ({ onNavigate, balance = 0, weatherLocation }) => {
    const { user, logout } = useAuth();
    const { language, setLanguage } = useLanguageSafe();
    const [showMenu, setShowMenu] = useState(false);

    // ✅ AMÉLIORATION UX ADMIN: Menu simplifié pour les administrateurs
    // Prioriser les liens d'administration et retirer les éléments inutiles
    // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin
    const isAdmin = isAdminUser(user);

    const menuItems = isAdmin ? [
        // ✅ SECTION ADMIN: Liens d'administration en priorité
        {
            title: 'Gérer les coursiers',
            icon: '👥',
            route: 'CourierAdmin',
            description: 'Valider les candidatures de coursiers',
            highlighted: true,
            adminOnly: true
        },
        {
            title: 'Gérer les partenaires',
            icon: '🚚',
            route: 'DeliveryPartnersAdmin',
            description: 'Valider les candidatures et gérer les partenaires',
            highlighted: true,
            adminOnly: true
        },
        {
            title: 'Gestion des rôles',
            icon: '👤',
            route: 'UserRoleManagement',
            description: 'Gérer les rôles des utilisateurs',
            highlighted: true,
            adminOnly: true
        },
        {
            title: 'Prestataires externes',
            icon: '🔑',
            route: 'ExternalProvidersAdmin',
            description: 'Gérer les prestataires et envoyer les clés API',
            highlighted: true,
            adminOnly: true
        },
        {
            title: '🔥 Configuration Black Friday',
            icon: '🔥',
            route: 'BlackFridayAdminConfig',
            description: 'Gérer les campagnes Black Friday',
            highlighted: true,
            adminOnly: true
        },
        // ✅ SÉPARATEUR VISUEL: Déconnexion toujours visible en bas
        {
            title: 'Déconnexion',
            icon: '🚪',
            route: 'logout',
            description: 'Se déconnecter de l\'application',
            isSeparator: true
        }
    ] : [
        // ✅ MENU UTILISATEUR STANDARD: Pour les non-admins
        // ✅ NOUVEAU: Langue en premier (drapeau)
        {
            title: language === 'fr' ? '🇫🇷 Français' : language === 'en' ? '🇬🇧 English' : language === 'es' ? '🇪🇸 Español' : '🌐 Langue',
            icon: language === 'fr' ? '🇫🇷' : language === 'en' ? '🇬🇧' : language === 'es' ? '🇪🇸' : '🌐',
            route: 'language',
            description: language === 'fr' ? 'Changer la langue' : language === 'en' ? 'Change language' : language === 'es' ? 'Cambiar idioma' : 'Change language',
            isLanguageSelector: true
        },
        // ✅ NOUVEAU 2026-01-XX: Navigation intelligente en deuxième position
        {
            title: 'Navigation intelligente',
            icon: '🧭',
            route: 'NavigationScreen',
            description: 'Trouvez le meilleur chemin avec embouteillages et points d\'intérêt',
            highlighted: true
        },
        // ✅ AMÉLIORÉ 2026-01-23: Produits consultés en deuxième position
        {
            title: 'Produits consultés',
            icon: '🕐',
            route: 'HistoriqueProduitsConsultes',
            description: 'Voir les produits que vous avez consultés'
        },
        {
            title: 'Mes Suivis',
            icon: '❤️',
            route: 'MesSuivis',
            description: 'Vendeurs et prestataires que vous suivez'
        },
        {
            title: 'Mon historique',
            icon: '📊',
            route: 'SoldeDetail',
            description: 'Voir mon historique de transactions'
        },
        {
            title: 'Devenir coursier Yukpo',
            icon: '🚴',
            route: 'CourierRegistration',
            description: 'Rejoignez notre équipe de coursiers'
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
        } else if (item.route === 'language') {
            // ✅ NOUVEAU: Gérer le changement de langue
            const languages = [
                { code: 'fr', name: '🇫🇷 Français', flag: '🇫🇷' },
                { code: 'en', name: '🇬🇧 English', flag: '🇬🇧' },
                { code: 'es', name: '🇪🇸 Español', flag: '🇪🇸' }
            ];

            // Trouver la langue suivante dans la liste
            const currentIndex = languages.findIndex(lang => lang.code === language);
            const nextIndex = (currentIndex + 1) % languages.length;
            const nextLanguage = languages[nextIndex];

            setLanguage(nextLanguage.code);
        } else if (item.route === 'BlackFridayAdminConfig') {
            // ✅ NOUVEAU : Navigation vers la configuration de lancement Black Friday (admin)
            onNavigate('GlobalPromoManager');
        } else {
            onNavigate(item.route);
        }
    };

    const getInitials = (name: string) => {
        if (!name || typeof name !== 'string') return 'U';
        // ✅ Filtrer les mots vides et s'assurer qu'ils ont au moins un caractère
        const words = name.trim().split(/\s+/).filter(word => word.length > 0);
        if (words.length >= 2) {
            // ✅ Prendre uniquement les deux premières lettres (une par mot)
            const firstLetter = words[0] && words[0].length > 0 ? words[0][0] : '';
            const secondLetter = words[1] && words[1].length > 0 ? words[1][0] : '';
            const initials = (firstLetter + secondLetter).toUpperCase().slice(0, 2);
            // ✅ S'assurer qu'on retourne seulement les initiales, pas le nom complet
            return initials.length > 0 ? initials : 'U';
        }
        // ✅ Si un seul mot, prendre les deux premières lettres
        if (words.length === 1 && words[0].length >= 2) {
            return words[0].substring(0, 2).toUpperCase();
        }
        // ✅ Si un seul mot avec une seule lettre, prendre cette lettre
        if (words.length === 1 && words[0].length === 1) {
            return words[0].toUpperCase();
        }
        // ✅ Fallback - s'assurer qu'on retourne seulement une lettre
        const firstChar = name.trim()[0];
        return firstChar ? firstChar.toUpperCase() : 'U';
    };

    return (
        <>
            {/* Avatar cliquable */}
            <TouchableOpacity
                style={styles.avatarContainer}
                onPress={() => setShowMenu(true)}
            >
                {user?.avatar || user?.photo ? (
                    <Image source={{ uri: user.avatar || user.photo }} style={styles.avatarImage} />
                ) : (
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText} numberOfLines={1} ellipsizeMode="clip">
                            {(() => {
                                const initials = getInitials(user?.name || 'Utilisateur');
                                // ✅ S'assurer qu'on affiche seulement les initiales (max 2 caractères)
                                return initials.length > 2 ? initials.substring(0, 2) : initials;
                            })()}
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
                                {user?.avatar || user?.photo ? (
                                    <Image source={{ uri: user.avatar || user.photo }} style={styles.menuAvatarImage} />
                                ) : (
                                    <View style={styles.menuAvatarPlaceholder}>
                                        <Text style={styles.menuAvatarText}>
                                            {getInitials(user?.name || 'Utilisateur')}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <View style={styles.menuUserInfo}>
                                <Text style={styles.menuUserName} numberOfLines={1}>
                                    {(() => {
                                        const userName = user?.name || 'Utilisateur';
                                        // ✅ Nettoyer le nom pour éviter les doublons
                                        if (typeof userName === 'string') {
                                            // Supprimer les espaces multiples
                                            const cleaned = userName.trim().replace(/\s+/g, ' ');
                                            const words = cleaned.split(' ').filter(w => w.length > 0);

                                            if (words.length === 0) return 'Utilisateur';

                                            // ✅ Cas 1: Vérifier si la première moitié = deuxième moitié (ex: "LELE Hernandez LELE Hernandez")
                                            if (words.length >= 4 && words.length % 2 === 0) {
                                                const midPoint = words.length / 2;
                                                const firstHalf = words.slice(0, midPoint).join(' ');
                                                const secondHalf = words.slice(midPoint).join(' ');

                                                if (firstHalf === secondHalf) {
                                                    return firstHalf;
                                                }
                                            }

                                            // ✅ Cas 2: Vérifier si les 2 premiers mots se répètent (ex: "LELE Hernandez LELE Hernandez")
                                            if (words.length >= 4) {
                                                const firstTwo = words.slice(0, 2).join(' ');
                                                const nextTwo = words.slice(2, 4).join(' ');

                                                if (firstTwo === nextTwo) {
                                                    return firstTwo; // Retourner seulement les 2 premiers mots
                                                }
                                            }

                                            // ✅ Cas 3: Détecter les répétitions de patterns plus complexes
                                            // Si on a un nombre pair de mots >= 4, vérifier les patterns
                                            if (words.length >= 4) {
                                                // Vérifier si les mots se répètent en pattern (ex: A B A B ou A B C A B C)
                                                for (let patternLength = 2; patternLength <= Math.floor(words.length / 2); patternLength++) {
                                                    const pattern = words.slice(0, patternLength).join(' ');
                                                    const nextPattern = words.slice(patternLength, patternLength * 2).join(' ');

                                                    if (pattern === nextPattern) {
                                                        // Vérifier si le reste correspond aussi au pattern
                                                        const remainingWords = words.slice(patternLength * 2);
                                                        if (remainingWords.length === 0 || remainingWords.join(' ') === pattern) {
                                                            return pattern;
                                                        }
                                                    }
                                                }
                                            }

                                            return cleaned;
                                        }
                                        return userName;
                                    })()}
                                </Text>
                                <Text style={styles.menuUserEmail} numberOfLines={1}>
                                    {user?.email || 'email@example.com'}
                                </Text>
                            </View>
                        </View>

                        {/* ✅ Solde et Météo intégrés dans le menu */}
                        <View style={styles.balanceWeatherContainer}>
                            {/* Solde */}
                            <TouchableOpacity
                                style={styles.balanceCard}
                                onPress={() => {
                                    setShowMenu(false);
                                    onNavigate('SoldeDetail');
                                }}
                            >
                                <Text style={styles.balanceLabel}>Solde</Text>
                                <Text style={styles.balanceAmount}>
                                    {(balance != null ? balance : 0).toLocaleString('fr-FR')} <Text style={styles.balanceCurrency}>FCFA</Text>
                                </Text>
                            </TouchableOpacity>

                            {/* Météo */}
                            <View style={styles.weatherCard}>
                                <WeatherWidget location={weatherLocation} compact={true} />
                            </View>
                        </View>

                        {/* Items du menu */}
                        <ScrollView style={styles.menuItemsScroll} showsVerticalScrollIndicator={true} bounces={false}>
                            {menuItems.map((item, index) => {
                                // ✅ SÉPARATEUR VISUEL: Ajouter un séparateur avant la déconnexion pour les admins
                                const showSeparator = item.isSeparator && isAdmin && index > 0;

                                return (
                                    <React.Fragment key={index}>
                                        {showSeparator && (
                                            <View style={styles.separator} />
                                        )}
                                        <TouchableOpacity
                                            style={[
                                                styles.menuItem,
                                                item.route === 'logout' && styles.logoutItem,
                                                item.highlighted && styles.highlightedItem,
                                                item.isLanguageSelector && styles.languageSelectorItem
                                            ]}
                                            onPress={() => handleMenuItemPress(item)}
                                        >
                                            <Text style={[
                                                styles.menuItemIcon,
                                                item.isLanguageSelector && styles.languageSelectorIcon
                                            ]}>{item.icon}</Text>
                                            <View style={styles.menuItemContent}>
                                                <Text style={[
                                                    styles.menuItemTitle,
                                                    item.route === 'logout' && styles.logoutText,
                                                    item.highlighted && styles.highlightedText,
                                                    item.isLanguageSelector && styles.languageSelectorText
                                                ]}>
                                                    {item.title}
                                                </Text>
                                                <Text style={[
                                                    styles.menuItemDescription,
                                                    item.isLanguageSelector && styles.languageSelectorDescription
                                                ]}>{item.description}</Text>
                                            </View>
                                            {item.highlighted && (
                                                <View style={styles.highlightedBadge}>
                                                    <Text style={styles.highlightedBadgeText}>⚡</Text>
                                                </View>
                                            )}
                                            {item.isLanguageSelector && (
                                                <View style={styles.languageSelectorBadge}>
                                                    <Text style={styles.languageSelectorBadgeText}>↻</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    </React.Fragment>
                                );
                            })}
                        </ScrollView>
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
        textAlign: 'center',
        maxWidth: 40,
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
        maxHeight: Dimensions.get('window').height * 0.75,
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
    menuItemsScroll: {
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
    // ✅ Styles pour le solde et la météo
    balanceWeatherContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    balanceCard: {
        flex: 1,
        backgroundColor: '#F0FDF4',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#10B981',
    },
    balanceLabel: {
        fontSize: 12,
        color: '#059669',
        fontWeight: '600',
        marginBottom: 4,
    },
    balanceAmount: {
        fontSize: 18,
        color: '#047857',
        fontWeight: '700',
    },
    balanceCurrency: {
        fontSize: 12,
        color: '#059669',
        fontWeight: '600',
    },
    weatherCard: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // ✅ Styles pour l'item mis en évidence
    highlightedItem: {
        backgroundColor: '#FEF3C7',
        borderLeftWidth: 4,
        borderLeftColor: '#F59E0B',
    },
    highlightedText: {
        color: '#D97706',
        fontWeight: '700',
    },
    highlightedBadge: {
        backgroundColor: '#F59E0B',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    highlightedBadgeText: {
        fontSize: 14,
    },
    // ✅ SÉPARATEUR VISUEL: Pour séparer les sections admin de la déconnexion
    separator: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 8,
        marginHorizontal: 20,
    },
    // ✅ Styles pour le sélecteur de langue
    languageSelectorItem: {
        backgroundColor: '#EFF6FF',
        borderLeftWidth: 4,
        borderLeftColor: '#3B82F6',
    },
    languageSelectorIcon: {
        fontSize: 20,
    },
    languageSelectorText: {
        color: '#1D4ED8',
        fontWeight: '700',
    },
    languageSelectorDescription: {
        color: '#3B82F6',
        fontWeight: '500',
    },
    languageSelectorBadge: {
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        paddingHorizontal: 6,
        paddingVertical: 3,
        marginLeft: 8,
    },
    languageSelectorBadgeText: {
        fontSize: 12,
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
});

export default UserAvatarMenu;


