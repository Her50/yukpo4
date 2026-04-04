// ✅ Écran commande multi-pharmacies
//
// MODE PROPOSITION (params.split) :
//   - Affiche la répartition proposée (quelle pharmacie fournit quoi)
//   - Bouton "Confirmer la commande" → crée la multi-commande backend
//
// MODE QR (params.multiOrderId) :
//   - Charge la multi-commande existante
//   - Affiche les QR codes de chaque sous-commande (pickup + delivery)
//   - Le coursier sait exactement dans quelles pharmacies passer

import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { pharmacyService } from '../../services/pharmacyService';
import { hapticPress } from '../../utils/hapticFeedback';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MedItem {
    medication_name: string;
    quantity: number;
    unit_price?: string;
}

interface PharmacySplit {
    pharmacy_id: number;
    pharmacy_name: string;
    medications: MedItem[];
    distance_km?: number;
    matching_score?: number;
}

interface SubOrderQR {
    order_id: string;
    pharmacy_id: number;
    pharmacy_nom: string;
    pharmacy_tel?: string;
    sub_order_index: number;
    status: string;
    sub_total: string;
    reversed: boolean;
    items: MedItem[];
    qr_pickup?: { qr_code: string; status: string; expires_at: string } | null;
    qr_delivery?: { qr_code: string; status: string; expires_at: string } | null;
}

interface RouteParams {
    // Mode proposition (avant commande)
    split?: PharmacySplit[];
    deliveryMethod?: 'pickup' | 'delivery';
    deliveryAddress?: string;
    // Mode QR (après commande)
    multiOrderId?: string;
}

// ─── Algorithme de répartition greedy ────────────────────────────────────────
// Appelé depuis PharmacieListScreen avec la liste pharmacies + ordonnance complète

export function computeGreedySplit(
    pharmacies: Array<{
        id: number;
        nom: string;
        distance_km?: number;
        matching_score?: number;
        medications_availability?: Array<{ name: string; available: boolean }>;
    }>,
    requestedMeds: string[]
): PharmacySplit[] {
    const remaining = new Set(requestedMeds.map(m => m.toLowerCase()));
    const splits: PharmacySplit[] = [];

    // Pharmacies déjà triées par matching_score DESC, distance ASC (backend)
    for (const pharm of pharmacies) {
        if (remaining.size === 0) break;
        const availability = pharm.medications_availability || [];
        const covered = availability
            .filter(a => a.available && remaining.has(a.name.toLowerCase()))
            .map(a => a.name);
        if (covered.length === 0) continue;

        splits.push({
            pharmacy_id: pharm.id,
            pharmacy_name: pharm.nom,
            distance_km: pharm.distance_km,
            matching_score: pharm.matching_score,
            medications: covered.map(name => ({
                medication_name: name,
                quantity: 1,
            })),
        });
        covered.forEach(name => remaining.delete(name.toLowerCase()));
    }

    return splits;
}

// ─── Composant ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending:     { label: 'En attente',   color: '#F59E0B' },
    confirmed:   { label: 'Confirmée',    color: '#3B82F6' },
    processing:  { label: 'En préparation', color: '#8B5CF6' },
    ready:       { label: 'Prête',        color: '#10B981' },
    in_delivery: { label: 'En livraison', color: '#06B6D4' },
    delivered:   { label: 'Livrée ✓',    color: '#059669' },
    cancelled:   { label: 'Annulée',      color: '#EF4444' },
};

const PharmacyMultiOrderScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const params = (route.params as RouteParams) || {};

    const isProposalMode = !!params.split && !params.multiOrderId;

    const [loading, setLoading] = useState(!isProposalMode);
    const [submitting, setSubmitting] = useState(false);
    const [multiOrderData, setMultiOrderData] = useState<{
        multi_order_id: string;
        delivery_method: string;
        total_amount: string;
        sub_orders: SubOrderQR[];
    } | null>(null);

    // Mode QR : charger la commande existante
    useEffect(() => {
        if (params.multiOrderId) {
            loadMultiOrder(params.multiOrderId);
        }
    }, [params.multiOrderId]);

    const loadMultiOrder = async (id: string) => {
        setLoading(true);
        const res = await pharmacyService.getMultiPharmacyOrder(id);
        if (res.success && res.sub_orders) {
            setMultiOrderData({
                multi_order_id: res.multi_order_id!,
                delivery_method: res.delivery_method!,
                total_amount: res.total_amount!,
                sub_orders: res.sub_orders as SubOrderQR[],
            });
        } else {
            Alert.alert('Erreur', res.error || 'Impossible de charger la commande');
        }
        setLoading(false);
    };

    // Mode proposition : créer la commande
    const handleConfirm = async () => {
        if (!params.split || params.split.length === 0) return;
        hapticPress();
        setSubmitting(true);

        const res = await pharmacyService.createMultiPharmacyOrder({
            split: params.split.map(s => ({
                pharmacy_id: s.pharmacy_id,
                medications: s.medications,
            })),
            delivery_method: params.deliveryMethod || 'pickup',
            delivery_address: params.deliveryAddress,
        });

        setSubmitting(false);

        if (res.success && res.multi_order_id) {
            Alert.alert(
                'Commande confirmée !',
                `Votre commande a été passée dans ${res.sub_orders_count} pharmacie(s). Total : ${
                    Number(res.total_amount).toLocaleString()
                } FCFA`,
                [{
                    text: 'Voir mes QR codes',
                    onPress: () => {
                        // Remplace l'écran courant par le mode QR
                        (navigation as any).replace('PharmacyMultiOrder', {
                            multiOrderId: res.multi_order_id,
                        });
                    },
                }]
            );
        } else {
            const msg = res.error || 'Erreur lors de la création de la commande';
            if (msg.toLowerCase().includes('solde') || msg.toLowerCase().includes('insuffisant')) {
                Alert.alert(
                    'Solde insuffisant',
                    msg,
                    [
                        { text: 'Annuler', style: 'cancel' },
                        {
                            text: 'Recharger mon wallet',
                            onPress: () => (navigation as any).navigate('WalletFinancial'),
                        },
                    ]
                );
            } else {
                Alert.alert('Erreur', msg);
            }
        }
    };

    const shareQR = async (qrCode: string, pharmName: string, type: string) => {
        hapticPress();
        try {
            await Share.share({
                message: `Yukpo Multi-Pharmacie — ${pharmName} — Code ${type === 'pickup' ? 'retrait' : 'livraison'}: ${qrCode}`,
                title: 'QR Code Commande Pharmacie',
            });
        } catch {}
    };

    // ─── Rendu mode PROPOSITION ──────────────────────────────────────────────
    const renderProposalMode = () => {
        const split = params.split!;
        const totalMeds = split.reduce((acc, s) => acc + s.medications.length, 0);

        return (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Intro */}
                <View style={styles.infoCard}>
                    <SafeIcon name="info" size={16} color="#3B82F6" type="lucide" />
                    <Text style={styles.infoText}>
                        Aucune pharmacie ne dispose de tous vos médicaments. Nous avons réparti votre ordonnance dans{' '}
                        <Text style={{ fontWeight: '700' }}>{split.length} pharmacie(s)</Text> proches pour tout couvrir.
                    </Text>
                </View>

                {/* Répartition par pharmacie */}
                {split.map((s, idx) => (
                    <View key={s.pharmacy_id} style={styles.pharmacyCard}>
                        <View style={styles.pharmacyCardHeader}>
                            <View style={styles.pharmacyIndexBadge}>
                                <Text style={styles.pharmacyIndexText}>{idx + 1}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.pharmacyName}>{s.pharmacy_name}</Text>
                                <View style={styles.pharmacyMeta}>
                                    {s.distance_km != null && (
                                        <Text style={styles.metaChip}>
                                            📍 {s.distance_km.toFixed(1)} km
                                        </Text>
                                    )}
                                    <Text style={styles.metaChip}>
                                        {s.medications.length} méd.
                                    </Text>
                                </View>
                            </View>
                        </View>
                        {s.medications.map((med, mi) => (
                            <View key={mi} style={styles.medRow}>
                                <SafeIcon name="check-circle" size={14} color="#10B981" type="lucide" />
                                <Text style={styles.medName}>{med.medication_name}</Text>
                                <Text style={styles.medQty}>×{med.quantity}</Text>
                            </View>
                        ))}
                    </View>
                ))}

                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Récapitulatif</Text>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Médicaments couverts</Text>
                        <Text style={styles.summaryValue}>{totalMeds}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Pharmacies</Text>
                        <Text style={styles.summaryValue}>{split.length}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Mode</Text>
                        <Text style={styles.summaryValue}>
                            {params.deliveryMethod === 'delivery' ? '🛵 Livraison' : '🏪 Retrait'}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.confirmButton, submitting && { opacity: 0.6 }]}
                    onPress={handleConfirm}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                        <>
                            <SafeIcon name="check" size={20} color="#FFFFFF" type="lucide" />
                            <Text style={styles.confirmButtonText}>Confirmer la commande</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
        );
    };

    // ─── Rendu mode QR ───────────────────────────────────────────────────────
    const renderQRMode = () => {
        if (!multiOrderData) return null;
        const isDelivery = multiOrderData.delivery_method === 'delivery';

        return (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Total */}
                <View style={styles.totalCard}>
                    <Text style={styles.totalLabel}>Total commande</Text>
                    <Text style={styles.totalAmount}>
                        {Number(multiOrderData.total_amount).toLocaleString()} FCFA
                    </Text>
                    <Text style={styles.totalSub}>
                        {multiOrderData.sub_orders.length} pharmacie(s) • {isDelivery ? '🛵 Livraison' : '🏪 Retrait'}
                    </Text>
                </View>

                {/* QR par sous-commande */}
                {multiOrderData.sub_orders.map(sub => {
                    const statusInfo = STATUS_LABELS[sub.status] || { label: sub.status, color: '#6B7280' };
                    return (
                        <View key={sub.order_id} style={styles.subOrderCard}>
                            {/* En-tête pharmacie */}
                            <View style={styles.subOrderHeader}>
                                <View style={styles.subIndexBadge}>
                                    <Text style={styles.subIndexText}>{sub.sub_order_index}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.subPharmName}>{sub.pharmacy_nom}</Text>
                                    {sub.pharmacy_tel && (
                                        <Text style={styles.subPharmTel}>{sub.pharmacy_tel}</Text>
                                    )}
                                </View>
                                <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
                                    <Text style={[styles.statusText, { color: statusInfo.color }]}>
                                        {statusInfo.label}
                                    </Text>
                                </View>
                            </View>

                            {/* Items */}
                            <View style={styles.itemsList}>
                                {sub.items.map((item, i) => (
                                    <View key={i} style={styles.itemRow}>
                                        <Text style={styles.itemName}>{item.medication_name}</Text>
                                        <Text style={styles.itemQty}>×{item.quantity}</Text>
                                    </View>
                                ))}
                            </View>

                            <Text style={styles.subTotal}>
                                Sous-total : {Number(sub.sub_total).toLocaleString()} FCFA
                                {sub.reversed && ' ✓ Payé'}
                            </Text>

                            {/* QR Pickup */}
                            {sub.qr_pickup && (
                                <QRBlock
                                    title={isDelivery ? 'QR Retrait (coursier → pharmacie)' : 'QR Retrait en pharmacie'}
                                    subtitle={isDelivery
                                        ? 'Le coursier montre ce QR à la pharmacie pour récupérer les médicaments'
                                        : 'Montrez ce QR à la pharmacie lors de votre retrait'}
                                    qr={sub.qr_pickup}
                                    color="#EC4899"
                                    onShare={() => shareQR(sub.qr_pickup!.qr_code, sub.pharmacy_nom, 'pickup')}
                                />
                            )}

                            {/* QR Delivery */}
                            {isDelivery && sub.qr_delivery && (
                                <QRBlock
                                    title="QR Réception (vous → coursier)"
                                    subtitle="Montrez ce QR au coursier lors de la livraison"
                                    qr={sub.qr_delivery}
                                    color="#3B82F6"
                                    onShare={() => shareQR(sub.qr_delivery!.qr_code, sub.pharmacy_nom, 'delivery')}
                                />
                            )}
                        </View>
                    );
                })}

                {/* Note coursier */}
                {isDelivery && (
                    <View style={styles.courierNote}>
                        <SafeIcon name="truck" size={16} color="#7C3AED" type="lucide" />
                        <Text style={styles.courierNoteText}>
                            Le coursier visitera chaque pharmacie dans l'ordre et utilisera le QR retrait pour récupérer vos médicaments. Vous n'aurez qu'à lui montrer le QR réception lors de la livraison.
                        </Text>
                    </View>
                )}
            </ScrollView>
        );
    };

    return (
        <SafeNativeView style={styles.container}>
            <LinearGradient colors={['#EC4899', '#F472B6']} style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>
                        {isProposalMode ? 'Commande multi-pharmacies' : 'Mes QR codes'}
                    </Text>
                    <Text style={styles.headerSub}>
                        {isProposalMode
                            ? 'Répartition optimale de votre ordonnance'
                            : `${multiOrderData?.sub_orders.length ?? 0} pharmacie(s)`}
                    </Text>
                </View>
                {!isProposalMode && (
                    <TouchableOpacity style={styles.backButton} onPress={() => params.multiOrderId && loadMultiOrder(params.multiOrderId)}>
                        <SafeIcon name="refresh-cw" size={20} color="#FFFFFF" type="lucide" />
                    </TouchableOpacity>
                )}
            </LinearGradient>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#EC4899" />
                    <Text style={styles.loadingText}>Chargement...</Text>
                </View>
            ) : isProposalMode ? renderProposalMode() : renderQRMode()}
        </SafeNativeView>
    );
};

