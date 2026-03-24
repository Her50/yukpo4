// ✅ V2: Écran Paquets Livres - Vue coursier et utilisateur
// Affiche les paquets avec références simples, statuts, et actions de mise à jour

import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { useToaster } from '../../components/ToasterProvider';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { BookDeliveryPackage, BookPurchase, bourseLivreV2Api } from '../../services/bourseLivreV2Api';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

const NEXT_STATUS: Record<string, string> = {
    a_constituer: 'constitue',
    constitue: 'en_route',
    en_route: 'livre',
    livre: 'confirme',
};

interface Props {
    mode?: 'user' | 'courier'; // default: 'user'
}

const BookPackagesScreen: React.FC<Props> = ({ mode = 'user' }) => {
    const { user } = useAuth();
    const toaster = useToaster();
    const { t } = useLanguageSafe();

    const STATUT_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
        a_constituer: { label: t('bookPackages.aConstituer', 'À constituer'), color: '#f59e0b', icon: 'package' },
        constitue: { label: t('bookPackages.constitue', 'Constitué'), color: '#3b82f6', icon: 'check-square' },
        en_route: { label: t('bookPackages.enRoute', 'En route'), color: '#8b5cf6', icon: 'truck' },
        livre: { label: t('bookPackages.livre', 'Livré'), color: '#22c55e', icon: 'check-circle' },
        confirme: { label: t('bookPackages.confirme', 'Confirmé'), color: '#059669', icon: 'shield' },
    };

    const NEXT_STATUS_LABEL: Record<string, string> = {
        a_constituer: t('bookPackagesScreen.marquerConstitue', 'Marquer constitué'),
        constitue: t('bookPackagesScreen.demarrerLivraison', 'Démarrer livraison'),
        en_route: t('bookPackagesScreen.confirmerLivraison', 'Confirmer livraison'),
        livre: t('bookPackagesScreen.confirmerReception', 'Confirmer réception'),
    };

    const PURCHASE_STATUT_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
        en_attente: { label: t('bookPackages.enAttente', 'En attente'), color: '#f59e0b', icon: 'clock' },
        confirme: { label: t('bookPackages.confirme', 'Confirmé'), color: '#3b82f6', icon: 'check-square' },
        en_livraison: { label: t('bookPackages.enLivraison', 'En livraison'), color: '#8b5cf6', icon: 'truck' },
        livre: { label: t('bookPackages.livre', 'Livré'), color: '#22c55e', icon: 'check-circle' },
        annule: { label: t('bookPackages.annule', 'Annulé'), color: '#ef4444', icon: 'x-circle' },
    };
    const [activeTab, setActiveTab] = useState<'packages' | 'purchases'>('packages');
    const [packages, setPackages] = useState<BookDeliveryPackage[]>([]);
    const [purchases, setPurchases] = useState<BookPurchase[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            const pkgResult = mode === 'courier'
                ? await bourseLivreV2Api.getCourierPackages()
                : await bourseLivreV2Api.getMyPackages();
            setPackages(pkgResult);

            if (mode === 'user') {
                try {
                    const purchResult = await bourseLivreV2Api.getMyPurchases();
                    setPurchases(purchResult);
                } catch { /* purchases endpoint may not exist yet */ }
            }
        } catch (error: any) {
            console.error('[BookPackagesScreen] Erreur:', error);
            Alert.alert(t('message.error', 'Erreur'), t('bourseLivreV2.packages.erreurChargement'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [mode]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleUpdateStatus = useCallback(async (pkg: BookDeliveryPackage) => {
        const nextStatus = NEXT_STATUS[pkg.statut];
        if (!nextStatus) return;

        hapticPress();
        Alert.alert(
            t('bourseLivreV2.packages.confirmer'),
            t('bourseLivreV2.packages.confirmAction', { action: NEXT_STATUS_LABEL[pkg.statut], ref: pkg.reference }),
            [
                { text: t('bourseLivreV2.packages.annuler'), style: 'cancel' },
                {
                    text: t('bourseLivreV2.packages.confirmer'),
                    onPress: async () => {
                        try {
                            await bourseLivreV2Api.updatePackageStatus(pkg.id, nextStatus);
                            toaster.show(t('bourseLivreV2.packages.paquetMisAJour', { ref: pkg.reference }), 'success');
                            loadData();
                        } catch (error: any) {
                            Alert.alert(t('message.error', 'Erreur'), t('bourseLivreV2.packages.erreurMaj'));
                        }
                    },
                },
            ]
        );
    }, [toaster, loadData]);

    const renderPackage = ({ item }: { item: BookDeliveryPackage }) => {
        const config = STATUT_CONFIG[item.statut] || STATUT_CONFIG.a_constituer;
        const livres = Array.isArray(item.livres) ? item.livres : [];
        const hasNextStatus = !!NEXT_STATUS[item.statut];

        return (
            <View style={styles.packageCard}>
                {/* Header with reference */}
                <View style={styles.packageHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <View style={[styles.refBadge, { backgroundColor: config.color + '20' }]}>
                            <Text style={[styles.refText, { color: config.color }]}>{item.reference}</Text>
                        </View>
                        {(item as any).type_livraison === 'depot_seulement' && (
                            <View style={styles.depotBadge}>
                                <SafeIcon name="arrow-down-circle" size={10} color="#7c3aed" />
                                <Text style={styles.depotBadgeText}>{t('bourseLivreV2.packages.depotSeul')}</Text>
                            </View>
                        )}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
                        <SafeIcon name={config.icon} size={12} color="#fff" />
                        <Text style={styles.statusText}>{config.label}</Text>
                    </View>
                </View>

                {/* Books in package */}
                <View style={styles.booksSection}>
                    <Text style={styles.booksCount}>
                        {item.nombre_livres > 1
                            ? t('bourseLivreV2.packages.livres_plural', { count: item.nombre_livres })
                            : t('bourseLivreV2.packages.livres', { count: item.nombre_livres })}
                    </Text>
                    {livres.slice(0, 3).map((livre: any, idx: number) => {
                        const ta = String(livre.type_article || '').toLowerCase();
                        const icon =
                            ta === 'cahier' ? 'book-open' : ta === 'fourniture' ? 'package' : 'book';
                        const taLabel =
                            ta === 'cahier' ? 'Cahier' : ta === 'fourniture' ? 'Fourniture' : 'Livre';
                        return (
                            <View key={idx} style={styles.livreRow}>
                                <SafeIcon name={icon as any} size={12} color="#6b7280" />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.livreTitle} numberOfLines={1}>
                                        {livre.titre || `${taLabel} #${livre.livre_id}`}
                                    </Text>
                                    {!!livre.matiere && (
                                        <Text style={styles.livreMatiere} numberOfLines={1}>{livre.matiere}</Text>
                                    )}
                                </View>
                                <Text style={styles.livreValue}>{Math.round(livre.valeur || 0)} XAF</Text>
                            </View>
                        );
                    })}
                    {livres.length > 3 && (
                        <Text style={styles.moreBooks}>{t('bourseLivreV2.packages.autresLivres', { count: livres.length - 3 })}</Text>
                    )}
                </View>

                {/* Financial summary */}
                <View style={styles.financialSection}>
                    <View style={styles.financialRow}>
                        <Text style={styles.financialLabel}>{t('bourseLivreV2.packages.valeurTotale')}</Text>
                        <Text style={styles.financialValue}>
                            {Math.round(item.valeur_totale || 0)} {item.devise || 'XAF'}
                        </Text>
                    </View>
                    {item.commission_app > 0 && (
                        <View style={styles.financialRow}>
                            <Text style={styles.financialLabel}>{t('bourseLivreV2.packages.commissionLabel')}</Text>
                            <Text style={[styles.financialValue, { color: '#ef4444' }]}>
                                -{Math.round(item.commission_app)} {item.devise || 'XAF'}
                            </Text>
                        </View>
                    )}
                    {item.frais_livraison > 0 && (
                        <View style={styles.financialRow}>
                            <Text style={styles.financialLabel}>{t('bourseLivreV2.packages.livraisonLabel')}</Text>
                            <Text style={styles.financialValue}>
                                {Math.round(item.frais_livraison)} {item.devise || 'XAF'}
                            </Text>
                        </View>
                    )}
                    {item.montant_net_a_payer > 0 && (
                        <View style={[styles.financialRow, styles.financialTotal]}>
                            <Text style={styles.financialTotalLabel}>{t('bourseLivreV2.packages.netAPayer')}</Text>
                            <Text style={styles.financialTotalValue}>
                                {Math.round(item.montant_net_a_payer)} {item.devise || 'XAF'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Addresses */}
                <View style={styles.addressSection}>
                    {item.expediteur_adresse && (
                        <View style={styles.addressRow}>
                            <SafeIcon name="log-out" size={12} color="#6b7280" />
                            <Text style={styles.addressText} numberOfLines={1}>{t('bourseLivreV2.packages.de', { adresse: item.expediteur_adresse })}</Text>
                        </View>
                    )}
                    {item.destinataire_adresse && (
                        <View style={styles.addressRow}>
                            <SafeIcon name="log-in" size={12} color="#6b7280" />
                            <Text style={styles.addressText} numberOfLines={1}>{t('bourseLivreV2.packages.vers', { adresse: item.destinataire_adresse })}</Text>
                        </View>
                    )}
                </View>

                {/* Action button */}
                {hasNextStatus && (
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: config.color }]}
                        onPress={() => handleUpdateStatus(item)}
                    >
                        <SafeIcon name="arrow-right" size={16} color="#fff" />
                        <Text style={styles.actionBtnText}>{NEXT_STATUS_LABEL[item.statut]}</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderPurchase = ({ item }: { item: BookPurchase }) => {
        const config = PURCHASE_STATUT_CONFIG[item.statut] || PURCHASE_STATUT_CONFIG.en_attente;
        return (
            <View style={styles.packageCard}>
                <View style={styles.packageHeader}>
                    <View style={[styles.refBadge, { backgroundColor: '#22c55e20' }]}>
                        <Text style={[styles.refText, { color: '#22c55e' }]}>{t('bourseLivreV2.packages.achat', { id: item.id })}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
                        <SafeIcon name={config.icon} size={12} color="#fff" />
                        <Text style={styles.statusText}>{config.label}</Text>
                    </View>
                </View>
                <View style={styles.financialSection}>
                    <View style={styles.financialRow}>
                        <Text style={styles.financialLabel}>{t('bourseLivreV2.packages.prix')}</Text>
                        <Text style={styles.financialValue}>{Math.round(item.prix_achat)} {item.devise || 'XAF'}</Text>
                    </View>
                    {item.frais_livraison && item.frais_livraison > 0 ? (
                        <View style={styles.financialRow}>
                            <Text style={styles.financialLabel}>{t('bourseLivreV2.packages.livraisonLabel')}</Text>
                            <Text style={styles.financialValue}>{Math.round(item.frais_livraison)} {item.devise || 'XAF'}</Text>
                        </View>
                    ) : null}
                    {item.montant_total && item.montant_total > 0 ? (
                        <View style={[styles.financialRow, styles.financialTotal]}>
                            <Text style={styles.financialTotalLabel}>{t('bourseLivreV2.packages.totalLabel')}</Text>
                            <Text style={styles.financialTotalValue}>{Math.round(item.montant_total)} {item.devise || 'XAF'}</Text>
                        </View>
                    ) : null}
                </View>
                {item.adresse_livraison ? (
                    <View style={styles.addressSection}>
                        <View style={styles.addressRow}>
                            <SafeIcon name="map-pin" size={12} color="#6b7280" />
                            <Text style={styles.addressText} numberOfLines={1}>{item.adresse_livraison}</Text>
                        </View>
                    </View>
                ) : null}
                {item.mode_livraison === 'depot_seulement' && (
                    <View style={styles.depotBadge}>
                        <SafeIcon name="arrow-down-circle" size={10} color="#7c3aed" />
                        <Text style={styles.depotBadgeText}>{t('bourseLivreV2.packages.depotSeulement')}</Text>
                    </View>
                )}
                {item.paiement_statut && (
                    <View style={[styles.depotBadge, {
                        backgroundColor: item.paiement_statut === 'paye' ? '#dcfce7' : '#fef3c7',
                    }]}>
                        <SafeIcon
                            name={item.paiement_statut === 'paye' ? 'check-circle' : 'clock'}
                            size={10}
                            color={item.paiement_statut === 'paye' ? '#166534' : '#92400e'}
                        />
                        <Text style={{
                            fontSize: 10, fontWeight: '600',
                            color: item.paiement_statut === 'paye' ? '#166534' : '#92400e',
                        }}>
                            {item.paiement_statut === 'paye' ? t('bourseLivreV2.packages.paye') : item.paiement_statut === 'rembourse' ? t('bourseLivreV2.packages.rembourse') : t('bourseLivreV2.packages.paiementEnAttente')}
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('common.loading', 'Chargement...')}</Text>
            </View>
        );
    }

    const currentData = activeTab === 'packages' ? packages : [];
    const hasPurchases = purchases.length > 0;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <SafeIcon name="package" size={24} color={modernColors.primary} />
                <Text style={styles.headerTitle}>
                    {t('bourseLivreV2.packages.title')}
                </Text>
                <Text style={styles.headerCount}>
                    {activeTab === 'packages' ? packages.length : purchases.length}
                </Text>
            </View>

            {/* Tabs (user mode only, when purchases exist) */}
            {mode === 'user' && hasPurchases && (
                <View style={styles.tabBar}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'packages' && styles.tabActive]}
                        onPress={() => { hapticPress(); setActiveTab('packages'); }}
                    >
                        <SafeIcon name="package" size={14} color={activeTab === 'packages' ? modernColors.primary : '#9ca3af'} />
                        <Text style={[styles.tabText, activeTab === 'packages' && styles.tabTextActive]}>
                            {t('bourseLivreV2.packages.tabPaquets', { count: packages.length })}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'purchases' && styles.tabActive]}
                        onPress={() => { hapticPress(); setActiveTab('purchases'); }}
                    >
                        <SafeIcon name="shopping-cart" size={14} color={activeTab === 'purchases' ? modernColors.primary : '#9ca3af'} />
                        <Text style={[styles.tabText, activeTab === 'purchases' && styles.tabTextActive]}>
                            {t('bourseLivreV2.packages.tabAchats', { count: purchases.length })}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {activeTab === 'packages' ? (
                packages.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <SafeIcon name="inbox" size={64} color="#d1d5db" />
                        <Text style={styles.emptyTitle}>{t('bourseLivreV2.packages.aucunPaquet')}</Text>
                        <Text style={styles.emptySubtitle}>
                            {t('bourseLivreV2.packages.aucunPaquetDesc')}
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={packages}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={renderPackage}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />
                        }
                        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                    />
                )
            ) : (
                purchases.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <SafeIcon name="shopping-bag" size={64} color="#d1d5db" />
                        <Text style={styles.emptyTitle}>{t('bourseLivreV2.packages.aucunPaquet')}</Text>
                        <Text style={styles.emptySubtitle}>{t('bourseLivreV2.packages.aucunPaquetDesc')}</Text>
                    </View>
                ) : (
                    <FlatList
                        data={purchases}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={renderPurchase}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />
                        }
                        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                    />
                )
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, fontSize: 14, color: '#6b7280' },

    header: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1f2937' },
    headerCount: {
        backgroundColor: modernColors.primary, color: '#fff',
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
        fontSize: 13, fontWeight: '700', overflow: 'hidden',
    },

    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: '#6b7280', marginTop: 16 },
    emptySubtitle: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 8 },

    packageCard: {
        backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06,
        shadowRadius: 4, elevation: 2,
    },
    packageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    refBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    refText: { fontSize: 16, fontWeight: '800', letterSpacing: 1 },
    statusBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    },
    statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },

    booksSection: { marginBottom: 12 },
    booksCount: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
    livreRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 3 },
    livreTitle: { fontSize: 12, color: '#6b7280' },
    livreMatiere: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
    livreValue: { fontSize: 12, fontWeight: '600', color: '#374151' },
    moreBooks: { fontSize: 11, color: '#9ca3af', fontStyle: 'italic', marginTop: 4 },

    financialSection: {
        borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 10, marginBottom: 10,
    },
    financialRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
    financialLabel: { fontSize: 12, color: '#6b7280' },
    financialValue: { fontSize: 12, fontWeight: '600', color: '#374151' },
    financialTotal: {
        borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 4, paddingTop: 6,
    },
    financialTotalLabel: { fontSize: 13, fontWeight: '700', color: '#1f2937' },
    financialTotalValue: { fontSize: 14, fontWeight: '800', color: modernColors.primary },

    addressSection: { gap: 4, marginBottom: 10 },
    addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    addressText: { fontSize: 11, color: '#6b7280', flex: 1 },

    depotBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#ede9fe', paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: 6, alignSelf: 'flex-start', marginTop: 6,
    },
    depotBadgeText: { fontSize: 10, fontWeight: '600', color: '#7c3aed' },

    tabBar: {
        flexDirection: 'row', backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
        paddingHorizontal: 16,
    },
    tab: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: modernColors.primary },
    tabText: { fontSize: 13, color: '#9ca3af', fontWeight: '500' },
    tabTextActive: { color: modernColors.primary, fontWeight: '700' },

    actionBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 12, borderRadius: 10,
    },
    actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default BookPackagesScreen;
