import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useShoppingBasket } from '../../hooks/useShoppingBasket';
import { modernColors } from '../../theme/modernTheme';
import LinearAutocompleteEditor from '../LinearAutocompleteEditor';
import { NativeButton, NativeCard, NativeInput } from '../SafeNativeDesign';
import SafeIcon from '../SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';

const DEFAULT_SOUS_CARACS: Record<string, string[]> = {
    marque: [],
    presentation: [],
    quantite: [],
};

const ShoppingProductPicker: React.FC = () => {
    const { addProduct } = useShoppingBasket();
        const { t } = useLanguageSafe();
const [vector, setVector] = useState<string[]>([]);
    const [sousCaracs, setSousCaracs] = useState<Record<string, string[]>>(DEFAULT_SOUS_CARACS);
    const [quantityInput, setQuantityInput] = useState('1');
    const [note, setNote] = useState('');
    const [estimatedPriceInput, setEstimatedPriceInput] = useState('');

    const parsedQuantity = useMemo(() => {
        const value = parseInt(quantityInput, 10);
        return Number.isFinite(value) && value > 0 ? value : 1;
    }, [quantityInput]);

    const estimatedPrice = useMemo(() => {
        const value = parseFloat(estimatedPriceInput.replace(',', '.'));
        return Number.isFinite(value) && value >= 0 ? value : undefined;
    }, [estimatedPriceInput]);

    const handleAddProduct = () => {
        const label = vector[0];
        if (!label) {
            return;
        }

        addProduct({
            label,
            quantity: parsedQuantity,
            unit: sousCaracs.quantite?.[0],
            note: note || undefined,
            estimatedPrice,
        });

        setVector([]);
        setNote('');
        setQuantityInput('1');
        setEstimatedPriceInput('');
        setSousCaracs(DEFAULT_SOUS_CARACS);
    };

    return (
        <NativeCard style={styles.card}>
            <View style={styles.header}>
                <View style={styles.headerIcon}>
                    <SafeIcon name="shopping-basket" size={20} color={modernColors.primary} />
                </View>
                <View style={styles.headerText}>
                    <Text style={styles.title}>{t('shoppingProductPicker.ajouterDesProduits')}/Text>
                    <Text style={styles.subtitle}>Utilise les suggestions intelligentes pour ton panier</Text>
                </View>
            </View>

            <LinearAutocompleteEditor
                label={t('shoppingProductPicker.produitRecherche')}
                identifiantBase="delivery_shopping"
                sousCaracteristiques={sousCaracs}
                separateur=","
                value={vector}
                onChange={(values, updatedSousCaracs) => {
                    setVector(values);
                    if (updatedSousCaracs) {
                        setSousCaracs(updatedSousCaracs);
                    }
                }}
                placeholder={t('shoppingProductPicker.exTomatesFraichesSachet1kg')}
                allowCustomModality
                filtrable
            />

            <View style={styles.inputsRow}>
                <View style={styles.inputColumn}>
                    <Text style={styles.inputLabel}>{t('shoppingProductPicker.quantite')}</Text>
                    <NativeInput
                        value={quantityInput}
                        onChangeText={setQuantityInput}
                        keyboardType="numeric"
                    />
                </View>
                <View style={styles.inputColumn}>
                    <Text style={styles.inputLabel}>{t('shoppingProductPicker.prixEstimeOptionnel')}</Text>
                    <NativeInput
                        value={estimatedPriceInput}
                        onChangeText={setEstimatedPriceInput}
                        keyboardType="decimal-pad"
                    />
                </View>
            </View>

            <View style={styles.noteSection}>
                <Text style={styles.inputLabel}>{t('shoppingProductPicker.notePourLeCoursier')}/Text>
                <NativeInput
                    value={note}
                    onChangeText={setNote}
                    multiline
                    minLines={2}
                    placeholder={t('shoppingProductPicker.preciseLaMarqueLaMaturite')}
                />
            </View>

            <NativeButton
                title={t('shoppingProductPicker.ajouterAuPanier')}
                onPress={handleAddProduct}
                disabled={!vector[0]}
                variant="primary"
                size="large"
            />
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    card: {
        gap: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.surfaceVariant,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    subtitle: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    inputsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    inputColumn: {
        flex: 1,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 6,
        color: modernColors.textSecondary,
    },
    noteSection: {
        gap: 6,
    },
});

export default ShoppingProductPicker;
