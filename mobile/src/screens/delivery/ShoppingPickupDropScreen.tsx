import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, BackHandler, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';

import DeliveryAvatarBubble from '../../components/delivery/DeliveryAvatarBubble';
import ModernGPSModal from '../../components/ModernGPSModal';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useShoppingBasket } from '../../hooks/useShoppingBasket';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

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
    const { t } = useLanguageSafe();
    const { pickup, setPickup, dropoff, setDropoff } = useShoppingBasket();
    const [modalType, setModalType] = useState<ModalType>(null);
    const [pickupLabel, setPickupLabel] = useState(pickup?.label ?? '');
    const [dropoffLabel, setDropoffLabel] = useState(dropoff?.label ?? '');

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
                label: pickupLabel || t('shoppingPickupDrop.supermarche'),
                latitude: coords.lat,
                longitude: coords.lng,
                address: value,
            });
        } else if (modalType === 'dropoff') {
            setDropoff({
                label: dropoffLabel || t('shoppingPickupDrop.livraison'),
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
        navigation.navigate('ShoppingSummary');
    };

    return (
        <SafeNativeView style={styles.container} backgroundColor={modernColors.background}>
            <KeyboardAwareScreen contentContainerStyle={styles.scroll}>
                <DeliveryAvatarBubble
                    mood='excited'
                    message=t('shoppingPickupDropScreen.selectionneLeSupermarcheEtLadresseDu')
                    subtitle={t('shoppingPickupDrop.tuPeuxChoisirSurLa')}
                />

                <View style={styles.section}>
                    <Text style={styles.label}>{t('shoppingPickupDrop.pointDeRetraitSupermarche')}</Text>
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
                        title={pickup?.latitude ? t('shoppingPickupDropScreen.modifierSurLaCarte') : 'Choisir sur la carte'}
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
                    <Text style={styles.label}>{t('shoppingPickupDrop.pointDeLivraisonDestinataire')}</Text>
                    <NativeInput
                        value={dropoffLabel}
                        onChangeText={value => {
                            setDropoffLabel(value);
                            setDropoff(prev => ({
                                ...(prev ?? {}),
                                label: value,
                            }));
                        }}
                        placeholder={t('shoppingPickupDrop.adresseCompleteDuDestinataire')}
                    />
                    <NativeButton
                        title={dropoff?.latitude ? t('shoppingPickupDropScreen.modifierSurLaCarte') : 'Choisir sur la carte'}
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
                    <Text style={styles.infoText}>{t('shoppingPickupDrop.leTempsTotalEstCalcule')}</Text>
                </View>
            </KeyboardAwareScreen>

            <View style={styles.footer}>
                <NativeButton title={t('shoppingPickupDrop.recapitulatif')} onPress={handleContinue} />
            </View>

            <ModernGPSModal
                visible={modalType !== null}
                onClose={() => setModalType(null)}
                onSelect={handleSelectLocation}
                currentLocation={modalType === 'pickup' ? pickupCoordinates ?? undefined : dropoffCoordinates ?? undefined}
                title={modalType === 'pickup' ? t('shoppingPickupDropScreen.choisirLeSupermarche') : 'Point de livraison'}
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


