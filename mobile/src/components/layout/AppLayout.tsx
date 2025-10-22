/**
 * Layout principal de l'application
 */

import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface AppLayoutProps {
    children: React.ReactNode;
    padding?: boolean | number;
    style?: ViewStyle;
}

export default function AppLayout({
    children,
    padding = true,
    style
}: AppLayoutProps) {
    const paddingStyle = typeof padding === 'number'
        ? { padding }
        : padding
            ? { padding: 16 }
            : {};

    return (
        <SafeAreaView style={[styles.container, paddingStyle, style]}>
            {children}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
});
