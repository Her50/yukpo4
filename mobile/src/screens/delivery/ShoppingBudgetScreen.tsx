import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Alert, BackHandler, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';

import DeliveryAvatarBubble from '../../components/delivery/DeliveryAvatarBubble';
import WalletAlertBanner from '../../components/delivery/WalletAlertBanner';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useShoppingBasket } from '../../hooks/useShoppingBasket';
import { modernColors } from '../../theme/modernTheme';

const ShoppingBudgetScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const { budget, setBudget, currency, comment, setComment, estimate } = useShoppingBasket();
    const [budgetInput, setBudgetInput] = useState(
        budget ? budget.toString() : estimate?.total?.toString() ?? ''
    );

    useEffect(() => {
        if (budget && !budgetInput) {
            setBudgetInput(String(budget));
        }
    }, [budget, budgetInput]);

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

    const handleContinue = () => {
        const parsedBudget = parseFloat(budgetInput.replace(',', '.'));
        if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
            Alert.alert('Budget invalide', 'Indique un budget suffisant pour la commande.');
            return;
        }

        setBudget(parsedBudget);
        navigation.navigate('ShoppingPickupDrop');
    };

    return (
        <SafeNativeView style={styles.container} backgroundColor={modernColors.background}>
            <KeyboardAwareScreen contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <DeliveryAvatarBubble
                    mood='focused'
                    message='Définis ton budget et ajoute des instructions spécifiques.'
                />

                <View style={styles.section}>
                    <Text style={styles.label}>Budget maximum (Yukpo Wallet)</Text>
                    <NativeInput
                        value={budgetInput}
                        onChangeText={setBudgetInput}
                        keyboardType='decimal-pad'
                        placeholder={`Ex: 15000 ${currency ?? 'XAF'}`}
                    />
                    <Text style={styles.helper}>
                        Ce montant comprend l&apos;achat des produits et l&apos;avance du coursier.
                    </Text>
                </View>

                <WalletAlertBanner
                    onRecharge={() => navigation.navigate('RechargeTokens', { from: 'ShoppingBudget' })}
                />

                <View style={styles.section}>
                    <Text style={styles.label}>Instructions pour le coursier</Text>
                    <NativeInput
                        value={comment}
                        onChangeText={setComment}
                        multiline
                        minLines={3}
                        placeholder='Ajoute des précisions : préférences de marque, alternatives, code de caisse...'
                    />
                </View>
            </KeyboardAwareScreen>

            <View style={styles.footer}>
                <NativeButton title='Choisir pick-up & drop-off' onPress={handleContinue} />
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
        gap: 12,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    helper: {
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

export default ShoppingBudgetScreen;


