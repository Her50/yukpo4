/**
 * Écran de scan QR pour validation de tickets de bus (côté partenaire/agence)
 * Utilise le composant QRCodeScanner existant
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import QRCodeScanner from '../../components/QRCodeScanner';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import { trackQRScan } from '../../services/analytics';
import { apiPost } from '../../services/api';

interface ValidationResult {
    success: boolean;
    passenger_name?: string;
    seat_number?: number;
    departure_city?: string;
    arrival_city?: string;
    departure_date?: string;
    boarding_status?: string;
    error?: string;
}

const BusTicketQRScannerScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const [scannerVisible, setScannerVisible] = useState(true);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ValidationResult | null>(null);
    const [scanCount, setScanCount] = useState(0);

    const handleScan = useCallback(async (qrData: string) => {
        setLoading(true);
        setScannerVisible(false);
        try {
            const response = await apiPost('/api/bus-tickets/validate/qr', {
                qr_code_data: qrData,
            });
            const d = (response?.data || response) as any;

            trackQRScan(d.success as boolean);

            if (d.success) {
                setScanCount(prev => prev + 1);
                setResult({
                    success: true,
                    passenger_name: d.passenger_name || d.validation?.passenger_name,
                    seat_number: d.seat_number || d.validation?.seat_number,
                    departure_city: d.departure_city,
                    arrival_city: d.arrival_city,
                    departure_date: d.departure_date,
                    boarding_status: d.boarding_status || 'boarded',
                });
            } else {
                setResult({
                    success: false,
                    error: d.error || 'Ticket invalide ou déjà validé',
                });
            }
        } catch (error: any) {
            setResult({
                success: false,
                error: error.message || 'Erreur de validation',
            });
        } finally {
            setLoading(false);
        }
    }, []);

    const handleScanAgain = () => {
        setResult(null);
        setScannerVisible(true);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Scanner Ticket Bus</Text>
                    <Text style={styles.subtitle}>{scanCount} ticket(s) validé(s)</Text>
                </View>
            </View>

            {scannerVisible ? (
                <View style={styles.scannerContainer}>
                    <QRCodeScanner
                        visible={scannerVisible}
                        onClose={() => setScannerVisible(false)}
                        onScan={handleScan}
                    />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.resultContainer}>
                    {loading ? (
                        <View style={styles.loadingCard}>
                            <Text style={styles.loadingText}>Validation en cours...</Text>
                        </View>
                    ) : result ? (
                        <View style={[styles.resultCard, { borderLeftColor: result.success ? '#10B981' : '#EF4444' }]}>
                            <View style={[styles.resultIcon, { backgroundColor: result.success ? '#D1FAE5' : '#FEE2E2' }]}>
                                <SafeIcon
                                    name={result.success ? 'check-circle' : 'x-circle'}
                                    size={48}
                                    color={result.success ? '#10B981' : '#EF4444'}
                                />
                            </View>

                            <Text style={[styles.resultTitle, { color: result.success ? '#059669' : '#DC2626' }]}>
                                {result.success ? 'Ticket Validé ✓' : 'Validation Échouée'}
                            </Text>

                            {result.success ? (
                                <>
                                    {result.passenger_name && (
                                        <View style={styles.infoRow}>
                                            <SafeIcon name="user" size={16} color="#6B7280" />
                                            <Text style={styles.infoText}>{result.passenger_name}</Text>
                                        </View>
                                    )}
                                    {result.seat_number && (
                                        <View style={styles.infoRow}>
                                            <SafeIcon name="armchair" size={16} color="#6B7280" />
                                            <Text style={styles.infoText}>Place n°{result.seat_number}</Text>
                                        </View>
                                    )}
                                    {result.departure_city && result.arrival_city && (
                                        <View style={styles.infoRow}>
                                            <SafeIcon name="map-pin" size={16} color="#6B7280" />
                                            <Text style={styles.infoText}>{result.departure_city} → {result.arrival_city}</Text>
                                        </View>
                                    )}
                                </>
                            ) : (
                                <Text style={styles.errorText}>{result.error}</Text>
                            )}

                            <View style={styles.actionsRow}>
                                <NativeButton
                                    title="Scanner un autre"
                                    onPress={handleScanAgain}
                                    variant="primary"
                                    size="large"
                                    style={{ flex: 1 }}
                                />
                            </View>
                        </View>
                    ) : null}
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    backButton: { marginRight: 12, padding: 4 },
    title: { fontSize: 18, fontWeight: '700', color: '#111827' },
    subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    scannerContainer: { flex: 1 },
    resultContainer: { padding: 16, paddingBottom: 40 },
    loadingCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 40, alignItems: 'center' },
    loadingText: { fontSize: 16, color: '#6B7280', fontWeight: '500' },
    resultCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, alignItems: 'center', borderLeftWidth: 4, elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
    resultIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    resultTitle: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, alignSelf: 'stretch', paddingHorizontal: 12 },
    infoText: { fontSize: 15, color: '#374151' },
    errorText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 16 },
    actionsRow: { flexDirection: 'row', gap: 12, marginTop: 24, alignSelf: 'stretch' },
});

export default BusTicketQRScannerScreen;
