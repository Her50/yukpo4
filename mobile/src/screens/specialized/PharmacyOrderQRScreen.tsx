// ✅ Écran QR codes commande pharmacie (patient)
// - Affiche QR "pickup" : à montrer à la pharmacie (pickup direct) OU au coursier (qui le montre à la pharmacie)
// - Affiche QR "delivery" : à montrer au coursier lors de la réception des médicaments (mode livraison)
import { useNavigation, useRoute } from '@react-navigation/native';
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
import { LinearGradient } from 'expo-linear-gradient';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { pharmacyService } from '../../services/pharmacyService';
import { hapticPress } from '../../utils/hapticFeedback';

interface QRInfo {
    qr_code: string;
    status: string;
    expires_at: string;
}

const PharmacyOrderQRScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { orderId } = (route.params as any) || {};

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{
        order_status: string;
        delivery_method: string;
        pharmacy_nom: string;
        pharmacy_tel?: string;
        total_amount: string;
        reversed: boolean;
        qr_pickup?: QRInfo | null;
        qr_delivery?: QRInfo | null;
    } | null>(null);

    useEffect(() => {
        if (!orderId) {
            Alert.alert('Erreur', 'Identifiant de commande manquant');
            navigation.goBack();
            return;
        }
        loadQR();
    }, [orderId]);

    const loadQR = async () => {
        setLoading(true);
        const result = await pharmacyService.getOrderQRCodes(orderId);
        if (result.success) {
            setData({
                order_status: result.order_status || 'pending',
                delivery_method: result.delivery_method || 'pickup',
                pharmacy_nom: result.pharmacy_nom || 'Pharmacie',
                pharmacy_tel: result.pharmacy_tel,
                total_amount: result.total_amount || '0',
                reversed: result.reversed || false,
                qr_pickup: result.qr_pickup,
                qr_delivery: result.qr_delivery,
            });
        } else {
            Alert.alert('Erreur', result.error || 'Impossible de charger les QR codes');
        }
        setLoading(false);
    };

    const shareQR = async (qrCode: string, type: 'pickup' | 'delivery') => {
        hapticPress();
        try {
            await Share.share({
                message: `Yukpo Pharmacie - Code ${type === 'pickup' ? 'retrait' : 'livraison'}: ${qrCode}`,
                title: 'QR Code Commande Pharmacie',
            });
        } catch {}
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, { label: string; color: string }> = {
            pending: { label: 'En attente', color: '#F59E0B' },
            confirmed: { label: 'Confirmée', color: '#3B82F6' },
            preparing: { label: 'Préparation', color: '#8B5CF6' },
            ready: { label: 'Prête', color: '#10B981' },
            in_delivery: { label: 'En livraison', color: '#06B6D4' },
            delivered: { label: 'Livrée ✓', color: '#059669' },
            cancelled: { label: 'Annulée', color: '#EF4444' },
        };
        return labels[status] || { label: status, color: '#6B7280' };
    };

    if (loading) {
        return (
            <SafeNativeView style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#EC4899" />
                <Text style={styles.loadingText}>Chargement des QR codes...</Text>
            </SafeNativeView>
        );
    }

    if (!data) return null;

    const isDelivery = data.delivery_method === 'delivery';
    const statusInfo = getStatusLabel(data.order_status);

    return (
        <SafeNativeView style={styles.container}>
            <LinearGradient colors={['#EC4899', '#F472B6']} style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Mes QR codes</Text>
                    <Text style={styles.headerSubtitle}>{data.pharmacy_nom}</Text>
                </View>
                <TouchableOpacity style={styles.refreshButton} onPress={loadQR}>
                    <SafeIcon name="refresh-cw" size={20} color="#FFFFFF" type="lucide" />
                </TouchableOpacity>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Statut + montant */}
                <View style={styles.summaryCard}>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Statut</Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
                            <Text style={[styles.statusText, { color: statusInfo.color }]}>
                                {statusInfo.label}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Mode</Text>
                        <Text style={styles.summaryValue}>
                            {isDelivery ? '🛵 Livraison à domicile' : '🏪 Retrait en pharmacie'}
                        </Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Montant</Text>
                        <Text style={styles.summaryValueBold}>
                            {Number(data.total_amount).toLocaleString()} FCFA
                        </Text>
                    </View>
                    {data.reversed && (
                        <View style={styles.reversedBadge}>
                            <SafeIcon name="check-circle" size={14} color="#059669" type="lucide" />
                            <Text style={styles.reversedText}>Paiement pharmacien confirmé</Text>
                        </View>
                    )}
                </View>

                {/* ─── QR PICKUP ─── */}
                {data.qr_pickup && (
                    <View style={styles.qrCard}>
                        <View style={styles.qrCardHeader}>
                            <View style={styles.qrCardIconContainer}>
                                <SafeIcon name="package" size={20} color="#EC4899" type="lucide" />
                            </View>
                            <View style={styles.qrCardTitleContainer}>
                                <Text style={styles.qrCardTitle}>
                                    {isDelivery ? 'QR Retrait (pour le coursier)' : 'QR Retrait en pharmacie'}
                                </Text>
                                <Text style={styles.qrCardSubtitle}>
                                    {isDelivery
                                        ? 'Le coursier montre ce QR à la pharmacie pour récupérer vos médicaments'
                                        : 'Montrez ce QR à la pharmacie lors de votre retrait'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.qrContainer}>
                            {data.qr_pickup.status === 'validated' ? (
                                <View style={styles.qrValidated}>
                                    <SafeIcon name="check-circle" size={48} color="#059669" type="lucide" />
                                    <Text style={styles.qrValidatedText}>QR scanné ✓</Text>
                                    <Text style={styles.qrValidatedSubtext}>
                                        {isDelivery ? 'Médicaments remis au coursier' : 'Retrait validé'}
                                    </Text>
                                </View>
                            ) : (
                                <QRCode
                                    value={data.qr_pickup.qr_code}
                                    size={200}
                                    color="#111827"
                                    backgroundColor="#FFFFFF"
                                />
                            )}
                        </View>

                        <Text style={styles.qrCode}>{data.qr_pickup.qr_code}</Text>
                        <Text style={styles.qrExpiry}>
                            Expire le {new Date(data.qr_pickup.expires_at).toLocaleDateString('fr-FR', {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                        </Text>

                        {data.qr_pickup.status !== 'validated' && (
                            <TouchableOpacity
                                style={styles.shareButton}
                                onPress={() => shareQR(data.qr_pickup!.qr_code, 'pickup')}
                            >
                                <SafeIcon name="share-2" size={16} color="#EC4899" type="lucide" />
                                <Text style={styles.shareButtonText}>Partager le code</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* ─── QR DELIVERY (mode livraison seulement) ─── */}
                {isDelivery && data.qr_delivery && (
                    <View style={styles.qrCard}>
                        <View style={styles.qrCardHeader}>
                            <View style={[styles.qrCardIconContainer, { backgroundColor: '#EFF6FF' }]}>
                                <SafeIcon name="home" size={20} color="#3B82F6" type="lucide" />
                            </View>
                            <View style={styles.qrCardTitleContainer}>
                                <Text style={styles.qrCardTitle}>QR Réception (pour vous)</Text>
                                <Text style={styles.qrCardSubtitle}>
                                    Montrez ce QR au coursier quand il vous livre vos médicaments
                                </Text>
                            </View>
                        </View>

                        <View style={styles.qrContainer}>
                            {data.qr_delivery.status === 'validated' ? (
                                <View style={styles.qrValidated}>
                                    <SafeIcon name="check-circle" size={48} color="#059669" type="lucide" />
                                    <Text style={styles.qrValidatedText}>Livraison confirmée ✓</Text>
                                </View>
                            ) : (
                                <QRCode
                                    value={data.qr_delivery.qr_code}
                                    size={200}
                                    color="#111827"
                                    backgroundColor="#FFFFFF"
                                />
                            )}
                        </View>

                        <Text style={styles.qrCode}>{data.qr_delivery.qr_code}</Text>
                        <Text style={styles.qrExpiry}>
                            Expire le {new Date(data.qr_delivery.expires_at).toLocaleDateString('fr-FR', {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                        </Text>
                    </View>
                )}

                {/* Info */}
                <View style={styles.infoCard}>
                    <SafeIcon name="info" size={16} color="#3B82F6" type="lucide" />
                    <Text style={styles.infoText}>
                        {isDelivery
                            ? 'Le coursier récupère vos médicaments à la pharmacie avec le QR retrait, puis vous livre et scanne le QR réception.'
                            : 'Présentez le QR retrait à la pharmacie pour récupérer vos médicaments. Le paiement est déjà effectué.'}
                    </Text>
                </View>
            </ScrollView>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14, color: '#6B7280' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 20,
        gap: 12,
    },
    backButton: { padding: 4 },
    refreshButton: { padding: 4 },
    headerContent: { flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
    headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    content: { padding: 16, gap: 16 },
    summaryCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    summaryLabel: { fontSize: 14, color: '#6B7280' },
    summaryValue: { fontSize: 14, color: '#111827', fontWeight: '500' },
    summaryValueBold: { fontSize: 16, color: '#111827', fontWeight: '700' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    statusText: { fontSize: 13, fontWeight: '700' },
    reversedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F0FDF4',
        borderRadius: 8,
        padding: 8,
    },
    reversedText: { fontSize: 12, color: '#059669', fontWeight: '500' },
    qrCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    qrCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 20, alignSelf: 'stretch' },
    qrCardIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    qrCardTitleContainer: { flex: 1 },
    qrCardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
    qrCardSubtitle: { fontSize: 12, color: '#6B7280', lineHeight: 17 },
    qrContainer: {
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#F3F4F6',
        marginBottom: 12,
    },
    qrValidated: { alignItems: 'center', padding: 24, gap: 8 },
    qrValidatedText: { fontSize: 16, fontWeight: '700', color: '#059669' },
    qrValidatedSubtext: { fontSize: 13, color: '#6B7280' },
    qrCode: { fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace', marginBottom: 4 },
    qrExpiry: { fontSize: 11, color: '#9CA3AF', marginBottom: 12 },
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#EC4899',
    },
    shareButtonText: { fontSize: 13, color: '#EC4899', fontWeight: '600' },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    infoText: { flex: 1, fontSize: 12, color: '#1E40AF', lineHeight: 17 },
});

export default PharmacyOrderQRScreen;
