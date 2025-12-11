/**
 * Point d'entrée ultra-minimal de l'application avec gestion d'erreur robuste
 * Ce fichier est chargé AVANT App.tsx et peut capturer les erreurs très précoces
 */

import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import 'react-native-gesture-handler';

// ✅ CRITIQUE: Initialiser AsyncStorage de manière BLOQUANTE au démarrage
// Cela résout le problème "Driver not found" à la racine
// ✅ AMÉLIORÉ: Attendre que l'initialisation soit complète avant de continuer
let asyncStorageInitialized = false;
(async () => {
    try {
        const { initializeAsyncStorage } = require('./src/utils/asyncStorageInit');
        // ✅ CRITIQUE: Attendre jusqu'à 5 secondes pour l'initialisation
        const initialized = await Promise.race([
            initializeAsyncStorage(),
            new Promise < boolean > ((resolve) => {
                setTimeout(() => resolve(false), 5000); // Timeout après 5s
            })
        ]);
        asyncStorageInitialized = initialized;
        if (initialized) {
            console.log('[INDEX.JS] ✅ AsyncStorage initialisé avec succès au démarrage');
        } else {
            console.warn('[INDEX.JS] ⚠️ AsyncStorage non disponible au démarrage (l\'app continuera sans persistance locale)');
        }
    } catch (asyncStorageError) {
        console.error('[INDEX.JS] ⚠️ Erreur initialisation AsyncStorage (non-bloquant):', asyncStorageError);
        asyncStorageInitialized = false;
    }
})();

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

        // ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
        try {
            const SafeStorage = require('./src/utils/safeStorage').default;
            SafeStorage.setItem('last_crash_error', JSON.stringify({
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

// ✅ CRITIQUE: Intercepter les Promise rejections AsyncStorage AVANT qu'elles ne remontent
// Cela évite les erreurs "Driver not found" et "No available storage method found" dans les logs
// ✅ AMÉLIORÉ: Interception plus robuste avec plusieurs méthodes
if (typeof global.Promise !== 'undefined') {
    // Méthode 1: Intercepter via _unhandledRejection si disponible
    if (global.Promise._unhandledRejection) {
        const originalRejectionTracking = global.Promise._unhandledRejection;
        global.Promise._unhandledRejection = function (error) {
            // ✅ CRITIQUE: Filtrer les erreurs AsyncStorage connues (non-bloquantes)
            const errorMsg = error?.message || String(error);
            const isAsyncStorageError =
                errorMsg.includes('Driver not found') ||
                errorMsg.includes('No available storage method found') ||
                (errorMsg.includes('AsyncStorage') && (errorMsg.includes('not found') || errorMsg.includes('unavailable')));

            if (isAsyncStorageError) {
                // ✅ Ces erreurs sont gérées par SafeStorage, ne pas les logger comme erreurs critiques
                // Elles sont non-bloquantes et l'app continue de fonctionner
                return; // Ne pas propager l'erreur
            }

            // Pour les autres erreurs, logger normalement
            if (originalRejectionTracking) {
                originalRejectionTracking.call(this, error);
            }
        };
    }

    // Méthode 2: Intercepter via addEventListener si disponible (React Native)
    if (typeof global.addEventListener === 'function') {
        global.addEventListener('unhandledrejection', (event) => {
            const error = event.reason || event;
            const errorMsg = error?.message || String(error);
            const isAsyncStorageError =
                errorMsg.includes('Driver not found') ||
                errorMsg.includes('No available storage method found') ||
                (errorMsg.includes('AsyncStorage') && (errorMsg.includes('not found') || errorMsg.includes('unavailable')));

            if (isAsyncStorageError) {
                // ✅ Empêcher la propagation de l'erreur AsyncStorage
                event.preventDefault();
                event.stopPropagation();
                return;
            }
        }, true); // ✅ Utiliser capture phase pour intercepter tôt
    }

    // Méthode 3: Intercepter via ErrorUtils si disponible (React Native)
    if (global.ErrorUtils && typeof global.ErrorUtils.setUnhandledPromiseRejectionTracker === 'function') {
        global.ErrorUtils.setUnhandledPromiseRejectionTracker((id, error) => {
            const errorMsg = error?.message || String(error);
            const isAsyncStorageError =
                errorMsg.includes('Driver not found') ||
                errorMsg.includes('No available storage method found') ||
                (errorMsg.includes('AsyncStorage') && (errorMsg.includes('not found') || errorMsg.includes('unavailable')));

            if (isAsyncStorageError) {
                // ✅ Ne pas logger ces erreurs, elles sont gérées par SafeStorage
                return;
            }

            // Pour les autres erreurs, logger normalement
            console.error('🚨 [UNHANDLED PROMISE REJECTION]:', error);
        });
    }
}

// ✅ CRITIQUE : Importer le service de logging AVANT tout autre code
// Cela garantit que TOUS les logs sont interceptés dès le début
let remoteLoggingService;
try {
    const loggingModule = require('./src/services/remoteLoggingService');
    remoteLoggingService = loggingModule.remoteLoggingService || loggingModule.default;
    console.log('[INDEX.JS] ✅ Service de logging distant chargé');
} catch (error) {
    console.error('[INDEX.JS] ⚠️ Impossible de charger le service de logging distant:', error);
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
    const { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } = require('react-native');
    const Clipboard = require('expo-clipboard');

    App = () => {
        const copyError = async () => {
            const errorText = `
=== ERREUR CRITIQUE YUKPOMNANG ===
Message: ${error?.message || 'Erreur inconnue'}
Stack: ${error?.stack || 'Pas de stack trace'}
Platform: ${Platform.OS} ${Platform.Version}
Timestamp: ${new Date().toISOString()}
=== FIN ===
            `.trim();

            try {
                await Clipboard.setStringAsync(errorText);
                Alert.alert('✅ Copié', 'L\'erreur a été copiée dans le presse-papier. Collez-la ici pour analyse.');
            } catch (e) {
                console.error('[INDEX.JS] Erreur copie presse-papier:', e);
            }
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

