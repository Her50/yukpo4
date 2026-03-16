import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo } from 'react';
import { Alert, BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';

import DeliveryAvatarBubble from '../../components/delivery/DeliveryAvatarBubble';
import ShoppingBasketCard from '../../components/delivery/ShoppingBasketCard';
import { NativeButton } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useDeliveryContext } from '../../contexts/DeliveryContext';
import { useShoppingBasket } from '../../hooks/useShoppingBasket';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

const ShoppingSummaryScreen: React.FC = () => {
    const navigation = useNavigation() as any;
    const { t } = useLanguageSafe();
    const { setActiveDeliveryId } = useDeliveryContext();
    const {
        items,
        pickup,
        dropoff,
        estimate,
        comment,
        createShoppingOrder,
        submittingOrder,
    } = useShoppingBasket();

    // ✅ CORRIGÉ: Gestion du bouton retour Android
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (navigation.canGoBack()) {
                navigation.goBack();
                return true;
            }
            return false;
        });

        return () => backHandler.remove();
    }, [navigation]);

    const totalItems = useMemo(() => items.reduce((acc, item) => acc + item.quantity, 0), [items]);

    const handleConfirm = async () => {
        if (!pickup?.latitude || !dropoff?.latitude) {
            Alert.alert('Informations manquantes', 'Vérifie les adresses avant de confirmer.');
            return;
        }

        const response = await createShoppingOrder();
        if (!response.success) {
            Alert.alert('Erreur', response.error ?? 'Impossible de créer la commande.');
            return;
        }

        const deliveryId =
            response.data?.delivery_id || response.data?.delivery?.id || response.data?.id;
        if (!deliveryId) {
            Alert.alert('Commande créée', 'La livraison a été enregistrée avec succès.');
            navigation.navigate('DeliveryHome');
            return;
        }

        setActiveDeliveryId(deliveryId);
        navigation.navigate('DeliveryShoppingTracking', { deliveryId });
    };

    return (
        <SafeNativeView style={styles.container} backgroundColor={modernColors.background}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <DeliveryAvatarBubble
                    message=t('shoppingSummaryScreen.verifieLeRecapitulatifAvantDeConfirmer')
                    subtitle='Tu peux encore ajuster ton panier ou tes instructions.'
                />

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('shoppingSummary.detailsDuTrajet')}</Text>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>{t('shoppingSummary.supermarche')}</Text>
                        <Text style={styles.detailValue}>{pickup?.label ?? t('shoppingSummary.nonDefini')}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>{t('shoppingSummary.livraison')}</Text>
                        <Text style={styles.detailValue}>{dropoff?.label ?? t('shoppingSummary.nonDefini')}</Text>
                    </View>
                    {comment ? (
                        <View style={styles.commentBox}>
                            <Text style={styles.detailLabel}>Instructions coursier</Text>
                            <Text style={styles.commentText}>{comment}</Text>
                        </View>
                    ) : null}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Panier ({totalItems} articles)</Text>
                    <ShoppingBasketCard />
                </View>

                {estimate ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Estimation Yukpo</Text>
                        <View style={styles.summaryLine}>
                            <Text style={styles.detailLabel}>{t('shoppingSummary.panier')}</Text>
                            <Text style={styles.detailValue}>
                                {estimate.subtotal.toFixed(0)} {estimate.currency}
                            </Text>
                        </View>
                        <View style={styles.summaryLine}>
                            <Text style={styles.detailLabel}>{t('shoppingSummary.livraison')}</Text>
                            <Text style={styles.detailValue}>
                                {estimate.deliveryFee.toFixed(0)} {estimate.currency}
                            </Text>
                        </View>
                        <View style={styles.summaryLine}>
                            <Text style={styles.totalLabel}>{t('shoppingSummary.totalEstime')}</Text>
                            <Text style={styles.totalValue}>
                                {estimate.total.toFixed(0)} {estimate.currency}
                            </Text>
                        </View>
                    </View>
                ) : null}
            </ScrollView>

            <View style={styles.footer}>
                <NativeButton
                    title={submittingOrder ? 'Validation en cours...' : t('shoppingSummaryScreen.confirmerLaCommande')}
                    onPress={handleConfirm}
                    disabled={submittingOrder}
                />
            </View>
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
        backgroundColor: modernColors.surface,
        padding: 16,
        borderRadius: 18,
        gap: 12,
        shadowColor: modernColors.shadow,
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    detailLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    commentBox: {
        backgroundColor: modernColors.surfaceVariant,
        padding: 12,
        borderRadius: 12,
        gap: 6,
    },
    commentText: {
        fontSize: 13,
        color: modernColors.text,
    },
    summaryLine: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
    },
    footer: {
        padding: 20,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
});

export default ShoppingSummaryScreen;


