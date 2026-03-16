/**
 * SidebarNavigation - Navigation latérale persistante (inspiré Shopify/Amazon)
 * Remplace le menu dropdown pour meilleure navigation
 */

import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

const { width } = Dimensions.get('window');

interface SidebarItem {
    id: string;
    label: string;
    icon: string;
    onPress: () => void;
    badge?: number;
    color?: string;
    section?: string;
}

interface SidebarNavigationProps {
    visible: boolean;
    onClose: () => void;
    items: SidebarItem[];
    currentRoute?: string;
}

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
    visible,
    onClose,
    items,
    currentRoute,
}) => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();

    // Grouper les items par section
    const groupedItems = React.useMemo(() => {
        const groups: Record<string, SidebarItem[]> = {};
        items.forEach(item => {
            const section = item.section || 'Autres';
            if (!groups[section]) {
                groups[section] = [];
            }
            groups[section].push(item);
        });
        return groups;
    }, [items]);

    const sections = Object.keys(groupedItems);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity
                    style={styles.backdrop}
                    activeOpacity={1}
                    onPress={onClose}
                />
                <View style={styles.sidebar}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerContent}>
                            <SafeIcon name="briefcase" size={24} color="#fff" />
                            <Text style={styles.headerTitle}>{t('sidebarNavigation.mesServices')}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={onClose}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <SafeIcon name="x" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {/* Navigation Items */}
                    <View style={styles.content}>
                        {sections.map((section, sectionIndex) => (
                            <View key={section} style={styles.section}>
                                {sectionIndex > 0 && <View style={styles.sectionDivider} />}
                                <Text style={styles.sectionTitle}>{section}</Text>
                                {groupedItems[section].map((item) => {
                                    const isActive = currentRoute === item.id;
                                    return (
                                        <TouchableOpacity
                                            key={item.id}
                                            style={[
                                                styles.menuItem,
                                                isActive && styles.menuItemActive,
                                            ]}
                                            onPress={() => {
                                                item.onPress();
                                                onClose();
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.menuItemContent}>
                                                <View
                                                    style={[
                                                        styles.menuItemIcon,
                                                        isActive && { backgroundColor: item.color || modernColors.primary + '20' },
                                                    ]}
                                                >
                                                    <SafeIcon
                                                        name={item.icon}
                                                        size={20}
                                                        color={isActive ? (item.color || modernColors.primary) : modernColors.textSecondary}
                                                    />
                                                </View>
                                                <Text
                                                    style={[
                                                        styles.menuItemText,
                                                        isActive && styles.menuItemTextActive,
                                                    ]}
                                                >
                                                    {item.label}
                                                </Text>
                                            </View>
                                            {item.badge !== undefined && item.badge > 0 && (
                                                <View style={styles.badge}>
                                                    <Text style={styles.badgeText}>{item.badge}</Text>
                                                </View>
                                            )}
                                            {isActive && (
                                                <View style={styles.activeIndicator} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        flexDirection: 'row',
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    sidebar: {
        width: Math.min(width * 0.85, 320),
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: -2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    header: {
        backgroundColor: modernColors.primary,
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    closeButton: {
        padding: 8,
    },
    content: {
        flex: 1,
        paddingTop: 8,
    },
    section: {
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        paddingHorizontal: 20,
        paddingVertical: 12,
        marginTop: 8,
    },
    sectionDivider: {
        height: 1,
        backgroundColor: modernColors.borderLight,
        marginHorizontal: 20,
        marginVertical: 8,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 20,
        position: 'relative',
    },
    menuItemActive: {
        backgroundColor: modernColors.primary + '08',
    },
    menuItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    menuItemIcon: {
        width: 36,
        height: 36,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    menuItemText: {
        fontSize: 15,
        fontWeight: '500',
        color: modernColors.text,
    },
    menuItemTextActive: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    badge: {
        backgroundColor: modernColors.error,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
        marginLeft: 8,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
    },
    activeIndicator: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: modernColors.primary,
        borderTopRightRadius: 2,
        borderBottomRightRadius: 2,
    },
});

