import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useLanguageSafe, type TranslateFn } from '../../contexts/LanguageContext';
import { BookDeliveryPackage, bourseLivreV2Api } from '../../services/bourseLivreV2Api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';
import { NativeCard } from '../SafeNativeDesign';

interface BookCourierSubDashboardProps {
    onRefresh?: () => void;
}

const getStatusLabels = (t: TranslateFn): Record<string, string> => ({
    a_constituer: t('bookCourierSubDashboard.aConstituer', 'À constituer'),
    constitue: t('bookCourierSubDashboard.constitue', 'Constitué'),
    en_route: t('bookCourierSubDashboard.enRoute', 'En route'),
    livre: t('bookCourierSubDashboard.livre', 'Livré'),
    confirme: t('bookCourierSubDashboard.confirme', 'Confirmé'),
});

const STATUS_COLORS: Record<string, string> = {
    a_constituer: '#F59E0B',
    constitue: '#3B82F6',
    en_route: '#8B5CF6',
    livre: '#10B981',
    confirme: '#059669',
};

const BookCourierSubDashboard: React.FC<BookCourierSubDashboardProps> = ({ onRefresh }) => {
    const { t } = useLanguageSafe();
    const STATUS_LABELS = getStatusLabels(t);
    const [loading, setLoading] = useState(true);
    const [mesPaquets, setMesPaquets] = useState<BookDeliveryPackage[]>([]);
    const [paquetsDisponibles, setPaquetsDisponibles] = useState<BookDeliveryPackage[]>([]);
    const [stats, setStats] = useState({ actifs: 0, completes: 0, livres: 0, gains_totaux_xaf: 0 });
    const [expanded, setExpanded] = useState(true);
    const navigation = require('@react-navigation/native')?.useNavigation?.();

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const data = await bourseLivreV2Api.getCourierBookDashboard();
            setMesPaquets(data.mes_paquets);
            setPaquetsDisponibles(data.paquets_disponibles);
            setStats(data.stats);
        } catch (err) {
            console.warn('[BookCourierSubDashboard] Erreur:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleAcceptPackage = async (pkg: BookDeliveryPackage) => {
        Alert.alert(
            t('bookCourierSubDashboard.accepterPaquetTitre', 'Accepter ce paquet ?'),
            `${pkg.nombre_livres} ${t('bookCourierSubDashboard.livresCountSuffix', 'livre(s)')} - ${pkg.reference}\n${t('bookCourierSubDashboard.de', 'De')}: ${pkg.expediteur_adresse || t('common.na', 'N/A')}\n${t('bookCourierSubDashboard.vers', 'Vers')}: ${pkg.destinataire_adresse || t('common.na', 'N/A')}`,
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.accept'),
                    onPress: async () => {
                        try {
                            await bourseLivreV2Api.courierAcceptPackage(pkg.id);
                            Alert.alert(t('bookCourierSubDashboard.paquetAccepte'), t('bookCourierSubDashboard.rendezvousAuPointDeRecuperation'));
                            loadData();
                            onRefresh?.();
                        } catch (e: any) {
                            Alert.alert(t('message.error', 'Erreur'), e?.message || t('bookCourierSubDashboard.impossibleAccepterPaquet', "Impossible d'accepter ce paquet"));
                        }
                    },
                },
            ]
        );
    };

    const handleUpdateStatus = async (pkg: BookDeliveryPackage, newStatus: string) => {
        try {
            await bourseLivreV2Api.updatePackageStatus(pkg.id, newStatus);
            loadData();
            onRefresh?.();
        } catch (e: any) {
            Alert.alert(t('message.error', 'Erreur'), e?.message || t('bookCourierSubDashboard.impossibleDeMettreAJourLe'));
        }
    };

    // ✅ 2026-05-19 MVP3 mobile — coursier refuse un livre trop dégradé à la collecte.
    // Appelle POST /api/bourse-livre/v2/packages/cancel-book qui retire le livre du
    // JSONB `livres` du paquet, recalcule nombre_livres + montant, et crédite le
    // wallet du destinataire si applicable (cas troc). Idempotent.
    const handleCourierRefuseBook = async (pkg: BookDeliveryPackage, livre: any) => {
        Alert.alert(
            t('bookCourierSubDashboard.refuserLivreTitre', 'Refuser ce livre ?'),
            `${livre.titre || t('common.na', 'N/A')}\n${t('bookCourierSubDashboard.refuserLivreDesc', 'Indique pourquoi tu ne peux pas le prendre. Le destinataire sera notifié et son total ajusté.')}`,
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('bookCourierSubDashboard.refuserDegrade', 'Trop dégradé'),
                    style: 'destructive',
                    onPress: () => refuseBookWithMotif(pkg, livre, 'trop_degrade'),
                },
                {
                    text: t('bookCourierSubDashboard.refuserIntrouvable', 'Introuvable'),
                    onPress: () => refuseBookWithMotif(pkg, livre, 'introuvable'),
                },
                {
                    text: t('bookCourierSubDashboard.refuserVendeurAbsent', 'Vendeur absent'),
                    onPress: () => refuseBookWithMotif(pkg, livre, 'vendeur_absent'),
                },
            ],
        );
    };

    const refuseBookWithMotif = async (
        pkg: BookDeliveryPackage,
        livre: any,
        raison: string,
    ) => {
        try {
            // L'API mobile bourseLivreV2Api.cancelBookOnSite attend { package_id,
            // livre_id, raison? }. livre_id est l'ID du livre côté livres_scolaires
            // (occasion/troc) — utilisé par le backend cancel_book_on_site.
            const livreId = livre.livre_id ?? livre.id;
            if (!livreId) {
                Alert.alert(
                    t('message.error', 'Erreur'),
                    t('bookCourierSubDashboard.livreIdManquant', 'ID livre manquant'),
                );
                return;
            }
            const res = await bourseLivreV2Api.cancelBookOnSite({
                package_id: pkg.id,
                livre_id: livreId,
                raison,
            });
            const credit = res?.credit_amount ?? 0;
            Alert.alert(
                t('bookCourierSubDashboard.livreRefuse', 'Livre refusé'),
                credit > 0
                    ? t(
                          'bookCourierSubDashboard.livreRefuseCredit',
                          'Le destinataire a reçu ' + credit + ' XAF de crédit (cas troc).',
                      )
                    : t(
                          'bookCourierSubDashboard.livreRefuseOk',
                          "Total ajusté côté commande. Continue ta tournée.",
                      ),
            );
            loadData();
            onRefresh?.();
        } catch (e: any) {
            Alert.alert(
                t('message.error', 'Erreur'),
                e?.message ||
                    t('bookCourierSubDashboard.impossibleRefuser', 'Impossible de refuser ce livre'),
            );
        }
    };

    const renderPackageCard = (pkg: BookDeliveryPackage, isAvailable: boolean = false) => {
        const statusColor = STATUS_COLORS[pkg.statut] || modernColors.textSecondary;
        const statusLabel = STATUS_LABELS[pkg.statut] || pkg.statut;

        return (
            <NativeCard key={pkg.id} style={styles.packageCard}>
                <View style={styles.packageHeader}>
                    <View style={styles.packageTitleRow}>
                        <SafeIcon name="book-open" size={18} color={modernColors.primary} />
                        <Text style={styles.packageRef}>{pkg.reference}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                </View>

                <View style={styles.packageInfo}>
                    <View style={styles.infoRow}>
                        <SafeIcon name="package" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.infoText}>{pkg.nombre_livres} livre(s)</Text>
                    </View>
                    {pkg.expediteur_adresse && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="map-pin" size={14} color="#3B82F6" />
                            <Text style={styles.infoText} numberOfLines={1}>{t('bookCourierSubDashboard.pickup')}: {pkg.expediteur_adresse}</Text>
                        </View>
                    )}
                    {pkg.destinataire_adresse && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="navigation" size={14} color="#10B981" />
                            <Text style={styles.infoText} numberOfLines={1}>{t('bookCourierSubDashboard.dropoff')}: {pkg.destinataire_adresse}</Text>
                        </View>
                    )}
                    {pkg.eta_minutes != null && pkg.eta_minutes > 0 && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="clock" size={14} color="#F59E0B" />
                            <Text style={styles.infoText}>ETA: ~{pkg.eta_minutes} min</Text>
                        </View>
                    )}
                    {pkg.frais_livraison > 0 && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="credit-card" size={14} color="#059669" />
                            <Text style={styles.infoText}>
                                Gain: {Math.round(pkg.frais_livraison * 0.80)} XAF
                            </Text>
                        </View>
                    )}
                </View>

                {/* Créneaux de disponibilité */}
                {(pkg.creneau_expediteur_debut || pkg.creneau_destinataire_debut) && (
                    <View style={styles.creneauxSection}>
                        {pkg.creneau_expediteur_debut && (
                            <View style={styles.creneauRow}>
                                <SafeIcon name="user" size={12} color={modernColors.textSecondary} />
                                <Text style={styles.creneauText}>
                                    Expéd. dispo: {new Date(pkg.creneau_expediteur_debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    {pkg.creneau_expediteur_fin && ` - ${new Date(pkg.creneau_expediteur_fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
                                </Text>
                            </View>
                        )}
                        {pkg.creneau_destinataire_debut && (
                            <View style={styles.creneauRow}>
                                <SafeIcon name="users" size={12} color={modernColors.textSecondary} />
                                <Text style={styles.creneauText}>
                                    Dest. dispo: {new Date(pkg.creneau_destinataire_debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    {pkg.creneau_destinataire_fin && ` - ${new Date(pkg.creneau_destinataire_fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Actions */}
                <View style={styles.actionsRow}>
                    {isAvailable ? (
                        <TouchableOpacity
                            style={styles.acceptButton}
                            onPress={() => handleAcceptPackage(pkg)}
                        >
                            <SafeIcon name="check-circle" size={16} color="#fff" />
                            <Text style={styles.acceptButtonText}>{t('common.accept', 'Accepter')}</Text>
                        </TouchableOpacity>
                    ) : (
                        <>
                            {pkg.statut === 'constitue' && (
                                <TouchableOpacity
                                    style={[styles.actionButton, { backgroundColor: '#8B5CF620' }]}
                                    onPress={() => handleUpdateStatus(pkg, 'en_route')}
                                >
                                    <SafeIcon name="truck" size={14} color="#8B5CF6" />
                                    <Text style={[styles.actionText, { color: '#8B5CF6' }]}>{t('bookCourierSubDashboard.enRoute', 'En route')}</Text>
                                </TouchableOpacity>
                            )}
                            {pkg.statut === 'en_route' && (
                                <TouchableOpacity
                                    style={[styles.actionButton, { backgroundColor: '#10B98120' }]}
                                    onPress={() => handleUpdateStatus(pkg, 'livre')}
                                >
                                    <SafeIcon name="check" size={14} color="#10B981" />
                                    <Text style={[styles.actionText, { color: '#10B981' }]}>{t('bookCourierSubDashboard.marquerLivre')}</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </View>
            </NativeCard>
        );
    };

    if (loading && mesPaquets.length === 0 && paquetsDisponibles.length === 0) {
        return (
            <View style={styles.section}>
                <TouchableOpacity style={styles.sectionHeader} onPress={() => setExpanded(!expanded)}>
                    <View style={styles.sectionTitleRow}>
                        <SafeIcon name="book-open" size={20} color={modernColors.primary} />
                        <Text style={styles.sectionTitle}>{t('bookCourierSubDashboard.livresScolaires')}</Text>
                    </View>
                    <SafeIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={modernColors.textSecondary} />
                </TouchableOpacity>
                {expanded && (
                    <View style={styles.loadingRow}>
                        <ActivityIndicator size="small" color={modernColors.primary} />
                        <Text style={styles.loadingText}>{t('bookCourierSubDashboard.chargement')}</Text>
                    </View>
                )}
            </View>
        );
    }

    const totalPaquets = mesPaquets.length + paquetsDisponibles.length;

    return (
        <View style={styles.section}>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => setExpanded(!expanded)}>
                <View style={styles.sectionTitleRow}>
                    <SafeIcon name="book-open" size={20} color={modernColors.primary} />
                    <Text style={styles.sectionTitle}>{t('bookCourierSubDashboard.livresScolaires')}</Text>
                    {totalPaquets > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{totalPaquets}</Text>
                        </View>
                    )}
                </View>
                <SafeIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={modernColors.textSecondary} />
            </TouchableOpacity>

            {expanded && (
                <View style={styles.sectionContent}>
                    {/* Stats rapides */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{stats.actifs}</Text>
                            <Text style={styles.statLabel}>{t('bookCourierSubDashboard.actifs', 'Actifs')}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{stats.completes}</Text>
                            <Text style={styles.statLabel}>{t('bookCourierSubDashboard.completes')}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: '#059669' }]}>
                                {stats.gains_totaux_xaf.toLocaleString()}
                            </Text>
                            <Text style={styles.statLabel}>{t('bookCourierSubDashboard.gainsXaf', 'Gains XAF')}</Text>
                        </View>
                    </View>

                    {/* Mes paquets assignés */}
                    {mesPaquets.length > 0 && (
                        <>
                            <Text style={styles.subsectionTitle}>
                                {t('bookCourierSubDashboard.mesPaquets', 'Mes paquets')} ({mesPaquets.length})
                            </Text>
                            {mesPaquets.map((pkg) => renderPackageCard(pkg, false))}
                        </>
                    )}

                    {/* Paquets disponibles */}
                    {paquetsDisponibles.length > 0 && (
                        <>
                            <Text style={styles.subsectionTitle}>
                                {t('bookCourierSubDashboard.disponibles', 'Disponibles')} ({paquetsDisponibles.length})
                            </Text>
                            {paquetsDisponibles.map((pkg) => renderPackageCard(pkg, true))}
                        </>
                    )}

                    {/* Accès rapide vers écran dédié */}
                    {(mesPaquets.length > 0 || paquetsDisponibles.length > 0) && (
                        <View style={styles.quickLinksRow}>
                            <TouchableOpacity
                                style={styles.quickLinkBtn}
                                onPress={() => {
                                    try {
                                        navigation?.navigate?.('BookPackages', { mode: 'courier' });
                                    } catch { /* noop */ }
                                }}
                            >
                                <SafeIcon name="package" size={14} color={modernColors.primary} />
                                <Text style={styles.quickLinkText}>
                                    {t('bookCourierSubDashboard.voirTousPaquets', 'Voir tous')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {mesPaquets.length === 0 && paquetsDisponibles.length === 0 && (
                        <View style={styles.emptyState}>
                            <SafeIcon name="inbox" size={32} color={modernColors.textSecondary} />
                            <Text style={styles.emptyText}>{t('bookCourierSubDashboard.aucunPaquetDeLivres')}</Text>
                        </View>
                    )}
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
        borderColor: modernColors.primary + '20',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 14,
        backgroundColor: modernColors.primary + '08',
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
        backgroundColor: modernColors.primary,
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
        backgroundColor: '#F8FAFC',
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
    subsectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginTop: 8,
        marginBottom: 8,
    },
    packageCard: {
        marginBottom: 10,
        padding: 12,
        borderRadius: 10,
    },
    packageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    packageTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    packageRef: {
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
    packageInfo: {
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
    creneauxSection: {
        marginTop: 8,
        padding: 8,
        backgroundColor: '#FEF3C7',
        borderRadius: 6,
        gap: 4,
    },
    creneauRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    creneauText: {
        fontSize: 11,
        color: '#92400E',
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 10,
        gap: 8,
    },
    quickLinksRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        marginTop: 8,
        marginBottom: 4,
    },
    quickLinkBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: modernColors.primary + '10',
        borderWidth: 1,
        borderColor: modernColors.primary + '20',
    },
    quickLinkText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
    acceptButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: modernColors.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    acceptButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    actionText: {
        fontSize: 13,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        padding: 24,
        gap: 8,
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
});

export default BookCourierSubDashboard;
