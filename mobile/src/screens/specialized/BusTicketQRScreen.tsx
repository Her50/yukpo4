/**
 * Écran d'affichage du QR code d'un ticket de bus - permet l'embarquement
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import React from 'react';
import {
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import SafeIcon from '../../components/SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { modernColors } from '../../theme/modernTheme';

const BusTicketQRScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute();
    const { qrData, ticketInfo } = (route.params as any) || {};

    const handleShare = async () => {
        try {
            const info = ticketInfo || {};
            const message = `Mon ticket de bus\n${info.departure_city || '?'} → ${info.arrival_city || '?'}\n${info.departure_date || ''} ${info.departure_time ? info.departure_time.substring(0, 5) : ''}\n${info.number_of_tickets || 1} place(s)${info.bus_number ? `\nBus #${info.bus_number}` : ''}`;
            await Share.share({ message });
        } catch (e) {
            console.log('Share error:', e);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>{t('busTicketQR.monTicketQr')}</Text>
                <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
                    <SafeIcon name="share" size={20} color={modernColors.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Trip Info */}
                {ticketInfo && (
                    <View style={styles.tripCard}>
                        <View style={styles.routeRow}>
                            <View style={styles.cityBlock}>
                                <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                                <Text style={styles.cityName}>{ticketInfo.departure_city}</Text>
                            </View>
                            <SafeIcon name="arrow-right" size={18} color="#9CA3AF" />
                            <View style={styles.cityBlock}>
                                <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                                <Text style={styles.cityName}>{ticketInfo.arrival_city}</Text>
                            </View>
                        </View>
                        <View style={styles.detailsRow}>
                            <View style={styles.detailItem}>
                                <SafeIcon name="calendar" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{ticketInfo.departure_date}</Text>
                            </View>
                            {ticketInfo.departure_time && (
                                <View style={styles.detailItem}>
                                    <SafeIcon name="clock" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{ticketInfo.departure_time.substring(0, 5)}</Text>
                                </View>
                            )}
                            <View style={styles.detailItem}>
                                <SafeIcon name="users" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{ticketInfo.number_of_tickets} place(s)</Text>
                            </View>
                        </View>
                        {ticketInfo.bus_number && (
                            <View style={styles.busBadge}>
                                <SafeIcon name="bus" size={14} color="#2563EB" />
                                <Text style={styles.busBadgeText}>Bus #{ticketInfo.bus_number}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* QR Code */}
                <View style={styles.qrCard}>
                    <Text style={styles.qrTitle}>{t('busTicketQR.presentezCeQrCodeA')}</Text>
                    <View style={styles.qrContainer}>
                        {qrData ? (
                            <QRCode
                                value={qrData}
                                size={240}
                                color="#111827"
                                backgroundColor="#FFFFFF"
                            />
                        ) : (
                            <View style={styles.noQR}>
                                <SafeIcon name="alert-circle" size={48} color="#9CA3AF" />
                                <Text style={styles.noQRText}>{t('busTicketQR.qrCodeNonDisponible')}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.qrHint}>
                        Le conducteur ou l'agent scannera ce code pour valider votre embarquement
                    </Text>
                </View>

                {/* Instructions */}
                <View style={styles.instructionsCard}>
                    <Text style={styles.instructionsTitle}>Instructions</Text>
                    {[
                        { icon: 'clock', text: t('busTicketQR.presentezvous15MinAvantLe') },
                        { icon: 'smartphone', text: t('busTicketQR.gardezVotreEcranAllumePour') },
                        { icon: 'shield', text: 'Ne partagez pas ce QR code' },
                    ].map((item, i) => (
                        <View key={i} style={styles.instructionRow}>
                            <SafeIcon name={item.icon as any} size={16} color="#2563EB" />
                            <Text style={styles.instructionText}>{item.text}</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    backButton: { padding: 4 },
    title: { fontSize: 18, fontWeight: '700', color: '#111827' },
    shareButton: { padding: 4 },
    content: { padding: 16, paddingBottom: 40 },
    tripCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
    routeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 12 },
    cityBlock: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    cityName: { fontSize: 16, fontWeight: '700', color: '#111827' },
    detailsRow: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
    detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    detailText: { fontSize: 13, color: '#6B7280' },
    busBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 4, paddingHorizontal: 12, backgroundColor: '#EFF6FF', borderRadius: 8, alignSelf: 'center' },
    busBadgeText: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
    qrCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, marginBottom: 16, alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
    qrTitle: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 20, textAlign: 'center' },
    qrContainer: { padding: 16, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 2, borderColor: '#E5E7EB' },
    noQR: { alignItems: 'center', padding: 40 },
    noQRText: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },
    qrHint: { fontSize: 12, color: '#9CA3AF', marginTop: 16, textAlign: 'center', lineHeight: 18 },
    instructionsCard: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 16 },
    instructionsTitle: { fontSize: 15, fontWeight: '700', color: '#1E3A8A', marginBottom: 12 },
    instructionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    instructionText: { fontSize: 13, color: '#374151', flex: 1 },
});

export default BusTicketQRScreen;
