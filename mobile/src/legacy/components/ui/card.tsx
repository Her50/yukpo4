/**
 * Composant Card pour React Native
 */

import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

interface CardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    title?: string;
    subtitle?: string;
}

export const Card: React.FC<CardProps> = ({
    children,
    style,
    title,
    subtitle,
}) => {
    return (
        <View style={[styles.card, style]}>
            {(title || subtitle) && (
                <View style={styles.header}>
                    {title && <Text style={styles.title}>{title}</Text>}
                    {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
                </View>
            )}
            <View style={styles.content}>
                {children}
            </View>
        </View>
    );
};

export const CardContent: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
    children,
    style,
}) => {
    return <View style={[styles.content, style]}>{children}</View>;
};

export const CardHeader: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
    children,
    style,
}) => {
    return <View style={[styles.header, style]}>{children}</View>;
};

export const CardTitle: React.FC<{ children: React.ReactNode; style?: any }> = ({
    children,
    style,
}) => {
    return <Text style={[styles.title, style]}>{children}</Text>;
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    header: {
        marginBottom: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
    },
    content: {
        flex: 1,
    },
});

export default Card;
