import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
    console.log('[App] Démarrage ultra-simple de Yukpomnang');

    return (
        <View style={styles.container}>
            <StatusBar style="auto" />
            <Text style={styles.title}>🎉 Yukpomnang Ultra-Simple</Text>
            <Text style={styles.subtitle}>Application fonctionne sans erreur !</Text>
            <Text style={styles.info}>Version de test pour identifier les problèmes</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#0F52BA',
        textAlign: 'center',
        marginBottom: 20,
    },
    subtitle: {
        fontSize: 18,
        color: '#333',
        textAlign: 'center',
        marginBottom: 10,
    },
    info: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        fontStyle: 'italic',
    },
});
