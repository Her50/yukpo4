/**
 * VERSION ULTRA-MINIMALE POUR TESTER
 * Remplacez App.tsx par ce fichier pour tester
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
    console.log('🚀 App démarré');

    return (
        <View style={styles.container}>
            <Text style={styles.title}>✅ YUKPO TEST</Text>
            <Text style={styles.subtitle}>Si vous voyez ceci, React Native fonctionne</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 16,
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
});

