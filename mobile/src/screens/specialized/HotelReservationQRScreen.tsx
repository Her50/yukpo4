// ✅ NOUVEAU: Écran client pour afficher QR réservation + partage + QR invité
// Date: 2026-01-27

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeButton } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { immobilierService } from '../../services/immobilierService';
import { modernColors } from '../../theme/modernTheme';
import { notify } from '../../utils/notify';

type RouteParams = {
    reservationId: number;
    propertyName?: string;
};

interface QRCodeInfo {
    qr_code: string;
    qr_code_url?: string;
    qr_type: 'main' | 'guest';
    guest_label?: string | null;
    expires_at: string;
    status?: string;
}

const HotelReservationQRScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { user } = useAuth();
    const reservationId = route.params?.reservationId;
    const propertyName = route.params?.propertyName || 'Votre réservation';

    const [mainQR, setMainQR] = useState<QRCodeInfo | null>(null);
    const [guestQRs, setGuestQRs] = useState<QRCodeInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [generatingGuest, setGeneratingGuest] = useState(false);
    const [showGuestLabelInput, setShowGuestLabelInput] = useState(false);
    const [guestLabel, setGuestLabel] = useState('Invité / Co-chambrier');

    useEffect(() => {
        loadQRCodes();
    }, [reservationId]);

    const loadQRCodes = async () => {
        try {
            setLoading(true);
            // Utiliser le nouvel endpoint qui liste tous les QR (principal + invités)
            const response = await immobilierService.getReservationQRCodes(reservationId);
            
            if (response.success && response.data) {
                // Séparer QR principal et QR invités
                const mainQRData = response.data.qr_codes.find(qr => qr.qr_type === 'main');
                const guestQRsData = response.data.qr_codes.filter(qr => qr.qr_type === 'guest');
                
                if (mainQRData) {
                    setMainQR({
                        qr_code: mainQRData.qr_code,
                        qr_code_url: mainQRData.qr_code_url,
                        qr_type: 'main',
                        expires_at: mainQRData.expires_at,
                    });
                }
                
                setGuestQRs(guestQRsData.map(qr => ({
                    qr_code: qr.qr_code,
                    qr_code_url: qr.qr_code_url,
                    qr_type: 'guest',
                    guest_label: qr.guest_label,
                    expires_at: qr.expires_at,
                })));
            }
        } catch (error: any) {
            console.error('[HotelReservationQR] Erreur chargement QR:', error);
            notify.error('Impossible de charger le QR code');
        } finally {
            setLoading(false);
        }
    };

    const handleShareQR = async (qrCode: string, qrType: 'main' | 'guest') => {
        try {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qrCode)}`;
            const message = qrType === 'main'
                ? `Mon QR code de réservation pour ${propertyName}:\n\n${qrCode}`
                : `QR code invité pour ${propertyName}:\n\n${qrCode}`;

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(qrUrl, {
                    mimeType: 'image/png',
                    dialogTitle: 'Partager le QR code',
                });
            } else {
                // Fallback: copier dans le presse-papier
                await Clipboard.setStringAsync(qrCode);
                notify.success('QR code copié dans le presse-papier');
            }
        } catch (error: any) {
            console.error('[HotelReservationQR] Erreur partage:', error);
            notify.error('Erreur lors du partage');
        }
    };

    const handleGenerateGuestQR = async () => {
        if (!guestLabel.trim()) {
            notify.error('Veuillez renseigner un label pour l\'invité');
            return;
        }

        try {
            setGeneratingGuest(true);
            const response = await immobilierService.generateGuestQR(reservationId, guestLabel.trim());
            if (response.success && response.data) {
                const newGuestQR: QRCodeInfo = {
                    qr_code: response.data.qr_code,
                    qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(response.data.qr_code)}`,
                    qr_type: 'guest',
                    guest_label: response.data.guest_label,
                    expires_at: response.data.expires_at,
                };
                setGuestQRs([...guestQRs, newGuestQR]);
                setShowGuestLabelInput(false);
                setGuestLabel('Invité / Co-chambrier');
                notify.success('QR invité généré avec succès');
            } else {
                notify.error('Impossible de générer le QR invité');
            }
        } catch (error: any) {
            console.error('[HotelReservationQR] Erreur génération QR invité:', error);
            notify.error(error.message || 'Erreur lors de la génération');
        } finally {
            setGeneratingGuest(false);
        }
    };

    if (loading) {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Chargement du QR code...</Text>
                </View>
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.title}>QR Code réservation</Text>
                    <Text style={styles.subtitle}>{propertyName}</Text>
                </View>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* QR Principal */}
                {mainQR && (
                    <View style={styles.qrSection}>
                        <View style={styles.qrSectionHeader}>
                            <View style={styles.qrBadgeMain}>
                                <SafeIcon name="user" size={16} color="#1D4ED8" />
                                <Text style={styles.qrBadgeTextMain}>QR Titulaire</Text>
                            </View>
                        </View>
                        <View style={styles.qrContainer}>
                            {mainQR.qr_code_url ? (
                                <Image
                                    source={{ uri: mainQR.qr_code_url }}
                                    style={styles.qrImage}
                                    resizeMode="contain"
                                />
                            ) : (
                                <View style={styles.qrPlaceholder}>
                                    <Text style={styles.qrCodeText}>{mainQR.qr_code}</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.qrCodeValue}>{mainQR.qr_code}</Text>
                        <Text style={styles.qrExpiry}>
                            Expire le {new Date(mainQR.expires_at).toLocaleDateString('fr-FR')}
                        </Text>
                        <NativeButton
                            title="📤 Partager mon QR"
                            onPress={() => handleShareQR(mainQR.qr_code, 'main')}
                            variant="primary"
                            style={styles.shareButton}
                        />
                    </View>
                )}

                {/* QR Invités */}
                <View style={styles.guestSection}>
                    <View style={styles.guestSectionHeader}>
                        <Text style={styles.guestSectionTitle}>QR Codes invités</Text>
                        <Text style={styles.guestSectionSubtitle}>
                            Partagez un QR code avec vos co-chambriers
                        </Text>
                    </View>

                    {guestQRs.length > 0 && (
                        <View style={styles.guestQRsList}>
                            {guestQRs.map((guestQR, index) => (
                                <View key={index} style={styles.guestQRCard}>
                                    <View style={styles.qrBadgeGuest}>
                                        <SafeIcon name="users" size={16} color="#7C3AED" />
                                        <Text style={styles.qrBadgeTextGuest}>
                                            {guestQR.guest_label || 'Invité / Co-chambrier'}
                                        </Text>
                                    </View>
                                    <View style={styles.qrContainerSmall}>
                                        {guestQR.qr_code_url ? (
                                            <Image
                                                source={{ uri: guestQR.qr_code_url }}
                                                style={styles.qrImageSmall}
                                                resizeMode="contain"
                                            />
                                        ) : (
                                            <View style={styles.qrPlaceholderSmall}>
                                                <Text style={styles.qrCodeTextSmall}>{guestQR.qr_code}</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.qrCodeValueSmall}>{guestQR.qr_code}</Text>
                                    <NativeButton
                                        title="Partager"
                                        onPress={() => handleShareQR(guestQR.qr_code, 'guest')}
                                        variant="secondary"
                                        size="small"
                                        style={styles.shareButtonSmall}
                                    />
                                </View>
                            ))}
                        </View>
                    )}

                    {showGuestLabelInput ? (
                        <View style={styles.guestLabelInput}>
                            <Text style={styles.inputLabel}>Label de l'invité</Text>
                            <Text style={styles.inputHint}>
                                Ex: "Amie / Co-chambrière", "Collègue", "Famille"...
                            </Text>
                            <View style={styles.inputRow}>
                                <TextInput
                                    style={styles.input}
                                    value={guestLabel}
                                    onChangeText={setGuestLabel}
                                    placeholder="Invité / Co-chambrier"
                                />
                                <TouchableOpacity
                                    onPress={handleGenerateGuestQR}
                                    disabled={generatingGuest}
                                    style={styles.generateButton}
                                >
                                    {generatingGuest ? (
                                        <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                        <SafeIcon name="check" size={20} color="#FFF" />
                                    )}
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowGuestLabelInput(false);
                                    setGuestLabel('Invité / Co-chambrier');
                                }}
                                style={styles.cancelButton}
                            >
                                <Text style={styles.cancelButtonText}>Annuler</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <NativeButton
                            title="➕ Générer un QR invité"
                            onPress={() => setShowGuestLabelInput(true)}
                            variant="outline"
                            style={styles.generateGuestButton}
                        />
                    )}
                </View>

                {/* Instructions */}
                <View style={styles.infoCard}>
                    <SafeIcon name="info" size={20} color={modernColors.primary} />
                    <Text style={styles.infoTitle}>Comment utiliser</Text>
                    <Text style={styles.infoText}>
                        • Présentez votre QR code à l'accueil lors de votre arrivée{'\n'}
                        • Partagez un QR invité avec vos co-chambriers pour qu'ils puissent aussi accéder{'\n'}
                        • Le QR code expire automatiquement après votre séjour
                    </Text>
                </View>
            </ScrollView>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 8,
    },
    headerContent: {
        flex: 1,
        marginLeft: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    headerSpacer: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    qrSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        alignItems: 'center',
        ...modernColors.shadowLight,
    },
    qrSectionHeader: {
        width: '100%',
        marginBottom: 16,
    },
    qrBadgeMain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        backgroundColor: '#DBEAFE',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
    },
    qrBadgeTextMain: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1D4ED8',
    },
    qrContainer: {
        width: 250,
        height: 250,
        backgroundColor: '#fff',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
    qrImage: {
        width: '100%',
        height: '100%',
    },
    qrPlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    qrCodeText: {
        fontSize: 10,
        color: '#6B7280',
        textAlign: 'center',
    },
    qrCodeValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 8,
        textAlign: 'center',
    },
    qrExpiry: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 16,
    },
    shareButton: {
        width: '100%',
    },
    guestSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        ...modernColors.shadowLight,
    },
    guestSectionHeader: {
        marginBottom: 16,
    },
    guestSectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    guestSectionSubtitle: {
        fontSize: 14,
        color: '#6B7280',
    },
    guestQRsList: {
        marginBottom: 16,
    },
    guestQRCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        alignItems: 'center',
    },
    qrBadgeGuest: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F3E8FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        marginBottom: 12,
    },
    qrBadgeTextGuest: {
        fontSize: 12,
        fontWeight: '600',
        color: '#7C3AED',
    },
    qrContainerSmall: {
        width: 180,
        height: 180,
        backgroundColor: '#fff',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
    qrImageSmall: {
        width: '100%',
        height: '100%',
    },
    qrPlaceholderSmall: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 12,
    },
    qrCodeTextSmall: {
        fontSize: 9,
        color: '#6B7280',
        textAlign: 'center',
    },
    qrCodeValueSmall: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 8,
        textAlign: 'center',
    },
    shareButtonSmall: {
        width: '100%',
    },
    guestLabelInput: {
        marginTop: 8,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 4,
    },
    inputHint: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 12,
    },
    inputRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        backgroundColor: '#FFFFFF',
    },
    generateButton: {
        backgroundColor: modernColors.primary,
        borderRadius: 8,
        padding: 12,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 48,
    },
    cancelButton: {
        padding: 8,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 14,
        color: '#6B7280',
    },
    generateGuestButton: {
        width: '100%',
    },
    infoCard: {
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1D4ED8',
        marginTop: 8,
        marginBottom: 8,
    },
    infoText: {
        fontSize: 14,
        color: '#1F2937',
        lineHeight: 20,
    },
});

export default HotelReservationQRScreen;

