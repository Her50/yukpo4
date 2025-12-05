/**
 * Skeleton loading pour ProductCard - Niveau géant (Instagram/TikTok)
 * Shimmer effect premium avec LinearGradient
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;

const ProductCardSkeleton: React.FC = () => {
    const shimmerAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.loop(
            Animated.timing(shimmerAnim, {
                toValue: 1,
                duration: 1500, // ✅ GÉANT-LEVEL: Réduit de 2000 → 1500 pour plus de fluidité
                useNativeDriver: true,
            })
        ).start();
    }, [shimmerAnim]);

    const translateX = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-CARD_WIDTH, CARD_WIDTH],
    });

    const ShimmerOverlay = ({ style }: { style: any }) => (
        <Animated.View
            style={[
                StyleSheet.absoluteFill,
                {
                    transform: [{ translateX }],
                },
            ]}
        >
            <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.5)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
            />
        </Animated.View>
    );

    return (
        <View style={styles.container}>
            {/* Image placeholder avec shimmer */}
            <View style={styles.imagePlaceholder}>
                <ShimmerOverlay />
            </View>

            {/* Content placeholder */}
            <View style={styles.contentContainer}>
                {/* Title avec shimmer */}
                <View style={styles.titlePlaceholder}>
                    <ShimmerOverlay />
                </View>

                {/* Description lines avec shimmer */}
                <View style={styles.descriptionLine1}>
                    <ShimmerOverlay />
                </View>
                <View style={styles.descriptionLine2}>
                    <ShimmerOverlay />
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <View style={styles.pricePlaceholder}>
                        <ShimmerOverlay />
                    </View>
                    <View style={styles.badgePlaceholder}>
                        <ShimmerOverlay />
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: CARD_WIDTH,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
        marginRight: 12,
        height: 320,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    imagePlaceholder: {
        width: '100%',
        height: 180,
        backgroundColor: '#E5E7EB',
        overflow: 'hidden', // ✅ GÉANT-LEVEL: Pour shimmer effect
    },
    contentContainer: {
        padding: 12,
        flex: 1,
    },
    titlePlaceholder: {
        height: 20,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        marginBottom: 8,
        width: '70%',
        overflow: 'hidden', // ✅ GÉANT-LEVEL: Pour shimmer effect
    },
    descriptionLine1: {
        height: 14,
        backgroundColor: '#F3F4F6',
        borderRadius: 4,
        marginBottom: 6,
        width: '100%',
        overflow: 'hidden', // ✅ GÉANT-LEVEL: Pour shimmer effect
    },
    descriptionLine2: {
        height: 14,
        backgroundColor: '#F3F4F6',
        borderRadius: 4,
        marginBottom: 12,
        width: '80%',
        overflow: 'hidden', // ✅ GÉANT-LEVEL: Pour shimmer effect
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 'auto',
    },
    pricePlaceholder: {
        height: 24,
        width: 80,
        backgroundColor: '#E5E7EB',
        borderRadius: 6,
        overflow: 'hidden', // ✅ GÉANT-LEVEL: Pour shimmer effect
    },
    badgePlaceholder: {
        height: 24,
        width: 60,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        overflow: 'hidden', // ✅ GÉANT-LEVEL: Pour shimmer effect
    },
});

export default ProductCardSkeleton;