// ─── Composant QR Block ───────────────────────────────────────────────────────

interface QRBlockProps {
    title: string;
    subtitle: string;
    qr: { qr_code: string; status: string; expires_at: string };
    color: string;
    onShare: () => void;
}

const QRBlock: React.FC<QRBlockProps> = ({ title, subtitle, qr, color, onShare }) => {
    const isValidated = qr.status === 'validated';
    return (
        <View style={[qrStyles.block, { borderTopColor: color + '30', borderTopWidth: 1, marginTop: 12, paddingTop: 12 }]}>
            <Text style={[qrStyles.title, { color }]}>{title}</Text>
            <Text style={qrStyles.subtitle}>{subtitle}</Text>
            <View style={qrStyles.qrBox}>
                {isValidated ? (
                    <View style={qrStyles.validatedBox}>
                        <SafeIcon name="check-circle" size={40} color="#059669" type="lucide" />
                        <Text style={qrStyles.validatedText}>QR scanné ✓</Text>
                    </View>
                ) : (
                    <QRCode value={qr.qr_code} size={180} color="#111827" backgroundColor="#FFFFFF" />
                )}
            </View>
            <Text style={qrStyles.code}>{qr.qr_code}</Text>
            <Text style={qrStyles.expiry}>
                Expire le {new Date(qr.expires_at).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
            </Text>
            {!isValidated && (
                <TouchableOpacity style={[qrStyles.shareBtn, { borderColor: color }]} onPress={onShare}>
                    <SafeIcon name="share-2" size={14} color={color} type="lucide" />
                    <Text style={[qrStyles.shareBtnText, { color }]}>Partager</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20, gap: 12,
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
    headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    content: { padding: 16, gap: 16 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14, color: '#6B7280' },

    // Info banner
    infoCard: {
        flexDirection: 'row', gap: 10, backgroundColor: '#EFF6FF',
        borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#BFDBFE',
    },
    infoText: { flex: 1, fontSize: 13, color: '#1E40AF', lineHeight: 18 },

    // Proposition
    pharmacyCard: {
        backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
    },
    pharmacyCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    pharmacyIndexBadge: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: '#EC4899', justifyContent: 'center', alignItems: 'center',
    },
    pharmacyIndexText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
    pharmacyName: { fontSize: 15, fontWeight: '700', color: '#111827' },
    pharmacyMeta: { flexDirection: 'row', gap: 8, marginTop: 2 },
    metaChip: { fontSize: 11, color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    medRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    medName: { flex: 1, fontSize: 14, color: '#374151' },
    medQty: { fontSize: 13, color: '#6B7280', fontWeight: '600' },

    summaryCard: {
        backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 8, elevation: 3, gap: 10,
    },
    summaryTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
    summaryLabel: { fontSize: 14, color: '#6B7280' },
    summaryValue: { fontSize: 14, color: '#111827', fontWeight: '600' },

    confirmButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 10, backgroundColor: '#EC4899', borderRadius: 16,
        paddingVertical: 16, marginTop: 4,
    },
    confirmButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

    // QR mode
    totalCard: {
        backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
    },
    totalLabel: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
    totalAmount: { fontSize: 28, fontWeight: '800', color: '#111827' },
    totalSub: { fontSize: 13, color: '#6B7280', marginTop: 4 },

    subOrderCard: {
        backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
    },
    subOrderHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
    subIndexBadge: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: '#EC4899', justifyContent: 'center', alignItems: 'center',
    },
    subIndexText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
    subPharmName: { fontSize: 14, fontWeight: '700', color: '#111827' },
    subPharmTel: { fontSize: 12, color: '#6B7280' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
    statusText: { fontSize: 11, fontWeight: '700' },
    itemsList: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8, gap: 4, marginBottom: 8 },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between' },
    itemName: { fontSize: 13, color: '#374151', flex: 1 },
    itemQty: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
    subTotal: { fontSize: 13, color: '#059669', fontWeight: '700', textAlign: 'right', marginBottom: 4 },

    courierNote: {
        flexDirection: 'row', gap: 10, backgroundColor: '#F5F3FF',
        borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#DDD6FE',
    },
    courierNoteText: { flex: 1, fontSize: 12, color: '#5B21B6', lineHeight: 17 },
});

const qrStyles = StyleSheet.create({
    block: { alignItems: 'center' },
    title: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
    subtitle: { fontSize: 11, color: '#6B7280', textAlign: 'center', marginBottom: 10, lineHeight: 15 },
    qrBox: {
        padding: 12, backgroundColor: '#FFFFFF', borderRadius: 10,
        borderWidth: 1.5, borderColor: '#F3F4F6', marginBottom: 8,
    },
    validatedBox: { alignItems: 'center', padding: 16, gap: 8 },
    validatedText: { fontSize: 14, fontWeight: '700', color: '#059669' },
    code: { fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace', marginBottom: 2 },
    expiry: { fontSize: 10, color: '#9CA3AF', marginBottom: 8 },
    shareBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 6,
        borderRadius: 16, borderWidth: 1.5,
    },
    shareBtnText: { fontSize: 12, fontWeight: '600' },
});

export default PharmacyMultiOrderScreen;
