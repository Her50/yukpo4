import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

const { width } = Dimensions.get('window');

/**
 * ✅ OPTIMISATION 8: Skeleton Loader pour ProductCard
 * Améliore l'UX perçue pendant le chargement des produits
 */
const ProductCardSkeleton: React.FC = () => {
    const shimmerAnimation = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Animation de shimmer (effet de brillance)
        Animated.loop(
            Animated.timing(shimmerAnimation, {
                toValue: 1,
                duration: 1500,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const shimmerTranslate = shimmerAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [-width, width],
    });

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                {/* Image principale */}
                <View style={styles.imagePlaceholder}>
                    <Animated.View
                        style={[
                            styles.shimmer,
                            {
                                transform: [{ translateX: shimmerTranslate }],
                            },
                        ]}
                    />
                </View>

                {/* Contenu */}
                <View style={styles.content}>
                    {/* Badge type */}
                    <View style={styles.badge}>
                        <Animated.View
                            style={[
                                styles.shimmer,
                                {
                                    transform: [{ translateX: shimmerTranslate }],
                                },
                            ]}
                        />
                    </View>

                    {/* Titre */}
                    <View style={styles.titlePlaceholder}>
                        <Animated.View
                            style={[
                                styles.shimmer,
                                {
                                    transform: [{ translateX: shimmerTranslate }],
                                },
                            ]}
                        />
                    </View>

                    {/* Sous-titre */}
                    <View style={styles.subtitlePlaceholder}>
                        <Animated.View
                            style={[
                                styles.shimmer,
                                {
                                    transform: [{ translateX: shimmerTranslate }],
                                },
                            ]}
                        />
                    </View>

                    {/* Tags */}
                    <View style={styles.tagsRow}>
                        <View style={styles.tagPlaceholder}>
                            <Animated.View
                                style={[
                                    styles.shimmer,
                                    {
                                        transform: [{ translateX: shimmerTranslate }],
                                    },
                                ]}
                            />
                        </View>
                        <View style={styles.tagPlaceholder}>
                            <Animated.View
                                style={[
                                    styles.shimmer,
                                    {
                                        transform: [{ translateX: shimmerTranslate }],
                                    },
                                ]}
                            />
                        </View>
                        <View style={styles.tagPlaceholder}>
                            <Animated.View
                                style={[
                                    styles.shimmer,
                                    {
                                        transform: [{ translateX: shimmerTranslate }],
                                    },
                                ]}
                            />
                        </View>
                    </View>

                    {/* Footer (prix + bouton) */}
                    <View style={styles.footer}>
                        <View style={styles.pricePlaceholder}>
                            <Animated.View
                                style={[
                                    styles.shimmer,
                                    {
                                        transform: [{ translateX: shimmerTranslate }],
                                    },
                                ]}
                            />
                        </View>
                        <View style={styles.buttonPlaceholder}>
                            <Animated.View
                                style={[
                                    styles.shimmer,
                                    {
                                        transform: [{ translateX: shimmerTranslate }],
                                    },
                                ]}
                            />
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginVertical: 8,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        overflow: 'hidden',
    },
    imagePlaceholder: {
        width: '100%',
        height: 180,
        backgroundColor: '#E5E7EB',
        overflow: 'hidden',
    },
    content: {
        padding: 16,
    },
    badge: {
        width: 100,
        height: 24,
        backgroundColor: '#E5E7EB',
        borderRadius: 12,
        marginBottom: 12,
        overflow: 'hidden',
    },
    titlePlaceholder: {
        width: '80%',
        height: 20,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        marginBottom: 10,
        overflow: 'hidden',
    },
    subtitlePlaceholder: {
        width: '60%',
        height: 16,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        marginBottom: 16,
        overflow: 'hidden',
    },
    tagsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    tagPlaceholder: {
        width: 70,
        height: 28,
        backgroundColor: '#E5E7EB',
        borderRadius: 14,
        overflow: 'hidden',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    pricePlaceholder: {
        width: 100,
        height: 28,
        backgroundColor: '#E5E7EB',
        borderRadius: 6,
        overflow: 'hidden',
    },
    buttonPlaceholder: {
        width: 120,
        height: 40,
        backgroundColor: '#E5E7EB',
        borderRadius: 8,
        overflow: 'hidden',
    },
    shimmer: {
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
    },
});

export default ProductCardSkeleton;

