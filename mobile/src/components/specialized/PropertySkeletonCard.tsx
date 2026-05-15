// ✅ NOUVEAU Phase 1.4: Skeleton loading pour meilleure perception de performance
import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface PropertySkeletonCardProps {
    count?: number;
}

const PropertySkeletonCard: React.FC<PropertySkeletonCardProps> = ({ count = 1 }) => {
    const animatedValue = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(animatedValue, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [animatedValue]);

    const opacity = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <>
            {Array.from({ length: count }).map((_, index) => (
                <View key={index} style={styles.container}>
                    <Animated.View style={[styles.imagePlaceholder, { opacity }]} />
                    <View style={styles.content}>
                        <Animated.View style={[styles.titlePlaceholder, { opacity }]} />
                        <Animated.View style={[styles.subtitlePlaceholder, { opacity }]} />
                        <View style={styles.footer}>
                            <Animated.View style={[styles.pricePlaceholder, { opacity }]} />
                            <Animated.View style={[styles.badgePlaceholder, { opacity }]} />
                        </View>
                    </View>
                </View>
            ))}
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    imagePlaceholder: {
        width: '100%',
        height: 200,
        backgroundColor: '#E5E7EB',
    },
    content: {
        padding: 16,
    },
    titlePlaceholder: {
        height: 20,
        width: '70%',
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        marginBottom: 8,
    },
    subtitlePlaceholder: {
        height: 16,
        width: '50%',
        backgroundColor: '#F3F4F6',
        borderRadius: 4,
        marginBottom: 12,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    pricePlaceholder: {
        height: 24,
        width: 120,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
    },
    badgePlaceholder: {
        height: 24,
        width: 60,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
    },
});

export default PropertySkeletonCard;

