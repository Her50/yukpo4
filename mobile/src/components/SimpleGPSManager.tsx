import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useGPSTracking } from '../hooks/useGPSTracking';
import { SafeIcon } from './SafeIcon';

/**
 * Composant GPS simple pour les écrans qui en ont besoin
 * 
 * Fonctionnalités:
 * - Bouton pour activer/désactiver le GPS
 * - Affichage de la position actuelle
 * - Gestion d'erreur simple
 * - Interface utilisateur claire
 */
const SimpleGPSManager: React.FC = () => {
    const { user } = useAuth();
    const { isTracking, currentLocation, lastUpdate, error, startTracking, stopTracking, updateLocation } = useGPSTracking();
    const [isLoading, setIsLoading] = useState(false);

    const handleToggleGPS = async () => {
        if (isTracking) {
            stopTracking();
        } else {
            setIsLoading(true);
            try {
                await startTracking();
            } catch (error) {
                Alert.alert('Erreur GPS', 'Impossible de démarrer le GPS');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleUpdateLocation = async () => {
        setIsLoading(true);
        try {
            await updateLocation();
        } catch (error) {
            Alert.alert('Erreur GPS', 'Impossible de récupérer la position');
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) {
        return null;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>📍 GPS Tracking</Text>
                <TouchableOpacity
                    style={[
                        styles.toggleButton,
                        isTracking ? styles.activeButton : styles.inactiveButton
                    ]}
                    onPress={handleToggleGPS}
                    disabled={isLoading}
                >
                    <SafeIcon 
                        name={isTracking ? "location" : "location-off"} 
                        size={16} 
                        color="#fff" 
                    />
                    <Text style={styles.buttonText}>
                        {isLoading ? '...' : isTracking ? 'Arrêter' : 'Démarrer'}
                    </Text>
                </TouchableOpacity>
            </View>

            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>❌ {error}</Text>
                </View>
            )}

            {currentLocation && (
                <View style={styles.locationContainer}>
                    <Text style={styles.locationLabel}>Position actuelle:</Text>
                    <Text style={styles.locationText}>
                        {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                    </Text>
                    {lastUpdate && (
                        <Text style={styles.updateText}>
                            Dernière mise à jour: {lastUpdate.toLocaleTimeString()}
                        </Text>
                    )}
                    <TouchableOpacity
                        style={styles.updateButton}
                        onPress={handleUpdateLocation}
                        disabled={isLoading}
                    >
                        <SafeIcon name="refresh" size={14} color="#007AFF" />
                        <Text style={styles.updateButtonText}>Actualiser</Text>
                    </TouchableOpacity>
                </View>
            )}

            {!currentLocation && !error && (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                        Aucune position GPS disponible
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        margin: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    toggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 4,
    },
    activeButton: {
        backgroundColor: '#FF4444',
    },
    inactiveButton: {
        backgroundColor: '#007AFF',
    },
    buttonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500',
    },
    errorContainer: {
        backgroundColor: '#FFEBEE',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
    },
    errorText: {
        color: '#D32F2F',
        fontSize: 14,
    },
    locationContainer: {
        backgroundColor: '#F5F5F5',
        padding: 12,
        borderRadius: 8,
    },
    locationLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#666',
        marginBottom: 4,
    },
    locationText: {
        fontSize: 16,
        fontFamily: 'monospace',
        color: '#333',
        marginBottom: 8,
    },
    updateText: {
        fontSize: 12,
        color: '#888',
        marginBottom: 8,
    },
    updateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 4,
    },
    updateButtonText: {
        color: '#007AFF',
        fontSize: 12,
        fontWeight: '500',
    },
    emptyContainer: {
        padding: 12,
        alignItems: 'center',
    },
    emptyText: {
        color: '#888',
        fontSize: 14,
        fontStyle: 'italic',
    },
});

export default SimpleGPSManager;
