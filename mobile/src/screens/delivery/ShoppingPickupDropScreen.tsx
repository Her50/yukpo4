import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, BackHandler, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';

import DeliveryAvatarBubble from '../../components/delivery/DeliveryAvatarBubble';
import ModernGPSModal from '../../components/ModernGPSModal';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useShoppingBasket } from '../../hooks/useShoppingBasket';
import { deliveryApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

type ModalType = 'pickup' | 'dropoff' | null;

const parseCoordinates = (value: string) => {
    const [first] = value.split('|');
    if (!first) return null;
    const [latStr, lngStr] = first.split(',');
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }
    return { lat, lng };
};

const ShoppingPickupDropScreen: React.FC = () => {
    const navigation = useNavigation() as any;
    const route = useRoute() as any;
    const routeParams = (route?.params ?? {}) as { mode?: 'create' | 'edit'; deliveryId?: string | number };
    const isEditMode = routeParams?.mode === 'edit';
    const editDeliveryId = routeParams?.deliveryId != null ? String(routeParams.deliveryId) : '';
    const { pickup, setPickup, dropoff, setDropoff } = useShoppingBasket();
    const [modalType, setModalType] = useState<ModalType>(null);
    const [pickupLabel, setPickupLabel] = useState(pickup?.label ?? '');
    const [dropoffLabel, setDropoffLabel] = useState(dropoff?.label ?? '');
    const [prefillDone, setPrefillDone] = useState(false);

    const pickupCoordinates = useMemo(
        () => (pickup?.latitude && pickup?.longitude ? { lat: pickup.latitude, lng: pickup.longitude } : null),
        [pickup?.latitude, pickup?.longitude]
    );

    const dropoffCoordinates = useMemo(
        () => (dropoff?.latitude && dropoff?.longitude ? { lat: dropoff.latitude, lng: dropoff.longitude } : null),
        [dropoff?.latitude, dropoff?.longitude]
    );

    // ✅ CORRIGÉ: Gestion du bouton retour Android
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (modalType) {
                // Si un modal est ouvert, fermer le modal au lieu de naviguer
                setModalType(null);
                return true;
            }
            if (navigation.canGoBack()) {
                navigation.goBack();
                return true;
            }
            return false;
        });

        return () => backHandler.remove();
    }, [navigation, modalType]);

    useEffect(() => {
        let mounted = true;

        const loadEditDelivery = async () => {
            if (!isEditMode || !editDeliveryId || prefillDone) return;

            try {
                const response = await deliveryApi.getDeliveryById(editDeliveryId);
                const delivery = (response as any)?.data?.delivery ?? (response as any)?.data;
                if (!mounted || !delivery) return;

                const pickupLocation = delivery.pickup?.location;
                const dropoffLocation = delivery.dropoff?.location;
                const pickupAddress = delivery.pickup?.address ?? delivery.pickup?.label ?? '';
                const dropoffAddress = delivery.dropoff?.address ?? delivery.dropoff?.label ?? '';

                if (pickupLocation?.lat != null && pickupLocation?.lng != null) {
                    setPickup({
                        label: delivery.pickup?.label || pickupAddress || 'Supermarché',
                        latitude: Number(pickupLocation.lat),
                        longitude: Number(pickupLocation.lng),
                        address: pickupAddress,
                    });
                    setPickupLabel(delivery.pickup?.label || pickupAddress || 'Supermarché');
                }

                if (dropoffLocation?.lat != null && dropoffLocation?.lng != null) {
                    setDropoff({
                        label: delivery.dropoff?.label || dropoffAddress || 'Livraison',
                        latitude: Number(dropoffLocation.lat),
                        longitude: Number(dropoffLocation.lng),
                        address: dropoffAddress,
                    });
                    setDropoffLabel(delivery.dropoff?.label || dropoffAddress || 'Livraison');
                }

                setPrefillDone(true);
            } catch (error) {
                console.error('[ShoppingPickupDropScreen] prefill edit error:', error);
            }
        };

        loadEditDelivery();

        return () => {
            mounted = false;
        };
    }, [editDeliveryId, isEditMode, prefillDone, setDropoff, setPickup]);

    const handleOpenModal = (type: ModalType) => setModalType(type);

    const handleSelectLocation = (value: string) => {
        if (!modalType) return;
        const coords = parseCoordinates(value);
        if (!coords) {
            Alert.alert('Localisation invalide', 'Impossible de lire la position sélectionnée.');
            return;
        }

        if (modalType === 'pickup') {
            setPickup({
                label: pickupLabel || 'Supermarché',
                latitude: coords.lat,
                longitude: coords.lng,
                address: value,
            });
        } else if (modalType === 'dropoff') {
            setDropoff({
                label: dropoffLabel || 'Livraison',
                latitude: coords.lat,
                longitude: coords.lng,
                address: value,
            });
        }

        setModalType(null);
    };

    const handleContinue = () => {
        if (!pickup?.latitude || !dropoff?.latitude) {
            Alert.alert('Localisations manquantes', 'Sélectionne le point de retrait et de dépôt.');
            return;
        }
        navigation.navigate('ShoppingSummary', {
            mode: isEditMode ? 'edit' : 'create',
            deliveryId: editDeliveryId || undefined,
        });
    };

    return (
        <SafeNativeView style={styles.container} backgroundColor={modernColors.background}>
            <KeyboardAwareScreen contentContainerStyle={styles.scroll}>
                <DeliveryAvatarBubble
                    mood='excited'
                    message='Sélectionne le supermarché et l’adresse du destinataire.'
                    subtitle='Tu peux choisir sur la carte ou utiliser une adresse enregistrée.'
                />

                <View style={styles.section}>
                    <Text style={styles.label}>Point de retrait (supermarché)</Text>
                    <NativeInput
                        value={pickupLabel}
                        onChangeText={value => {
                            setPickupLabel(value);
                            setPickup(prev => ({
                                ...(prev ?? {}),
                                label: value,
                            }));
                        }}
                        placeholder='Ex: Super U Bonapriso'
                    />
                    <NativeButton
                        title={pickup?.latitude ? 'Modifier sur la carte' : 'Choisir sur la carte'}
                        variant='outline'
                        onPress={() => handleOpenModal('pickup')}
                    />
                    {pickup?.latitude ? (
                        <Text style={styles.coordinates}>
                            {pickup.latitude.toFixed(4)}, {pickup.longitude?.toFixed(4)}
                        </Text>
                    ) : null}
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>Point de livraison (destinataire)</Text>
                    <NativeInput
                        value={dropoffLabel}
                        onChangeText={value => {
                            setDropoffLabel(value);
                            setDropoff(prev => ({
                                ...(prev ?? {}),
                                label: value,
                            }));
                        }}
                        placeholder='Adresse complète du destinataire'
                    />
                    <NativeButton
                        title={dropoff?.latitude ? 'Modifier sur la carte' : 'Choisir sur la carte'}
                        variant='outline'
                        onPress={() => handleOpenModal('dropoff')}
                    />
                    {dropoff?.latitude ? (
                        <Text style={styles.coordinates}>
                            {dropoff.latitude.toFixed(4)}, {dropoff.longitude?.toFixed(4)}
                        </Text>
                    ) : null}
                </View>

                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>Estimation du trajet</Text>
                    <Text style={styles.infoText}>Le temps total est calculé lors de la confirmation.</Text>
                </View>
            </KeyboardAwareScreen>

            <View style={styles.footer}>
                <NativeButton title='Récapitulatif' onPress={handleContinue} />
            </View>

            <ModernGPSModal
                visible={modalType !== null}
                onClose={() => setModalType(null)}
                onSelect={handleSelectLocation}
                currentLocation={modalType === 'pickup' ? pickupCoordinates ?? undefined : dropoffCoordinates ?? undefined}
                title={modalType === 'pickup' ? 'Choisir le supermarché' : 'Point de livraison'}
            />
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scroll: {
        padding: 20,
        gap: 24,
        paddingBottom: 120,
    },
    section: {
        gap: 12,
        backgroundColor: modernColors.surface,
        padding: 16,
        borderRadius: 18,
        shadowColor: modernColors.shadow,
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
        elevation: 4,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    coordinates: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    infoCard: {
        backgroundColor: modernColors.surfaceVariant,
        padding: 16,
        borderRadius: 18,
        gap: 6,
    },
    infoTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    infoText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    footer: {
        padding: 20,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
});

export default ShoppingPickupDropScreen;


