import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../SafeIcon';
import { NativeCard } from '../SafeNativeDesign';
import { modernColors } from '../../theme/modernTheme';
import { bourseLivreV2Api, BookDeliveryPackage, BookPurchase } from '../../services/bourseLivreV2Api';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface BookUserSubDashboardProps {
    onRefresh?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
    a_constituer: t('bookUserSubDashboard.aConstituer'),
    constitue: t('bookUserSubDashboard.constitue'),
    en_route: 'En route',
    livre: t('bookUserSubDashboard.livre'),
    confirme: t('bookUserSubDashboard.confirme'),
    en_attente: 'En attente',
    en_livraison: 'En livraison',
    paye: t('bookUserSubDashboard.paye'),
    annule: t('bookUserSubDashboard.annule'),
};

const STATUS_COLORS: Record<string, string> = {
    a_constituer: '#F59E0B',
    constitue: '#3B82F6',
    en_route: '#8B5CF6',
    livre: '#10B981',
    confirme: '#059669',
    en_attente: '#F59E0B',
    en_livraison: '#8B5CF6',
    paye: '#3B82F6',
    annule: '#EF4444',
};

const BookUserSubDashboard: React.FC<BookUserSubDashboardProps> = ({ onRefresh }) => {
        const { t } = useLanguageSafe();
const [loading, setLoading] = useState(true);
    const [paquetsAEnvoyer, setPaquetsAEnvoyer] = useState<BookDeliveryPackage[]>([]);
    const [paquetsARecevoir, setPaquetsARecevoir] = useState<BookDeliveryPackage[]>([]);
    const [achatsEnCours, setAchatsEnCours] = useState<BookPurchase[]>([]);
    const [historique, setHistorique] = useState<BookDeliveryPackage[]>([]);
    const [stats, setStats] = useState({ total_envoyes: 0, total_recus: 0, en_cours_envoi: 0, en_cours_reception: 0 });
    const [expanded, setExpanded] = useState(true);
    const [activeTab, setActiveTab] = useState<'recevoir' | 'envoyer' | 'achats' | 'historique'>('recevoir');

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const data = await bourseLivreV2Api.getUserBookDashboard();
            setPaquetsAEnvoyer(data.paquets_a_envoyer);
            setPaquetsARecevoir(data.paquets_a_recevoir);
            setAchatsEnCours(data.achats_en_cours);
            setHistorique(data.historique);
            setStats(data.stats);
        } catch (err) {
            console.warn('[BookUserSubDashboard] Erreur:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const renderPackageCard = (pkg: BookDeliveryPackage) => {
        const statusColor = STATUS_COLORS[pkg.statut] || modernColors.textSecondary;
        const statusLabel = STATUS_LABELS[pkg.statut] || pkg.statut;

        return (
            <NativeCard key={`pkg-${pkg.id}`} style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.cardTitleRow}>
                        <SafeIcon name="book-open" size={16} color={modernColors.primary} />
                        <Text style={styles.cardRef}>{pkg.reference}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                </View>

                <View style={styles.cardBody}>
                    <View style={styles.infoRow}>
                        <SafeIcon name="package" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.infoText}>{pkg.nombre_livres} livre(s)</Text>
                    </View>

                    {pkg.matching_status && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="search" size={14} color={
                                pkg.matching_status === 'matched' ? '#10B981' :
                                pkg.matching_status === 'searching' ? '#F59E0B' : '#9CA3AF'
                            } />
                            <Text style={styles.infoText}>
                                {pkg.matching_status === 'matched' ? t('bookUserSubDashboard.coursierAssigne') :
                                 pkg.matching_status === 'searching' ? 'Recherche de coursier...' :
                                 pkg.matching_status === 'no_courier' ? 'Aucun coursier disponible' : 'En attente'}
                            </Text>
                        </View>
                    )}

                    {pkg.eta_minutes != null && pkg.eta_minutes > 0 && pkg.statut === 'en_route' && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="clock" size={14} color="#F59E0B" />
                            <Text style={styles.infoText}>{t('bookUserSubDashboard.estimatedArrival')}: ~{pkg.eta_minutes} min</Text>
                        </View>
                    )}

                    {pkg.coursier_gps_actuel && pkg.statut === 'en_route' && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="navigation" size={14} color="#8B5CF6" />
                            <Text style={styles.infoText}>{t('bookUserSubDashboard.coursierEnDeplacement')}</Text>
                        </View>
                    )}

                    {pkg.frais_livraison > 0 && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="credit-card" size={14} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>Livraison: {Math.round(pkg.frais_livraison)} XAF</Text>
                        </View>
                    )}
                </View>

                {/* Créneaux */}
                {(pkg.creneau_destinataire_debut || pkg.creneau_expediteur_debut) && (
                    <View style={styles.creneauSection}>
                        <SafeIcon name="calendar" size={12} color="#92400E" />
                        <Text style={styles.creneauText}>
                            {pkg.creneau_destinataire_debut
                                ? t('bookUserSubDashboard.creneau', { new_Date_pkg_creneau_dest: new Date(pkg.creneau_destinataire_debut).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'  })
                                : pkg.creneau_expediteur_debut
                                ? t('bookUserSubDashboard.expedition', { new Date(pkg_creneau_expediteur_debut)_toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' : new Date(pkg.creneau_expediteur_debut).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'  })
                                : ''}
                        </Text>
                    </View>
                )}
            </NativeCard>
        );
    };

    const renderPurchaseCard = (purchase: BookPurchase) => {
        const statusColor = STATUS_COLORS[purchase.statut] || modernColors.textSecondary;
        const statusLabel = STATUS_LABELS[purchase.statut] || purchase.statut;

        return (
            <NativeCard key={`pur-${purchase.id}`} style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.cardTitleRow}>
                        <SafeIcon name="shopping-cart" size={16} color="#F59E0B" />
                        <Text style={styles.cardRef}>Achat #{purchase.id}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                </View>
                <View style={styles.cardBody}>
                    <View style={styles.infoRow}>
                        <SafeIcon name="tag" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.infoText}>{purchase.prix_achat} XAF</Text>
                    </View>
                    {purchase.frais_livraison != null && purchase.frais_livraison > 0 && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="truck" size={14} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>Livraison: {Math.round(purchase.frais_livraison)} XAF</Text>
                        </View>
                    )}
                    <View style={styles.infoRow}>
                        <SafeIcon name="credit-card" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.infoText}>
                            Paiement: {purchase.paiement_statut === 'paye' ? t('bookUserSubDashboard.paye') : 'En attente'}
                        </Text>
                    </View>
                </View>
            </NativeCard>
        );
    };

    const tabs = [
        { key: 'recevoir' as const, label: t('bookUserSubDashboard.aRecevoir'), count: paquetsARecevoir.length, icon: 'inbox' },
        { key: 'envoyer' as const, label: t('bookUserSubDashboard.aEnvoyer'), count: paquetsAEnvoyer.length, icon: 'send' },
        { key: 'achats' as const, label: 'Achats', count: achatsEnCours.length, icon: 'shopping-cart' },
        { key: 'historique' as const, label: t('bookUserSubDashboard.historique'), count: historique.length, icon: 'clock' },
    ];

    const totalActive = paquetsARecevoir.length + paquetsAEnvoyer.length + achatsEnCours.length;

    if (loading && totalActive === 0) {
        return (
            <View style={styles.section}>
                <TouchableOpacity style={styles.sectionHeader} onPress={() => setExpanded(!expanded)}>
                    <View style={styles.sectionTitleRow}>
                        <SafeIcon name="book-open" size={20} color="#F59E0B" />
                        <Text style={styles.sectionTitle}>{t('bookUserSubDashboard.mesLivresScolaires')}</Text>
                    </View>
                    <SafeIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={modernColors.textSecondary} />
                </TouchableOpacity>
                {expanded && (
                    <View style={styles.loadingRow}>
                        <ActivityIndicator size="small" color={modernColors.primary} />
                        <Text style={styles.loadingText}>{t('bookUserSubDashboard.chargement')}</Text>
                    </View>
                )}
            </View>
        );
    }

    return (
        <View style={styles.section}>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => setExpanded(!expanded)}>
                <View style={styles.sectionTitleRow}>
                    <SafeIcon name="book-open" size={20} color="#F59E0B" />
                    <Text style={styles.sectionTitle}>{t('bookUserSubDashboard.mesLivresScolaires')}</Text>
                    {totalActive > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{totalActive}</Text>
                        </View>
                    )}
                </View>
                <SafeIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={modernColors.textSecondary} />
            </TouchableOpacity>

            {expanded && (
                <View style={styles.sectionContent}>
                    {/* Stats */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{stats.total_envoyes}</Text>
                            <Text style={styles.statLabel}>{t('bookUserSubDashboard.envoyes')}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{stats.total_recus}</Text>
                            <Text style={styles.statLabel}>{t('bookUserSubDashboard.recus')}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: '#F59E0B' }]}>{stats.en_cours_reception}</Text>
                            <Text style={styles.statLabel}>{t('bookUserSubDashboard.enCours')}</Text>
                        </View>
                    </View>

                    {/* Tabs */}
                    <View style={styles.tabRow}>
                        {tabs.map((tab) => (
                            <TouchableOpacity
                                key={tab.key}
                                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                                onPress={() => setActiveTab(tab.key)}
                            >
                                <SafeIcon
                                    name={tab.icon}
                                    size={14}
                                    color={activeTab === tab.key ? modernColors.primary : modernColors.textSecondary}
                                />
                                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                                    {tab.label}
                                </Text>
                                {tab.count > 0 && (
                                    <View style={[styles.tabBadge, activeTab === tab.key && styles.tabBadgeActive]}>
                                        <Text style={[styles.tabBadgeText, activeTab === tab.key && styles.tabBadgeTextActive]}>
                                            {tab.count}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Content */}
                    <View style={styles.tabContent}>
                        {activeTab === 'recevoir' && (
                            paquetsARecevoir.length > 0
                                ? paquetsARecevoir.map(renderPackageCard)
                                : <View style={styles.emptyState}>
                                    <SafeIcon name="inbox" size={28} color={modernColors.textSecondary} />
                                    <Text style={styles.emptyText}>{t('bookUserSubDashboard.aucunPaquetARecevoir')}</Text>
                                  </View>
                        )}
                        {activeTab === 'envoyer' && (
                            paquetsAEnvoyer.length > 0
                                ? paquetsAEnvoyer.map(renderPackageCard)
                                : <View style={styles.emptyState}>
                                    <SafeIcon name="send" size={28} color={modernColors.textSecondary} />
                                    <Text style={styles.emptyText}>{t('bookUserSubDashboard.aucunPaquetAEnvoyer')}</Text>
                                  </View>
                        )}
                        {activeTab === 'achats' && (
                            achatsEnCours.length > 0
                                ? achatsEnCours.map(renderPurchaseCard)
                                : <View style={styles.emptyState}>
                                    <SafeIcon name="shopping-cart" size={28} color={modernColors.textSecondary} />
                                    <Text style={styles.emptyText}>{t('bookUserSubDashboard.aucunAchatEnCours')}</Text>
                                  </View>
                        )}
                        {activeTab === 'historique' && (
                            historique.length > 0
                                ? historique.map(renderPackageCard)
                                : <View style={styles.emptyState}>
                                    <SafeIcon name="clock" size={28} color={modernColors.textSecondary} />
                                    <Text style={styles.emptyText}>{t('bookUserSubDashboard.aucunHistorique')}</Text>
                                  </View>
                        )}
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    section: {
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F59E0B30',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 14,
        backgroundColor: '#FEF3C710',
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    badge: {
        backgroundColor: '#F59E0B',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginLeft: 6,
    },
    badgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    sectionContent: {
        padding: 12,
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        gap: 8,
    },
    loadingText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 12,
        paddingVertical: 8,
        backgroundColor: '#FFFBEB',
        borderRadius: 8,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
    },
    statLabel: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    tabRow: {
        flexDirection: 'row',
        marginBottom: 10,
        gap: 4,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        gap: 3,
    },
    tabActive: {
        backgroundColor: modernColors.primary + '15',
    },
    tabText: {
        fontSize: 11,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    tabTextActive: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    tabBadge: {
        backgroundColor: '#E2E8F0',
        borderRadius: 8,
        paddingHorizontal: 5,
        paddingVertical: 1,
    },
    tabBadgeActive: {
        backgroundColor: modernColors.primary + '25',
    },
    tabBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    tabBadgeTextActive: {
        color: modernColors.primary,
    },
    tabContent: {
        minHeight: 80,
    },
    card: {
        marginBottom: 10,
        padding: 12,
        borderRadius: 10,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    cardRef: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    cardBody: {
        gap: 4,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    infoText: {
        fontSize: 13,
        color: modernColors.textSecondary,
        flex: 1,
    },
    creneauSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
        padding: 6,
        backgroundColor: '#FEF3C7',
        borderRadius: 6,
    },
    creneauText: {
        fontSize: 11,
        color: '#92400E',
    },
    emptyState: {
        alignItems: 'center',
        padding: 20,
        gap: 8,
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
});

export default BookUserSubDashboard;
