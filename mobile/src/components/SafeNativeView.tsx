/**
 * ✅ RÉÉCRIT COMPLÈTEMENT - SafeNativeView
 * Composant SafeAreaView natif pour remplacer react-native-safe-area-context
 * Version simplifiée et sûre sans cleanChildren problématique
 * ✅ NOUVEAU 2025-12-24: Inclut KeyboardAvoidingView pour gérer le clavier automatiquement
 */

import React from 'react';
import { Dimensions, KeyboardAvoidingView, Platform, StatusBar, StyleSheet, View } from 'react-native';

const { height, width } = Dimensions.get('window');

interface SafeNativeViewProps {
    children: React.ReactNode;
    style?: any;
    edges?: ('top' | 'bottom' | 'left' | 'right')[];
    backgroundColor?: string;
    testID?: string;
    pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
    /** ✅ NOUVEAU: Désactiver KeyboardAvoidingView si nécessaire (par défaut: activé) */
    enableKeyboardAvoiding?: boolean;
    /** ✅ NOUVEAU: Offset vertical pour le clavier (par défaut: calculé automatiquement) */
    keyboardVerticalOffset?: number;
}

export const SafeNativeView: React.FC<SafeNativeViewProps> = ({
    children,
    style,
    edges = ['top', 'bottom', 'left', 'right'],
    backgroundColor = '#FFFFFF',
    testID,
    pointerEvents,
    enableKeyboardAvoiding = true, // ✅ NOUVEAU: Activé par défaut
    keyboardVerticalOffset, // ✅ NOUVEAU: Calculé automatiquement si non fourni
}) => {
    const getStatusBarHeight = () => {
        if (Platform.OS === 'android') {
            return StatusBar.currentHeight || 24;
        }
        // iOS - valeurs approximatives
        return 44;
    };

    const getSafeAreaInsets = () => {
        const statusBarHeight = getStatusBarHeight();
        const bottomInset = Platform.OS === 'ios' ? 34 : 0; // iPhone X+ home indicator

        return {
            top: edges.includes('top') ? statusBarHeight : 0,
            bottom: edges.includes('bottom') ? bottomInset : 0,
            left: edges.includes('left') ? 0 : 0,
            right: edges.includes('right') ? 0 : 0,
        };
    };

    const insets = getSafeAreaInsets();

    // ✅ NOUVEAU: Calculer l'offset du clavier automatiquement si non fourni
    const calculatedKeyboardOffset = keyboardVerticalOffset !== undefined
        ? keyboardVerticalOffset
        : Platform.OS === 'ios' 
            ? insets.top + 20 // iOS: status bar + marge
            : 0; // Android: pas besoin d'offset généralement

    const containerStyle = [
        styles.container,
        {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
            backgroundColor,
        },
        style,
    ];

    // ✅ CRITIQUE: Rendre directement les children sans nettoyage problématique
    // React Native gère déjà les children invalides
    
    // ✅ NOUVEAU: Wrapper avec KeyboardAvoidingView si activé
    if (enableKeyboardAvoiding) {
        return (
            <KeyboardAvoidingView
                style={containerStyle}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={calculatedKeyboardOffset}
                testID={testID}
                pointerEvents={pointerEvents}
            >
                {children}
            </KeyboardAvoidingView>
        );
    }

    return (
        <View style={containerStyle} testID={testID} pointerEvents={pointerEvents}>
            {children}
        </View>
    );
};

// Composant pour les écrans entiers
export const SafeScreen: React.FC<{
    children: React.ReactNode;
    style?: any;
    backgroundColor?: string;
}> = ({ children, style, backgroundColor = '#FFFFFF' }) => {
    return (
        <SafeNativeView
            style={[styles.screen, style]}
            backgroundColor={backgroundColor}
        >
            {children}
        </SafeNativeView>
    );
};

// Composant pour les conteneurs
export const SafeContainer: React.FC<{
    children: React.ReactNode;
    style?: any;
    padding?: number;
}> = ({ children, style, padding = 16 }) => {
    return (
        <SafeNativeView style={[styles.container, { padding }, style]}>
            {children}
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    screen: {
        flex: 1,
        width: width,
        height: height,
    },
});

export default SafeNativeView;
