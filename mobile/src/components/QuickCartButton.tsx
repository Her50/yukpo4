/**
 * QuickCartButton - Bouton panier rapide niveau géant (Amazon one-click style)
 * Position flottante avec animations premium
 */

import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import AnimatedReanimated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
} from 'react-native-reanimated';
import { apiPost } from '../services/api';
import { triggerHaptic } from '../utils/hapticFeedback';
import SafeIcon from './SafeIcon';
import { useToaster } from './ToasterProvider';

interface QuickCartButtonProps {
    product: any;
    service?: any;
    onAddToCart?: (product: any) => Promise<void>;
    style?: any;
}

export const QuickCartButton: React.FC<QuickCartButtonProps> = ({
    product,
    service,
    onAddToCart,
    style,
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [isInCart, setIsInCart] = useState(false);
    const toaster = useToaster();
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);
    const badgeScale = useSharedValue(0);

    const handlePress = async () => {
        if (isAdding) return;

        setIsAdding(true);
        triggerHaptic('medium');

        // Animation press
        if (typeof withSpring === 'function' && scale && rotation) {
            try {
                scale.value = withSpring(0.9);
                rotation.value = withSpring(rotation.value + 360);
            } catch (error) {
                console.warn('[QuickCartButton] Erreur animation press:', error);
            }
        }

        try {
            if (onAddToCart) {
                await onAddToCart(product);
            } else {
                // Appel API par défaut
                const serviceId = product.service_id || service?.id;
                const productId = product.id || product.product_id;

                if (!serviceId || !productId) {
                    throw new Error('Service ID ou Product ID manquant');
                }

                const response = await apiPost('/api/cart/add', {
                    service_id: serviceId,
                    product_id: productId,
                    quantity: 1,
                });

                if (!response.success) {
                    throw new Error(response.error || 'Erreur lors de l\'ajout au panier');
                }
            }

            setIsInCart(true);
            triggerHaptic('success');
            toaster.success('Ajouté au panier !');

            // Animation de succès
            if (typeof withSequence === 'function' && typeof withSpring === 'function' && scale && badgeScale) {
                try {
                    scale.value = withSequence(
                        withSpring(1.2),
                        withSpring(1)
                    );
                    badgeScale.value = withSequence(
                        withSpring(1.3),
                        withSpring(1)
                    );
                } catch (error) {
                    console.warn('[QuickCartButton] Erreur animation succès:', error);
                }
            }

            // Reset après 2 secondes
            setTimeout(() => {
                setIsInCart(false);
                if (typeof withSpring === 'function' && badgeScale) {
                    try {
                        badgeScale.value = withSpring(0);
                    } catch (error) {
                        console.warn('[QuickCartButton] Erreur animation reset:', error);
                    }
                }
            }, 2000);
        } catch (error) {
            triggerHaptic('error');
            const errorMessage = error instanceof Error ? error.message : 'Impossible d\'ajouter au panier';
            toaster.error(errorMessage);
            if (typeof withSpring === 'function' && scale) {
                try {
                    scale.value = withSpring(1);
                } catch (animError) {
                    console.warn('[QuickCartButton] Erreur animation error:', animError);
                }
            }
        } finally {
            setIsAdding(false);
        }
    };

    const tapGesture = Gesture.Tap()
        .onEnd(() => {
            runOnJS(handlePress)();
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { rotate: `${rotation.value}deg` },
        ] as any,
    }));

    const badgeAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: badgeScale.value }],
    }));

    return (
        <GestureDetector gesture={tapGesture}>
            <AnimatedReanimated.View style={[styles.container, style, animatedStyle]}>
                <TouchableOpacity
                    style={[styles.button, isInCart && styles.buttonSuccess]}
                    onPress={handlePress}
                    disabled={isAdding}
                    accessibilityRole="button"
                    accessibilityLabel={isInCart ? "Produit ajouté au panier" : "Ajouter au panier"}
                    accessibilityHint="Double-tapez pour ajouter ce produit à votre panier"
                >
                    <SafeIcon
                        name={isInCart ? 'check' : isAdding ? 'loader' : 'shopping-cart'}
                        size={20}
                        color="#FFFFFF"
                    />
                    <Text style={styles.text}>
                        {isInCart ? 'Ajouté !' : isAdding ? 'Ajout...' : 'Panier'}
                    </Text>
                    {isInCart && (
                        <AnimatedReanimated.View style={[styles.checkBadge, badgeAnimatedStyle]}>
                            <SafeIcon name="check" size={12} color="#10B981" />
                        </AnimatedReanimated.View>
                    )}
                </TouchableOpacity>
            </AnimatedReanimated.View>
        </GestureDetector>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        zIndex: 1000,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#10B981',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
        minHeight: 44, // ✅ GÉANT-LEVEL: Apple HIG
        minWidth: 44,
    },
    buttonSuccess: {
        backgroundColor: '#059669',
    },
    text: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    checkBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#10B981',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
    },
});

export default QuickCartButton;

