import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useShoppingBasket } from '../../hooks/useShoppingBasket';
import { modernColors } from '../../theme/modernTheme';
import { NativeButton, NativeCard } from '../SafeNativeDesign';
import SafeIcon from '../SafeIcon';

const ShoppingBasketCard: React.FC = () => {
    const { items, removeProduct, updateProduct, estimate, currency, resetBasket } = useShoppingBasket();

    return (
        <NativeCard style={styles.card}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>Panier supermarché</Text>
                <Text style={styles.count}>{items.length} produit(s)</Text>
            </View>

            {items.length === 0 ? (
                <View style={styles.emptyState}>
                    <SafeIcon name="shopping-bag" size={32} color={modernColors.textSecondary} />
                    <Text style={styles.emptyText}>Ajoute des produits pour commencer ta commande</Text>
                </View>
            ) : (
                items.map(item => (
                    <View key={item.id} style={styles.itemRow}>
                        <View style={styles.itemIcon}>
                            <SafeIcon name="sparkles" size={18} color={modernColors.primary} />
                        </View>
                        <View style={styles.itemContent}>
                            <Text style={styles.itemLabel}>{item.label}</Text>
                            <Text style={styles.itemMeta}>
                                {item.quantity} {item.unit || 'unités'}
                                {item.estimatedPrice
                                    ? ` • ~${item.estimatedPrice.toFixed(0)} ${currency ?? 'XAF'}`
                                    : ''}
                            </Text>
                            {item.note ? <Text style={styles.itemNote}>{item.note}</Text> : null}
                        </View>
                        <View style={styles.itemActions}>
                            <View style={styles.quantityControls}>
                                <TouchableOpacity
                                    style={styles.quantityButton}
                                    onPress={() =>
                                        updateProduct(item.id, {
                                            quantity: Math.max(1, item.quantity - 1),
                                        })
                                    }
                                >
                                    <SafeIcon name="minus" size={16} color={modernColors.textSecondary} />
                                </TouchableOpacity>
                                <Text style={styles.quantityValue}>{item.quantity}</Text>
                                <TouchableOpacity
                                    style={styles.quantityButton}
                                    onPress={() =>
                                        updateProduct(item.id, {
                                            quantity: item.quantity + 1,
                                        })
                                    }
                                >
                                    <SafeIcon name="plus" size={16} color={modernColors.primary} />
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity style={styles.removeButton} onPress={() => removeProduct(item.id)}>
                                <SafeIcon name="trash-2" size={16} color={modernColors.error} />
                            </TouchableOpacity>
                        </View>
                    </View>
                ))
            )}

            {estimate ? (
                <View style={styles.estimateCard}>
                    <SafeIcon name="receipt" size={18} color={modernColors.primary} />
                    <View style={styles.estimateContent}>
                        <Text style={styles.estimateTitle}>Estimation</Text>
                        <Text style={styles.estimateLine}>
                            Panier • {estimate.subtotal.toFixed(0)} {estimate.currency}
                        </Text>
                        <Text style={styles.estimateLine}>
                            Livraison • {estimate.deliveryFee.toFixed(0)} {estimate.currency}
                        </Text>
                        <Text style={styles.estimateTotal}>
                            Total estimé • {estimate.total.toFixed(0)} {estimate.currency}
                        </Text>
                    </View>
                </View>
            ) : null}

            <NativeButton
                title="Vider le panier"
                variant="outline"
                onPress={resetBasket}
                disabled={items.length === 0}
            />
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    card: {
        gap: 16,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    count: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    emptyState: {
        paddingVertical: 32,
        alignItems: 'center',
        gap: 8,
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: modernColors.borderLight,
    },
    itemIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: modernColors.surfaceVariant,
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemContent: {
        flex: 1,
        gap: 4,
    },
    itemLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
    },
    itemMeta: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    itemNote: {
        fontSize: 12,
        color: modernColors.accent,
    },
    itemActions: {
        alignItems: 'center',
        gap: 8,
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 4,
        gap: 8,
    },
    quantityButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        minWidth: 20,
        textAlign: 'center',
    },
    removeButton: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: '#fee2e2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    estimateCard: {
        flexDirection: 'row',
        gap: 12,
        padding: 12,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
        alignItems: 'center',
    },
    estimateContent: {
        flex: 1,
        gap: 2,
    },
    estimateTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: modernColors.text,
    },
    estimateLine: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    estimateTotal: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.primary,
    },
});

export default ShoppingBasketCard;
