// ✅ NOUVEAU 2026-03-05: Layout partagé pour tous les dashboards prestataire
// Fournit: header gradient, tabs, stats grid, quick actions, empty state, refresh
// Utilisé par: PharmacieForm, HopitalForm, LaboratoireForm, AgenceVoyageForm, etc.

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from './SafeIcon';
import { NativeButton } from './SafeNativeDesign';
import { modernColors } from '../theme/modernTheme';

// ============ TYPES ============

export interface DashboardTab {
    key: string;
    label: string;
    icon: string;
}

export interface StatCard {
    label: string;
    value: string | number;
    icon: string;
    color: string;
}

export interface QuickAction {
    label: string;
    icon: string;
    color: string;
    onPress: () => void;
}

interface PartnerDashboardLayoutProps {
    // Header
    title: string;
    subtitle?: string;
    gradientColors?: string[];
    headerIcon?: string;
    onBack: () => void;
    onScanQR?: () => void;

    // Tabs
    tabs: DashboardTab[];
    activeTab: string;
    onTabChange: (tab: string) => void;

    // Loading
    loading?: boolean;
    refreshing?: boolean;
    onRefresh?: () => void;

    // Content
    children: React.ReactNode;
}

// ============ COMPONENT ============

const PartnerDashboardLayout: React.FC<PartnerDashboardLayoutProps> = ({
    title,
    subtitle,
    gradientColors = ['#1E3A5F', '#2563EB'],
    onBack,
    onScanQR,
    tabs,
    activeTab,
    onTabChange,
    loading,
    refreshing,
    onRefresh,
    children,
}) => {
    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement de votre espace...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Gradient Header */}
            <LinearGradient colors={gradientColors as any} style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <SafeIcon name="arrow-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>{title}</Text>
                        {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
                    </View>
                    {onScanQR && (
                        <TouchableOpacity onPress={onScanQR} style={styles.headerAction}>
                            <SafeIcon name="scan" size={22} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Tabs */}
                <View style={styles.tabsContainer}>
                    {tabs.map(tab => (
                        <TouchableOpacity
                            key={tab.key}
                            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                            onPress={() => onTabChange(tab.key)}
                        >
                            <SafeIcon
                                name={tab.icon as any}
                                size={15}
                                color={activeTab === tab.key ? '#fff' : '#ffffff70'}
                            />
                            <Text style={[
                                styles.tabLabel,
                                activeTab === tab.key && styles.tabLabelActive,
                            ]}>{tab.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </LinearGradient>

            {/* Content */}
            <View style={styles.content}>
                {children}
            </View>
        </View>
    );
};

// ============ SUB-COMPONENTS ============

export const StatsGrid: React.FC<{ stats: StatCard[] }> = ({ stats }) => (
    <View style={styles.statsGrid}>
        {stats.map((stat, i) => (
            <View key={i} style={[styles.statCard, { borderLeftColor: stat.color }]}>
                <SafeIcon name={stat.icon as any} size={20} color={stat.color} />
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
        ))}
    </View>
);

export const QuickActionsRow: React.FC<{ actions: QuickAction[] }> = ({ actions }) => (
    <View style={styles.quickActionsRow}>
        {actions.map((action, i) => (
            <TouchableOpacity key={i} style={styles.quickAction} onPress={action.onPress}>
                <View style={[styles.quickActionIcon, { backgroundColor: action.color + '15' }]}>
                    <SafeIcon name={action.icon as any} size={22} color={action.color} />
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={2}>{action.label}</Text>
            </TouchableOpacity>
        ))}
    </View>
);

export const SectionTitle: React.FC<{ title: string; count?: number; onAction?: () => void; actionLabel?: string }> = ({
    title, count, onAction, actionLabel,
}) => (
    <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
            {title}{count !== undefined ? ` (${count})` : ''}
        </Text>
        {onAction && (
            <TouchableOpacity onPress={onAction} style={styles.sectionAction}>
                <Text style={styles.sectionActionText}>{actionLabel || 'Voir tout'}</Text>
                <SafeIcon name="chevron-right" size={14} color={modernColors.primary} />
            </TouchableOpacity>
        )}
    </View>
);

export const EmptyState: React.FC<{
    icon: string;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
}> = ({ icon, title, description, actionLabel, onAction }) => (
    <View style={styles.emptyState}>
        <SafeIcon name={icon as any} size={48} color={modernColors.textSecondary} />
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyText}>{description}</Text>
        {actionLabel && onAction && (
            <NativeButton
                title={actionLabel}
                onPress={onAction}
                style={{ marginTop: 16, backgroundColor: modernColors.primary }}
            />
        )}
    </View>
);

export const InfoCard: React.FC<{
    icon: string;
    iconColor: string;
    label: string;
    value: string;
    onPress?: () => void;
}> = ({ icon, iconColor, label, value, onPress }) => (
    <TouchableOpacity
        style={styles.infoCard}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={onPress ? 0.7 : 1}
    >
        <View style={[styles.infoCardIcon, { backgroundColor: iconColor + '15' }]}>
            <SafeIcon name={icon as any} size={18} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={styles.infoCardLabel}>{label}</Text>
            <Text style={styles.infoCardValue} numberOfLines={2}>{value}</Text>
        </View>
        {onPress && <SafeIcon name="chevron-right" size={16} color="#9CA3AF" />}
    </TouchableOpacity>
);

// ============ STYLES ============

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    loadingText: { marginTop: 12, fontSize: 15, color: modernColors.textSecondary, fontWeight: '500' },

    // Header
    header: { paddingTop: 50, paddingBottom: 8, paddingHorizontal: 16 },
    headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    backButton: { marginRight: 12, padding: 4 },
    headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
    headerSubtitle: { fontSize: 13, color: '#ffffffCC', marginTop: 2 },
    headerAction: { padding: 8, backgroundColor: '#ffffff20', borderRadius: 10 },

    // Tabs
    tabsContainer: { flexDirection: 'row', gap: 4, paddingBottom: 8 },
    tab: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 4, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8, backgroundColor: '#ffffff15',
    },
    tabActive: { backgroundColor: '#ffffff30' },
    tabLabel: { fontSize: 11, color: '#ffffff70', fontWeight: '500' },
    tabLabelActive: { color: '#fff', fontWeight: '700' },

    // Content
    content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

    // Stats
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    statCard: {
        flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 12, padding: 14,
        borderLeftWidth: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    statValue: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 8 },
    statLabel: { fontSize: 12, color: modernColors.textSecondary, marginTop: 2 },

    // Quick Actions
    quickActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    quickAction: { flex: 1, alignItems: 'center', gap: 6 },
    quickActionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    quickActionLabel: { fontSize: 11, color: '#374151', fontWeight: '500', textAlign: 'center' },

    // Section
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
    sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    sectionActionText: { fontSize: 13, color: modernColors.primary, fontWeight: '600' },

    // Empty state
    emptyState: { alignItems: 'center', padding: 32, backgroundColor: '#fff', borderRadius: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 16 },
    emptyText: { fontSize: 14, color: modernColors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },

    // Info Card
    infoCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
        backgroundColor: '#fff', borderRadius: 10, marginBottom: 8,
        borderWidth: 1, borderColor: '#F3F4F6',
    },
    infoCardIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    infoCardLabel: { fontSize: 12, color: modernColors.textSecondary, marginBottom: 2 },
    infoCardValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
});

export default PartnerDashboardLayout;
