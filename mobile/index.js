/**
 * Point d'entrée ultra-minimal de l'application avec gestion d'erreur robuste
 * Ce fichier est chargé AVANT App.tsx et peut capturer les erreurs très précoces
 */

import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

// Capturer les erreurs globales JavaScript AVANT le chargement de l'app
if (global.ErrorUtils) {
    const originalHandler = global.ErrorUtils.getGlobalHandler();

    global.ErrorUtils.setGlobalHandler((error, isFatal) => {
        console.error('🚨 [GLOBAL ERROR HANDLER] Erreur capturée:', {
            message: error?.message,
            stack: error?.stack,
            isFatal,
            platform: Platform.OS
        });

        // Essayer de sauvegarder l'erreur dans AsyncStorage pour analyse ultérieure
        try {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            AsyncStorage.setItem('last_crash_error', JSON.stringify({
                message: error?.message,
                stack: error?.stack,
                timestamp: new Date().toISOString(),
                platform: Platform.OS,
                isFatal
            })).catch(err => {
                console.error('[GLOBAL ERROR HANDLER] Erreur sauvegarde crash:', err);
            });
        } catch (saveError) {
            console.error('[GLOBAL ERROR HANDLER] Erreur lors de la sauvegarde:', saveError);
        }

        // Appeler le handler original si disponible
        if (originalHandler) {
            originalHandler(error, isFatal);
        }
    });
}

// Capturer les promesses rejetées non gérées
if (typeof global.Promise !== 'undefined') {
    const originalRejectionTracking = global.Promise._unhandledRejection;
    global.Promise._unhandledRejection = function (error) {
        console.error('🚨 [UNHANDLED PROMISE REJECTION]:', error);

        if (originalRejectionTracking) {
            originalRejectionTracking.call(this, error);
        }
    };
}

// Logs de démarrage
console.log('='.repeat(50));
console.log('🚀 [INDEX.JS] Yukpomnang Mobile - Démarrage');
console.log('📱 [INDEX.JS] Platform:', Platform.OS, Platform.Version);
console.log('⏰ [INDEX.JS] Timestamp:', new Date().toISOString());
console.log('='.repeat(50));

// Charger l'application principale avec gestion d'erreur
let App;
try {
    App = require('./App').default;
    console.log('✅ [INDEX.JS] App.tsx chargé avec succès');
} catch (error) {
    console.error('❌ [INDEX.JS] ERREUR CRITIQUE: Impossible de charger App.tsx', error);

    // Créer une app de secours minimale qui affiche l'erreur
    const React = require('react');
    const { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Clipboard } = require('react-native');

    App = () => {
        const copyError = () => {
            const errorText = `
=== ERREUR CRITIQUE YUKPOMNANG ===
Message: ${error?.message || 'Erreur inconnue'}
Stack: ${error?.stack || 'Pas de stack trace'}
Platform: ${Platform.OS} ${Platform.Version}
Timestamp: ${new Date().toISOString()}
=== FIN ===
            `.trim();

            Clipboard.setString(errorText);
            Alert.alert('✅ Copié', 'L\'erreur a été copiée dans le presse-papier. Collez-la ici pour analyse.');
        };

        return React.createElement(View, { style: styles.container },
            React.createElement(View, { style: styles.header },
                React.createElement(Text, { style: styles.title }, '🚨 ERREUR CRITIQUE'),
                React.createElement(Text, { style: styles.subtitle }, 'L\'application n\'a pas pu démarrer')
            ),
            React.createElement(View, { style: styles.errorBox },
                React.createElement(Text, { style: styles.errorTitle }, 'Message d\'erreur:'),
                React.createElement(ScrollView, { style: styles.scrollView },
                    React.createElement(Text, { style: styles.errorText }, error?.message || 'Erreur inconnue'),
                    React.createElement(Text, { style: styles.stackText }, error?.stack || 'Pas de stack trace')
                )
            ),
            React.createElement(TouchableOpacity, { style: styles.button, onPress: copyError },
                React.createElement(Text, { style: styles.buttonText }, '📋 COPIER L\'ERREUR')
            ),
            React.createElement(Text, { style: styles.hint }, 'Copiez cette erreur et collez-la dans le chat pour obtenir de l\'aide.')
        );
    };
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1F2937',
        padding: 20,
        paddingTop: 50,
    },
    header: {
        marginBottom: 30,
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#EF4444',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#9CA3AF',
    },
    errorBox: {
        flex: 1,
        backgroundColor: '#374151',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    errorTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#F3F4F6',
        marginBottom: 12,
    },
    scrollView: {
        flex: 1,
    },
    errorText: {
        fontSize: 14,
        color: '#EF4444',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        marginBottom: 20,
    },
    stackText: {
        fontSize: 12,
        color: '#9CA3AF',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    button: {
        backgroundColor: '#3B82F6',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    hint: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 18,
    },
});

// Enregistrer l'application
console.log('[INDEX.JS] Enregistrement du composant racine...');
registerRootComponent(App);
console.log('[INDEX.JS] ✅ Composant racine enregistré');

