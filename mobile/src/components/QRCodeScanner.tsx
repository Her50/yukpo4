/**
 * Composant de scanner QR Code pour validation des tickets
 * Utilise expo-barcode-scanner pour scanner les QR codes des tickets
 */

import { BarCodeScanner, BarCodeScannerResult } from 'expo-barcode-scanner';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface QRCodeScannerProps {
    visible: boolean;
    onClose: () => void;
    onScan: (qrData: string) => void;
    onError?: (error: string) => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({
    visible,
    onClose,
    onScan,
    onError,
}) => {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        if (visible) {
            requestCameraPermission();
            setScanned(false);
        }
    }, [visible]);

    const requestCameraPermission = async () => {
        try {
            const { status } = await BarCodeScanner.requestPermissionsAsync();
            setHasPermission(status === 'granted');
            if (status !== 'granted') {
                Alert.alert(
                    'Permission requise',
                    'L\'accès à la caméra est nécessaire pour scanner les QR codes',
                    [{ text: 'OK', onPress: onClose }]
                );
            }
        } catch (error: any) {
            console.error('[QRCodeScanner] Erreur permission:', error);
            if (onError) {
                onError('Impossible d\'accéder à la caméra');
            }
        }
    };

    const handleBarCodeScanned = ({ type, data }: BarCodeScannerResult) => {
        if (scanned) return; // Éviter les scans multiples

        setScanned(true);

        // Feedback haptique
        if (Platform.OS === 'ios') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        // ✅ CORRIGÉ: Passer toutes les données scannées au callback parent
        // Le composant parent (ProviderCourierVerification, BusTicketQRScanner, etc.)
        // est responsable de valider le format du QR code
        onScan(data);
    };

    if (!visible) return null;

    if (hasPermission === null) {
        return (
            <Modal
                visible={visible}
                animationType="slide"
                onRequestClose={onClose}
            >
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Demande de permission</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color="#111827" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.content}>
                        <Text style={styles.message}>
                            Demande d'accès à la caméra en cours...
                        </Text>
                    </View>
                </View>
            </Modal>
        );
    }

    if (hasPermission === false) {
        return (
            <Modal
                visible={visible}
                animationType="slide"
                onRequestClose={onClose}
            >
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Permission refusée</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color="#111827" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.content}>
                        <SafeIcon name="camera-off" size={64} color="#EF4444" />
                        <Text style={styles.errorMessage}>
                            L'accès à la caméra a été refusé
                        </Text>
                        <Text style={styles.errorSubtext}>
                            Veuillez autoriser l'accès à la caméra dans les paramètres de l'appareil
                        </Text>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={requestCameraPermission}
                        >
                            <Text style={styles.retryButtonText}>Réessayer</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    }

    return (
        <Modal
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Scanner QR code</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <SafeIcon name="x" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Scanner */}
                <View style={styles.scannerContainer}>
                    <BarCodeScanner
                        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
                        style={StyleSheet.absoluteFillObject}
                    />

                    {/* Overlay avec cadre de scan */}
                    <View style={styles.overlay}>
                        <View style={styles.overlayTop} />
                        <View style={styles.overlayMiddle}>
                            <View style={styles.overlaySide} />
                            <View style={styles.scanFrame}>
                                <View style={[styles.corner, styles.topLeft]} />
                                <View style={[styles.corner, styles.topRight]} />
                                <View style={[styles.corner, styles.bottomLeft]} />
                                <View style={[styles.corner, styles.bottomRight]} />
                            </View>
                            <View style={styles.overlaySide} />
                        </View>
                        <View style={styles.overlayBottom} />
                    </View>

                    {/* Instructions */}
                    <View style={styles.instructionsContainer}>
                        <Text style={styles.instructionsText}>
                            Pointez la caméra vers le QR code du ticket
                        </Text>
                        {scanned && (
                            <Text style={styles.scannedText}>
                                ✓ QR code scanné
                            </Text>
                        )}
                    </View>
                </View>

                {/* Contrôles */}
                <View style={styles.controlsContainer}>
                    {scanned && (
                        <TouchableOpacity
                            style={styles.retryScanButton}
                            onPress={() => setScanned(false)}
                        >
                            <SafeIcon name="refresh-cw" size={20} color={modernColors.primary} />
                            <Text style={styles.retryScanButtonText}>Scanner à nouveau</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        paddingTop: Platform.OS === 'ios' ? 60 : 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    closeButton: {
        padding: 4,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    message: {
        fontSize: 16,
        color: '#fff',
        textAlign: 'center',
    },
    errorMessage: {
        fontSize: 18,
        fontWeight: '700',
        color: '#EF4444',
        marginTop: 16,
        textAlign: 'center',
    },
    errorSubtext: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 8,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 24,
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
    },
    retryButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    scannerContainer: {
        flex: 1,
        position: 'relative',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlayTop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    overlayMiddle: {
        flexDirection: 'row',
        width: '100%',
    },
    overlaySide: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    overlayBottom: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    scanFrame: {
        width: 250,
        height: 250,
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderColor: modernColors.primary,
    },
    topLeft: {
        top: 0,
        left: 0,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderTopLeftRadius: 8,
    },
    topRight: {
        top: 0,
        right: 0,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderTopRightRadius: 8,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderBottomLeftRadius: 8,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderBottomRightRadius: 8,
    },
    instructionsContainer: {
        position: 'absolute',
        bottom: 100,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    instructionsText: {
        fontSize: 16,
        color: '#fff',
        textAlign: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    scannedText: {
        fontSize: 14,
        color: '#10B981',
        marginTop: 8,
        fontWeight: '600',
    },
    controlsContainer: {
        padding: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        alignItems: 'center',
        gap: 12,
    },
    retryScanButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderRadius: 8,
    },
    retryScanButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
});

export default QRCodeScanner;


