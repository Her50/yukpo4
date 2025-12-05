/**
 * Composant Skeleton pour les cartes de tickets
 * Remplace les spinners par des placeholders animés
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';

interface SkeletonCardProps {
    count?: number;
}

const SkeletonCard: React.FC<SkeletonCardProps> = ({ count = 1 }) => {
    return (
        <>
            {Array.from({ length: count }).map((_, index) => (
                <SkeletonPlaceholder key={index} borderRadius={12}>
                    <View style={styles.card}>
                        <View style={styles.header}>
                            <View style={styles.title} />
                            <View style={styles.price} />
                        </View>
                        <View style={styles.route}>
                            <View style={styles.city} />
                            <View style={styles.arrow} />
                            <View style={styles.city} />
                        </View>
                        <View style={styles.footer}>
                            <View style={styles.info} />
                            <View style={styles.info} />
                        </View>
                    </View>
                </SkeletonPlaceholder>
            ))}
        </>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    title: {
        width: 150,
        height: 20,
        borderRadius: 4,
    },
    price: {
        width: 80,
        height: 20,
        borderRadius: 4,
    },
    route: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    city: {
        flex: 1,
        height: 16,
        borderRadius: 4,
        marginHorizontal: 8,
    },
    arrow: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
    },
    info: {
        flex: 1,
        height: 14,
        borderRadius: 4,
    },
});

export default SkeletonCard;


