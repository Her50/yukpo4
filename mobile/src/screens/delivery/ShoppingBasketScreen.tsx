import { useNavigation } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { Alert, BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';

import DeliveryAvatarBubble from '../../components/delivery/DeliveryAvatarBubble';
import ShoppingBasketCard from '../../components/delivery/ShoppingBasketCard';
import ShoppingProductPicker from '../../components/delivery/ShoppingProductPicker';
import WalletAlertBanner from '../../components/delivery/WalletAlertBanner';
import { NativeButton } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useShoppingBasket } from '../../hooks/useShoppingBasket';
import { modernColors } from '../../theme/modernTheme';

const ShoppingBasketScreen: React.FC = () => {
    const navigation = useNavigation() as any;
    const { items, estimateBasket, loadingEstimate } = useShoppingBasket();

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

    const handleContinue = async () => {
        if (items.length === 0) {
            Alert.alert('Panier vide', 'Ajoute au moins un produit avant de continuer.');
            return;
        }

        await estimateBasket();
        navigation.navigate('ShoppingBudget');
    };

    return (
        <SafeNativeView style={styles.container} backgroundColor={modernColors.background}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <DeliveryAvatarBubble
                        mood='smile'
                        message="Prêtes pour les courses ? Ajoute tout ce dont tu as besoin, même des indications précises."
                    />
                    <Text style={styles.title}>Compose ton panier</Text>
                    <Text style={styles.subtitle}>
                        Yukpo te suggère les produits populaires et les alternatives si besoin.
                    </Text>
                </View>

                <ShoppingProductPicker />
                <ShoppingBasketCard />
                <WalletAlertBanner />
            </ScrollView>
            <View style={styles.footer}>
                <NativeButton
                    title='Continuer'
                    onPress={handleContinue}
                    disabled={items.length === 0 || loadingEstimate}
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
    header: {
        gap: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.text,
    },
    subtitle: {
        fontSize: 15,
        color: modernColors.textSecondary,
    },
    footer: {
        padding: 20,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
});

export default ShoppingBasketScreen;


