// ✅ Composant affichage QR code réservation
// Date: 2025-01-29

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiGet } from '../../services/api';
import { NativeButton, NativeCard } from '../NativeDesign';
import { SafeIcon } from '../SafeIcon';

interface QRCodeDisplayProps {
    reservationId: number;
    onRefresh?: () => void;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
    reservationId,
    onRefresh,
}) => {
    const [qrCode, setQrCode] = useState<{
        qr_code: string;
        qr_code_url: string;
        status: string;
        expires_at: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadQRCode();
    }, [reservationId]);

    const loadQRCode = async () => {
        try {
            setLoading(true);
            setError(null);

            // Vérifier si QR code existe
            const existing = await apiGet(`/api/reservations/${reservationId}/qr-code`);
            if (existing && existing.qr_code) {
                setQrCode(existing);
            } else {
                // Générer nouveau QR code
                const response = await apiGet(`/api/reservations/${reservationId}/qr-code`);
                if (response && response.qr_code) {
                    setQrCode(response);
                } else {
                    setError('Impossible de générer le QR code');
                }
            }
        } catch (err: any) {
            setError(err.message || 'Erreur lors du chargement du QR code');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={styles.loadingText}>Chargement du QR code...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.container}>
                <SafeIcon name="alert-circle" size={48} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
                <NativeButton variant="primary" onPress={loadQRCode} style={styles.retryButton}>
                    Réessayer
                </NativeButton>
            </View>
        );
    }

    if (!qrCode) {
        return null;
    }

    return (
        <NativeCard style={styles.card}>
            <Text style={styles.title}>QR Code de réservation</Text>
            <Text style={styles.subtitle}>Présentez ce code au conducteur</Text>

            <View style={styles.qrContainer}>
                {qrCode.qr_code_url ? (
                    <Image
                        source={{ uri: qrCode.qr_code_url }}
                        style={styles.qrImage}
                        resizeMode="contain"
                    />
                ) : (
                    <View style={styles.qrPlaceholder}>
                        <Text style={styles.qrCodeText}>{qrCode.qr_code}</Text>
                    </View>
                )}
            </View>

            <Text style={styles.qrCodeValue}>{qrCode.qr_code}</Text>

            <View style={styles.infoRow}>
                <SafeIcon name="clock" size={16} color="#6B7280" />
                <Text style={styles.infoText}>
                    Expire le {new Date(qrCode.expires_at).toLocaleString('fr-FR')}
                </Text>
            </View>

            <View style={styles.statusRow}>
                <SafeIcon
                    name={qrCode.status === 'validated' ? 'check-circle' : 'circle'}
                    size={16}
                    color={qrCode.status === 'validated' ? '#10B981' : '#6B7280'}
                />
                <Text style={styles.statusText}>
                    {qrCode.status === 'validated' ? 'Validé' : 'En attente de validation'}
                </Text>
            </View>

            {onRefresh && (
                <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
                    <SafeIcon name="refresh-cw" size={16} color="#6366F1" />
                    <Text style={styles.refreshText}>Actualiser</Text>
                </TouchableOpacity>
            )}
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },
    errorText: {
        marginTop: 16,
        fontSize: 16,
        color: '#EF4444',
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 16,
    },
    card: {
        padding: 20,
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 24,
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
    },
    qrCodeText: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
    },
    qrCodeValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 16,
        textAlign: 'center',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    infoText: {
        fontSize: 14,
        color: '#6B7280',
        marginLeft: 8,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    statusText: {
        fontSize: 14,
        color: '#6B7280',
        marginLeft: 8,
    },
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
    },
    refreshText: {
        fontSize: 14,
        color: '#6366F1',
        marginLeft: 8,
    },
});

