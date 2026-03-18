/**
 * ✅ NOUVEAU : Modal permettant au coursier de signaler une difficulté
 * (panne, malaise) et de recommander un relais
 */

import * as Location from 'expo-location';
import React, { useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { deliveryApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import ModernGPSModal from '../ModernGPSModal';
import { NativeButton, NativeCard, NativeInput } from '../SafeNativeDesign';
import SafeIcon from '../SafeIcon';

interface CourierDifficultyModalProps {
    visible: boolean;
    onClose: () => void;
    deliveryId: string | null;
    onSuccess?: () => void;
}

const CourierDifficultyModal: React.FC<CourierDifficultyModalProps> = ({
    visible,
    onClose,
    deliveryId,
    onSuccess,
}) => {
    const [difficultyType, setDifficultyType] = useState<'breakdown' | 'illness' | null>(null);
    const [relayLocation, setRelayLocation] = useState<{
        latitude: number;
        longitude: number;
        address?: string;
    } | null>(null);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [showGPSModal, setShowGPSModal] = useState(false);

    const handleUseCurrentLocation = async () => {
        setLoadingLocation(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission requise', 'L\'accès à la localisation est nécessaire.');
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const coords = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };

            try {
                const reverseGeocode = await Location.reverseGeocodeAsync(coords);
                if (reverseGeocode && reverseGeocode.length > 0) {
                    const addr = reverseGeocode[0];
                    const address = `${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}, ${addr.region || ''}`.trim();
                    setRelayLocation({ ...coords, address });
                } else {
                    setRelayLocation(coords);
                }
            } catch (geocodeError) {
                console.warn('Géocodage inverse échoué:', geocodeError);
                setRelayLocation(coords);
            }
        } catch (error) {
            console.error('Erreur géolocalisation:', error);
            Alert.alert('Erreur', 'Impossible d\'obtenir votre position');
        } finally {
            setLoadingLocation(false);
        }
    };

    const handleGPSSelect = async (coordinates: string) => {
        const [lat, lng] = coordinates.split(',').map(parseFloat);
        const location = { latitude: lat, longitude: lng };

        try {
            const reverseGeocode = await Location.reverseGeocodeAsync(location);
            if (reverseGeocode && reverseGeocode.length > 0) {
                const addr = reverseGeocode[0];
                const address = `${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}, ${addr.region || ''}`.trim();
                setRelayLocation({ ...location, address });
            } else {
                setRelayLocation(location);
            }
        } catch (geocodeError) {
            console.warn('Géocodage inverse échoué:', geocodeError);
            setRelayLocation(location);
        }

        setShowGPSModal(false);
    };

    const handleSubmit = async () => {
        if (!difficultyType) {
            Alert.alert('Erreur', 'Veuillez sélectionner le type de difficulté');
            return;
        }

        if (!relayLocation) {
            Alert.alert('Erreur', 'Veuillez indiquer la position du relais');
            return;
        }

        if (!deliveryId) {
            Alert.alert('Erreur', 'ID de livraison manquant');
            return;
        }

        setLoading(true);
        try {
            const response = await deliveryApi.reportCourierDifficulty(
                deliveryId,
                difficultyType,
                relayLocation,
                notes || undefined
            );

            if (response.success) {
                Alert.alert(
                    'Difficulté signalée',
                    'Votre difficulté a été signalée. Un nouveau coursier va être recherché pour prendre le relais.',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                if (onSuccess) {
                                    onSuccess();
                                }
                                onClose();
                                // Réinitialiser le formulaire
                                setDifficultyType(null);
                                setRelayLocation(null);
                                setNotes('');
                            },
                        },
                    ]
                );
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de signaler la difficulté');
            }
        } catch (error: any) {
            console.error('Erreur signalement difficulté:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Modal
                visible={visible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={onClose}
            >
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Signaler une difficulté</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        <Text style={styles.description}>
                            Si vous rencontrez une difficulté pendant le transport (panne, malaise),
                            signalez-la ici. Un nouveau coursier sera automatiquement recherché pour
                            prendre le relais à votre position.
                        </Text>

                        {/* Type de difficulté */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Type de difficulté *</Text>
                            <View style={styles.difficultyOptions}>
                                <TouchableOpacity
                                    style={[
                                        styles.difficultyOption,
                                        difficultyType === 'breakdown' && styles.difficultyOptionSelected,
                                    ]}
                                    onPress={() => setDifficultyType('breakdown')}
                                >
                                    <SafeIcon
                                        name="alert-triangle"
                                        size={24}
                                        color={difficultyType === 'breakdown' ? '#FFFFFF' : modernColors.text}
                                    />
                                    <Text
                                        style={[
                                            styles.difficultyOptionText,
                                            difficultyType === 'breakdown' && styles.difficultyOptionTextSelected,
                                        ]}
                                    >
                                        Panne
                                    </Text>
                                    <Text style={styles.difficultyOptionSubtext}>
                                        Problème avec votre moyen de transport
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.difficultyOption,
                                        difficultyType === 'illness' && styles.difficultyOptionSelected,
                                    ]}
                                    onPress={() => setDifficultyType('illness')}
                                >
                                    <SafeIcon
                                        name="heart"
                                        size={24}
                                        color={difficultyType === 'illness' ? '#FFFFFF' : modernColors.text}
                                    />
                                    <Text
                                        style={[
                                            styles.difficultyOptionText,
                                            difficultyType === 'illness' && styles.difficultyOptionTextSelected,
                                        ]}
                                    >
                                        Malaise
                                    </Text>
                                    <Text style={styles.difficultyOptionSubtext}>
                                        Problème de santé
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Position du relais */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Position du relais *</Text>
                            <Text style={styles.helperText}>
                                Indiquez où le nouveau coursier doit venir récupérer le colis
                            </Text>

                            {relayLocation ? (
                                <NativeCard style={styles.locationCard}>
                                    <View style={styles.locationHeader}>
                                        <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                                        <Text style={styles.locationLabel}>Position sélectionnée</Text>
                                    </View>
                                    <Text style={styles.locationText}>
                                        {relayLocation.address ||
                                            `${relayLocation.latitude.toFixed(6)}, ${relayLocation.longitude.toFixed(6)}`}
                                    </Text>
                                    <NativeButton
                                        title="Changer la position"
                                        variant="outline"
                                        size="small"
                                        onPress={() => setShowGPSModal(true)}
                                        style={styles.changeButton}
                                    />
                                </NativeCard>
                            ) : (
                                <View style={styles.locationActions}>
                                    <NativeButton
                                        title={loadingLocation ? 'Localisation...' : 'Utiliser ma position actuelle'}
                                        variant="primary"
                                        onPress={handleUseCurrentLocation}
                                        disabled={loadingLocation}
                                        style={styles.locationButton}
                                    />
                                    <NativeButton
                                        title="Sélectionner sur la carte"
                                        variant="outline"
                                        onPress={() => setShowGPSModal(true)}
                                        style={styles.locationButton}
                                    />
                                </View>
                            )}
                        </View>

                        {/* Notes optionnelles */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Notes (optionnel)</Text>
                            <NativeInput
                                placeholder="Détails supplémentaires sur la difficulté..."
                                value={notes}
                                onChangeText={setNotes}
                                multiline
                                minLines={3}
                            />
                        </View>

                        {/* Bouton de soumission */}
                        <View style={styles.submitSection}>
                            <NativeButton
                                title={loading ? 'Envoi en cours...' : 'Signaler la difficulté'}
                                variant="primary"
                                onPress={handleSubmit}
                                disabled={loading || !difficultyType || !relayLocation}
                                style={styles.submitButton}
                            />
                            <TouchableOpacity
                                onPress={onClose}
                                style={styles.cancelButton}
                                disabled={loading}
                            >
                                <Text style={styles.cancelButtonText}>Annuler</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            {/* Modal GPS pour sélectionner la position du relais */}
            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
                currentLocation={relayLocation ? { lat: relayLocation.latitude, lng: relayLocation.longitude } : undefined}
                title="Sélectionner la position du relais"
                allowZoneSelection={false}
            />
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        paddingTop: 50,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
    },
    closeButton: {
        padding: 8,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    description: {
        fontSize: 14,
        color: modernColors.textSecondary,
        lineHeight: 20,
        marginBottom: 24,
    },
    section: {
        marginBottom: 24,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    helperText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 12,
    },
    difficultyOptions: {
        gap: 12,
    },
    difficultyOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: modernColors.border,
        gap: 12,
    },
    difficultyOptionSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    difficultyOptionText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        flex: 1,
    },
    difficultyOptionTextSelected: {
        color: '#FFFFFF',
    },
    difficultyOptionSubtext: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    locationCard: {
        marginTop: 12,
        padding: 16,
    },
    locationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    locationLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    locationText: {
        fontSize: 14,
        color: modernColors.text,
        marginBottom: 12,
    },
    changeButton: {
        marginTop: 8,
    },
    locationActions: {
        gap: 12,
        marginTop: 12,
    },
    locationButton: {
        marginBottom: 0,
    },
    submitSection: {
        marginTop: 24,
        marginBottom: 32,
        gap: 12,
    },
    submitButton: {
        marginBottom: 0,
    },
    cancelButton: {
        padding: 16,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
});

export default CourierDifficultyModal;

