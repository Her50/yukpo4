// @ts-nocheck
// ✅ Écran de partage et scan QR codes pour livraisons

import React, { useState, useCallback } from 'react';
import {
    Alert,
    ActivityIndicator,
    Linking,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import SafeIcon from '../components/SafeIcon';
import { NativeButton } from '../components/SafeNativeDesign';
import { useToaster } from '../components/ToasterProvider';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiGet, apiPost } from '../services/api';
import { modernColors, modernStyles } from '../theme/modernTheme';

interface QRCodeShareScreenProps {
    commandeId?: string;
    deliveryId?: string;
    mode?: 'share' | 'scan';
}

const QRCodeShareScreen: React.FC<QRCodeShareScreenProps> = ({
    commandeId,
    deliveryId,
    mode = 'share'
}) => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const toaster = useToaster();

    const [loading, setLoading] = useState(false);
    const [qrData, setQRData] = useState<any>(null);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [scanned, setScanned] = useState(false);

    // Demander la permission pour la caméra
    const requestCameraPermission = useCallback(async () => {
        const { status } = await BarCodeScanner.requestPermissionsAsync();
        setHasPermission(status === 'granted');
        return status === 'granted';
    }, []);

    // Générer un QR code partageable
    const generateQRCode = useCallback(async () => {
        if (!commandeId && !deliveryId) {
            Alert.alert('Erreur', 'ID de commande ou livraison requis');
            return;
        }

        setLoading(true);
        
        try {
            const payload = {
                commande_id: commandeId,
                delivery_id: deliveryId,
                valide_jusqua: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
            };

            const response = await apiPost('/api/librairie-network/qrcode/share', payload);
            
            if (response.success) {
                setQRData(response);
                toaster?.show?.('QR code généré avec succès', 'success');
            } else {
                Alert.alert('Erreur', response.message || 'Erreur génération QR code');
            }
        } catch (error: any) {
            console.error('Erreur génération QR:', error);
            Alert.alert(
                'Erreur',
                error.response?.data?.message || 'Erreur génération QR code'
            );
        } finally {
            setLoading(false);
        }
    }, [commandeId, deliveryId, toaster]);

    // Partager le QR code
    const shareQRCode = useCallback(async () => {
        if (!qrData) return;

        try {
            const shareOptions = {
                message: `📦 Yukpo - Code de livraison\n\nQR ID: ${qrData.qr_id}\nURL: ${qrData.share_url}\n\nScannez ce code pour valider la livraison.`,
                url: qrData.share_url,
                title: 'Code de livraison Yukpo',
            };

            await Share.share(shareOptions);
        } catch (error: any) {
            console.error('Erreur partage:', error);
        }
    }, [qrData]);

    // Copier le lien
    const copyLink = useCallback(async () => {
        if (!qrData) return;

        try {
            await Share.share({
                message: qrData.share_url,
                title: 'Lien QR Code',
            });
        } catch (error: any) {
            console.error('Erreur copie:', error);
        }
    }, [qrData]);

    // Ouvrir le lien
    const openLink = useCallback(async () => {
        if (!qrData) return;

        try {
            await Linking.openURL(qrData.share_url);
        } catch (error: any) {
            console.error('Erreur ouverture:', error);
            Alert.alert('Erreur', 'Impossible d\'ouvrir le lien');
        }
    }, [qrData]);

    // Scanner un QR code
    const handleBarCodeScanned = useCallback(async ({ type, data }) => {
        setScanned(true);
        
        // Extraire l'ID du QR code depuis les données
        const qrMatch = data.match(/\/qr\/([a-f0-9-]+)/);
        if (!qrMatch) {
            Alert.alert('Erreur', 'QR code invalide');
            setScanned(false);
            return;
        }

        const qrId = qrMatch[1];
        
        setLoading(true);
        
        try {
            const response = await apiPost(`/api/librairie-network/qrcode/${qrId}/scan`, {
                scan_par: 1, // TODO: utiliser l'ID utilisateur réel
                location_scan: 'client_scan', // TODO: utiliser GPS réel
            });

            if (response.success) {
                Alert.alert(
                    '✅ Livraison validée!',
                    'La livraison a été enregistrée avec succès.',
                    [
                        { text: 'OK', onPress: () => navigation.goBack() }
                    ]
                );
            } else {
                Alert.alert('Erreur', response.message || 'Erreur validation QR code');
                setScanned(false);
            }
        } catch (error: any) {
            console.error('Erreur scan QR:', error);
            Alert.alert(
                'Erreur',
                error.response?.data?.message || 'Erreur validation QR code'
            );
            setScanned(false);
        } finally {
            setLoading(false);
        }
    }, [navigation]);

    // Vérifier le statut d'un QR code
    const checkQRStatus = useCallback(async (qrId: string) => {
        try {
            const response = await apiGet(`/api/librairie-network/qrcode/${qrId}/status`);
            
            if (response.success) {
                const status = response.statut;
                const isExpired = response.is_expired;
                
                let message = `Statut: ${status}`;
                if (isExpired) {
                    message += '\n⚠️ QR code expiré';
                } else if (status === 'scanne') {
                    message += '\n✅ Déjà scanné';
                } else {
                    message += '\n📍 En attente de scan';
                }
                
                Alert.alert('Statut QR Code', message);
            }
        } catch (error: any) {
            console.error('Erreur statut:', error);
            Alert.alert('Erreur', 'Impossible de vérifier le statut');
        }
    }, []);

    // Initialiser
    React.useEffect(() => {
        if (mode === 'share') {
            generateQRCode();
        } else {
            requestCameraPermission();
        }
    }, [mode, generateQRCode, requestCameraPermission]);

    // Mode partage
    if (mode === 'share') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>QR Code Livraison</Text>
                </View>

                <View style={styles.content}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={modernColors.primary} />
                            <Text style={styles.loadingText}>Génération du QR code...</Text>
                        </View>
                    ) : qrData ? (
                        <View style={styles.qrContainer}>
                            <View style={styles.qrImageContainer}>
                                {/* TODO: Afficher l'image QR code */}
                                <View style={styles.qrPlaceholder}>
                                    <SafeIcon name="qr-code" size={80} color={modernColors.primary} />
                                    <Text style={styles.qrPlaceholderText}>QR Code</Text>
                                </View>
                            </View>

                            <View style={styles.qrInfo}>
                                <Text style={styles.qrId}>ID: {qrData.qr_id}</Text>
                                <Text style={styles.qrUrl}>{qrData.share_url}</Text>
                                <Text style={styles.qrExpiry}>
                                    Valide jusqu'au: {new Date(qrData.valide_jusqua).toLocaleString()}
                                </Text>
                            </View>

                            <View style={styles.actions}>
                                <NativeButton
                                    title="📤 Partager"
                                    onPress={shareQRCode}
                                    variant="primary"
                                    style={styles.actionButton}
                                />
                                
                                <NativeButton
                                    title="🔗 Copier lien"
                                    onPress={copyLink}
                                    variant="outline"
                                    style={styles.actionButton}
                                />
                                
                                <NativeButton
                                    title="🌐 Ouvrir"
                                    onPress={openLink}
                                    variant="outline"
                                    style={styles.actionButton}
                                />
                                
                                <NativeButton
                                    title="📊 Vérifier statut"
                                    onPress={() => checkQRStatus(qrData.qr_id)}
                                    variant="outline"
                                    style={styles.actionButton}
                                />
                            </View>
                        </View>
                    ) : (
                        <View style={styles.errorContainer}>
                            <SafeIcon name="alert-circle" size={48} color={modernColors.error} />
                            <Text style={styles.errorText}>Erreur génération QR code</Text>
                            <NativeButton
                                title="Réessayer"
                                onPress={generateQRCode}
                                variant="primary"
                                style={styles.retryButton}
                            />
                        </View>
                    )}
                </View>
            </View>
        );
    }

    // Mode scan
    if (hasPermission === null) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Scanner QR Code</Text>
                </View>
                
                <View style={styles.permissionContainer}>
                    <SafeIcon name="camera" size={48} color={modernColors.primary} />
                    <Text style={styles.permissionText}>Autorisation caméra requise</Text>
                    <NativeButton
                        title="Autoriser"
                        onPress={requestCameraPermission}
                        variant="primary"
                        style={styles.permissionButton}
                    />
                </View>
            </View>
        );
    }

    if (hasPermission === false) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Scanner QR Code</Text>
                </View>
                
                <View style={styles.permissionContainer}>
                    <SafeIcon name="camera-off" size={48} color={modernColors.error} />
                    <Text style={styles.permissionText}>Accès caméra refusé</Text>
                    <Text style={styles.permissionSubText}>
                        Vous devez autoriser l'accès à la caméra pour scanner les QR codes
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Scanner QR Code</Text>
            </View>

            <View style={styles.scannerContainer}>
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={modernColors.primary} />
                        <Text style={styles.loadingText}>Validation en cours...</Text>
                    </View>
                ) : (
                    <BarCodeScanner
                        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
                        style={StyleSheet.absoluteFillObject}
                    />
                )}
                
                {!scanned && !loading && (
                    <View style={styles.scannerOverlay}>
                        <View style={styles.scannerFrame} />
                        <Text style={styles.scannerText}>
                            Alignez le QR code dans le cadre
                        </Text>
                    </View>
                )}
                
                {scanned && (
                    <View style={styles.scannedOverlay}>
                        <SafeIcon name="check-circle" size={48} color={modernColors.success} />
                        <Text style={styles.scannedText}>QR code scanné!</Text>
                        <NativeButton
                            title="Scanner un autre"
                            onPress={() => setScanned(false)}
                            variant="primary"
                            style={styles.scanAgainButton}
                        />
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    backButton: {
        padding: 8,
        marginRight: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
        flex: 1,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    qrContainer: {
        flex: 1,
        alignItems: 'center',
    },
    qrImageContainer: {
        width: 256,
        height: 256,
        backgroundColor: '#fff',
        borderRadius: modernStyles.borderRadius.lg,
        borderWidth: 2,
        borderColor: modernColors.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    qrPlaceholder: {
        alignItems: 'center',
    },
    qrPlaceholderText: {
        marginTop: 8,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    qrInfo: {
        width: '100%',
        backgroundColor: modernColors.surface,
        padding: 16,
        borderRadius: modernStyles.borderRadius.md,
        marginBottom: 24,
    },
    qrId: {
        fontSize: 14,
        color: modernColors.text,
        fontFamily: 'monospace',
    },
    qrUrl: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    qrExpiry: {
        fontSize: 12,
        color: modernColors.primary,
        marginTop: 8,
    },
    actions: {
        width: '100%',
        gap: 12,
    },
    actionButton: {
        marginBottom: 8,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        marginTop: 16,
        fontSize: 16,
        color: modernColors.error,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 24,
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    permissionText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        textAlign: 'center',
    },
    permissionSubText: {
        marginTop: 8,
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    permissionButton: {
        marginTop: 24,
    },
    scannerContainer: {
        flex: 1,
    },
    scannerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scannerFrame: {
        width: 250,
        height: 250,
        borderWidth: 3,
        borderColor: '#fff',
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    scannerText: {
        marginTop: 20,
        fontSize: 16,
        color: '#fff',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    scannedOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
    },
    scannedText: {
        marginTop: 16,
        fontSize: 18,
        color: '#fff',
        fontWeight: '600',
    },
    scanAgainButton: {
        marginTop: 24,
    },
});

export default QRCodeShareScreen;
