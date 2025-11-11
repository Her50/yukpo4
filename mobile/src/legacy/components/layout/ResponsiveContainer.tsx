/**
 * Container responsive pour l'application
 */

import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

interface ResponsiveContainerProps {
    children: React.ReactNode;
    style?: ViewStyle;
    maxWidth?: number;
}

export default function ResponsiveContainer({
    children,
    style,
    maxWidth = 1200
}: ResponsiveContainerProps) {
    return (
        <View style={[styles.container, { maxWidth }, style]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        alignSelf: 'center',
    },
});
