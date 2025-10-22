// @ts-nocheck
// 🚨 VERSION ULTRA MINIMALE POUR DIAGNOSTIC
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
    console.log('[App] 🚨 VERSION ULTRA MINIMALE - Diagnostic');

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' }}>
                    <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>
                        ✅ Yukpomnang
                    </Text>
                    <Text style={{ fontSize: 16, color: '#666' }}>
                        Version Ultra Minimale
                    </Text>
                    <Text style={{ fontSize: 14, color: '#999', marginTop: 8 }}>
                        Si vous voyez ceci, l'app fonctionne !
                    </Text>
                    <StatusBar style="auto" />
                </View>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

