// ✅ Écran validation commande pharmacie (côté partenaire/pharmacien)
// - Affiche le détail complet de la commande (médicaments, patient, montant)
// - Bouton "Scanner QR" pour valider le retrait par le coursier ou le patient
// - Saisie manuelle du code QR comme alternative au scan caméra
// - Montre le statut du reversal financier
import { useNavigation, useRoute } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeInput } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { pharmacyService } from '../../services/pharmacyService';
import { hapticPress } from '../../utils/hapticFeedback';

const PharmacyOrderValidationScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { orderId } = (route.params as any) || {};

    const [loading, setLoading] = useState(true);
    const [validating, setValidating] = useState(false);
    const [order, setOrder] = useState<any>(null);
    const [showScanner, setShowScanner] = useState(false);
    const [manualCode, setManualCode] = useState('');
    const [permission, requestPermission] = useCameraPermissions();
    const scannedRef = useRef(false);

    useEffect(() => {
        loadOrder();
    }, [orderId]);

    const loadOrder = async () => {
        setLoading(true);
        const result = await pharmacyService.getOrderDetail(orderId);
        if (result.success && result.order) {
            setOrder(result.order);
        } else {
            Alert.alert('Erreur', result.error || 'Impossible de charger la commande');
        }
        setLoading(false);
    };

    const handleScannerOpen = async () => {
        hapticPress();
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                Alert.alert('Permission requise', 'Autorisez l\'accès à la caméra pour scanner le QR code.');
                return;
            }
        }
        scannedRef.current = false;
        setShowScanner(true);
    };

    const handleQRScanned = async (data: string) => {
        if (scannedRef.current) return;
        scannedRef.current = true;
        setShowScanner(false);
        await validateQR(data);
    };

    const handleManualValidation = async () => {
        if (!manualCode.trim()) {
            Alert.alert('Code requis', 'Saisissez le code QR');
            return;
        }
        await validateQR(manualCode.trim());
    };

    const validateQR = async (qrCode: string) => {
        hapticPress();
        setValidating(true);
        const result = await pharmacyService.validateOrderQR(qrCode);
        setValidating(false);

        if (result.success && result.validated) {
            Alert.alert(
                'Validation réussie',
                result.message || 'QR code validé avec succès',
                [{ text: 'OK', onPress: () => { setManualCode(''); loadOrder(); } }]
            );
        } else {
            Alert.alert(
                'Validation échouée',
                result.error || result.message || 'Ce QR code est invalide, expiré ou déjà utilisé.',
                [{ text: 'OK', onPress: () => { scannedRef.current = false; } }]
            );
        }
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            pending: '#F59E0B', confirmed: '#3B82F6', preparing: '#8B5CF6',
            ready: '#10B981', in_delivery: '#06B6D4', delivered: '#059669', cancelled: '#EF4444',
        };
        return colors[status] || '#6B7280';
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation',
            ready: 'Prête', in_delivery: 'En livraison', delivered: 'Livrée', cancelled: 'Annulée',
        };
        return labels[status] || status;
    };

    if (loading) {
        return (
            <SafeNativeView style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#EC4899" />
                <Text style={styles.loadingText}>Chargement...</Text>
            </SafeNativeView>
        );
    }

    if (!order) return null;

    const isDelivered = order.status === 'delivered';
    const isPickup = order.delivery_method === 'pickup';
    const qrPickup = order.qr_codes?.find((q: any) => q.qr_type === 'pickup');

    return (
        <SafeNativeView style={styles.container}>
            <LinearGradient colors={['#EC4899', '#F472B6']} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Validation commande</Text>
                    <Text style={styles.headerSubtitle} numberOfLines={1}>
                        #{orderId?.slice(0, 8)}
                    </Text>
                </View>
                <TouchableOpacity onPress={loadOrder} style={styles.backButton}>
                    <SafeIcon name="refresh-cw" size={20} color="#FFFFFF" type="lucide" />
                </TouchableOpacity>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Statut */}
                <View style={[styles.statusBanner, { borderColor: getStatusColor(order.status) }]}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(order.status) }]} />
                    <Text style={[styles.statusLabel, { color: getStatusColor(order.status) }]}>
                        {getStatusLabel(order.status)}
                    </Text>
                    {order.reversed && (
                        <View style={styles.reversedBadge}>
                            <SafeIcon name="check-circle" size={12} color="#059669" type="lucide" />
                            <Text style={styles.reversedText}>Paiement reçu</Text>
                        </View>
                    )}
                </View>

                {/* Infos patient */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Patient</Text>
                    <View style={styles.infoRow}>
                        <SafeIcon name="user" size={16} color="#6B7280" type="lucide" />
                        <Text style={styles.infoText}>{order.patient_nom || 'Patient'}</Text>
                    </View>
                    {order.patient_tel && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="phone" size={16} color="#6B7280" type="lucide" />
                            <Text style={styles.infoText}>{order.patient_tel}</Text>
                        </View>
                    )}
                    <View style={styles.infoRow}>
                        <SafeIcon name={isPickup ? 'store' : 'truck'} size={16} color="#6B7280" type="lucide" />
                        <Text style={styles.infoText}>
                            {isPickup ? 'Retrait direct en pharmacie' : `Livraison : ${order.delivery_address || 'Adresse non précisée'}`}
                        </Text>
                    </View>
                </View>

                {/* Médicaments */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Médicaments à préparer</Text>
                    {order.items?.map((item: any, idx: number) => (
                        <View key={idx} style={styles.itemRow}>
                            <View style={styles.itemInfo}>
                                <SafeIcon name="pill" size={14} color="#EC4899" type="lucide" />
                                <Text style={styles.itemName}>{item.medication_name}</Text>
                                <Text style={styles.itemQty}>× {item.quantity}</Text>
                            </View>
                            <Text style={styles.itemPrice}>
                                {Number(item.line_total).toLocaleString()} F
                            </Text>
                        </View>
                    ))}
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>
                            {Number(order.total_amount).toLocaleString()} FCFA
                        </Text>
                    </View>
                    {order.reversed && (
                        <View style={styles.financialSummary}>
                            <Text style={styles.financialRow}>
                                Commission Yukpo (2%) : -{order.yukpo_commission_fcfa?.toLocaleString()} F
                            </Text>
                            <Text style={styles.financialRowBold}>
                                Net reçu : {order.net_partner_amount_fcfa?.toLocaleString()} F
                            </Text>
                        </View>
                    )}
                </View>

                {/* Section validation QR */}
                {!isDelivered && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>
                            {isPickup ? 'Valider le retrait' : 'Valider la remise au coursier'}
                        </Text>
                        <Text style={styles.cardSubtitle}>
                            {isPickup
                                ? 'Scannez le QR code que le patient vous présente pour confirmer qu\'il repart avec ses médicaments et déclencher votre paiement.'
                                : 'Scannez le QR code du coursier pour confirmer la remise des médicaments. Votre paiement sera crédité lors de la livraison au patient.'}
                        </Text>

                        {/* Statut QR pickup */}
                        {qrPickup && (
                            <View style={[styles.qrStatusRow, {
                                backgroundColor: qrPickup.status === 'validated' ? '#F0FDF4' : '#FFF7ED'
                            }]}>
                                <SafeIcon
                                    name={qrPickup.status === 'validated' ? 'check-circle' : 'clock'}
                                    size={16}
                                    color={qrPickup.status === 'validated' ? '#059669' : '#F59E0B'}
                                    type="lucide"
                                />
                                <Text style={{ fontSize: 13, color: qrPickup.status === 'validated' ? '#059669' : '#92400E', fontWeight: '500' }}>
                                    QR retrait : {qrPickup.status === 'validated' ? 'Déjà validé' : 'En attente de scan'}
                                </Text>
                            </View>
                        )}

                        {/* Bouton scan caméra */}
                        <TouchableOpacity
                            style={styles.scanButton}
                            onPress={handleScannerOpen}
                            disabled={validating}
                            activeOpacity={0.8}
                        >
                            <LinearGradient colors={['#EC4899', '#F472B6']} style={styles.scanButtonGradient}>
                                {validating ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <SafeIcon name="scan" size={22} color="#FFFFFF" type="lucide" />
                                )}
                                <Text style={styles.scanButtonText}>
                                    {validating ? 'Validation...' : 'Scanner le QR code'}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Saisie manuelle */}
                        <Text style={styles.orText}>— ou saisir le code manuellement —</Text>
                        <View style={styles.manualRow}>
                            <View style={styles.manualInputWrapper}>
                                <NativeInput
                                    value={manualCode}
                                    onChangeText={setManualCode}
                                    placeholder="PHARM-PICKUP-XXXXXXXX"
                                    autoCapitalize="characters"
                                    returnKeyType="done"
                                    onSubmitEditing={handleManualValidation}
                                />
                            </View>
                            <TouchableOpacity
                                style={styles.manualValidateButton}
                                onPress={handleManualValidation}
                                disabled={validating || !manualCode.trim()}
                                activeOpacity={0.8}
                            >
                                <SafeIcon name="check" size={20} color="#FFFFFF" type="lucide" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {isDelivered && (
                    <View style={styles.completedCard}>
                        <SafeIcon name="check-circle" size={40} color="#059669" type="lucide" />
                        <Text style={styles.completedTitle}>Commande terminée</Text>
                        <Text style={styles.completedText}>
                            {order.reversed
                                ? `Votre paiement de ${order.net_partner_amount_fcfa?.toLocaleString()} F a été crédité.`
                                : 'Tous les QR codes ont été validés.'}
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* Scanner QR caméra */}
            <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
                <View style={styles.scannerContainer}>
                    <Text style={styles.scannerTitle}>Scanner le QR code du patient / coursier</Text>
                    <View style={styles.scannerView}>
                        <CameraView
                            style={styles.camera}
                            facing="back"
                            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                            onBarcodeScanned={({ data }) => handleQRScanned(data)}
                        />
                        <View style={styles.scannerOverlay}>
                            <View style={styles.scannerFrame} />
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.scannerCancelButton}
                        onPress={() => { setShowScanner(false); scannedRef.current = false; }}
                    >
                        <Text style={styles.scannerCancelText}>Annuler</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14, color: '#6B7280' },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20, gap: 12,
    },
    backButton: { padding: 4 },
    headerContent: { flex: 1 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
    headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    content: { padding: 16, gap: 16 },
    statusBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12,
        borderWidth: 2,
    },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    statusLabel: { flex: 1, fontSize: 15, fontWeight: '700' },
    reversedBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    },
    reversedText: { fontSize: 11, color: '#059669', fontWeight: '600' },
    card: {
        backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 10,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
    cardSubtitle: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    infoText: { fontSize: 14, color: '#374151', flex: 1 },
    itemRow: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', paddingVertical: 6,
        borderTopWidth: 1, borderTopColor: '#F3F4F6',
    },
    itemInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    itemName: { fontSize: 14, color: '#111827', fontWeight: '500', flex: 1 },
    itemQty: { fontSize: 13, color: '#6B7280' },
    itemPrice: { fontSize: 14, color: '#374151', fontWeight: '600' },
    totalRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 8, borderTopWidth: 2, borderTopColor: '#E5E7EB',
    },
    totalLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
    totalValue: { fontSize: 18, fontWeight: '700', color: '#EC4899' },
    financialSummary: {
        backgroundColor: '#F0FDF4', borderRadius: 8, padding: 10, gap: 4,
        borderWidth: 1, borderColor: '#BBF7D0',
    },
    financialRow: { fontSize: 12, color: '#6B7280' },
    financialRowBold: { fontSize: 14, color: '#059669', fontWeight: '700' },
    qrStatusRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        borderRadius: 8, padding: 10,
    },
    scanButton: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
    scanButtonGradient: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 16, gap: 10,
    },
    scanButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    orText: { textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginVertical: 4 },
    manualRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    manualInputWrapper: { flex: 1 },
    manualValidateButton: {
        width: 48, height: 48, borderRadius: 12,
        backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center',
    },
    completedCard: {
        backgroundColor: '#F0FDF4', borderRadius: 16, padding: 24,
        alignItems: 'center', gap: 10,
        borderWidth: 2, borderColor: '#BBF7D0',
    },
    completedTitle: { fontSize: 18, fontWeight: '700', color: '#059669' },
    completedText: { fontSize: 14, color: '#374151', textAlign: 'center', lineHeight: 20 },
    // Scanner
    scannerContainer: { flex: 1, backgroundColor: '#000' },
    scannerTitle: {
        color: '#FFFFFF', fontSize: 16, fontWeight: '600',
        textAlign: 'center', padding: 20, paddingTop: 60,
    },
    scannerView: { flex: 1, position: 'relative' },
    camera: { flex: 1 },
    scannerOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'center', alignItems: 'center',
    },
    scannerFrame: {
        width: 240, height: 240, borderRadius: 12,
        borderWidth: 3, borderColor: '#EC4899',
    },
    scannerCancelButton: {
        margin: 24, padding: 16, backgroundColor: '#374151', borderRadius: 12, alignItems: 'center',
    },
    scannerCancelText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

export default PharmacyOrderValidationScreen;
