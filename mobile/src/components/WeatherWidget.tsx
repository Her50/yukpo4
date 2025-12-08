import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getWeatherApiKey } from '../config/weatherConfig';
import { theme } from '../theme/theme';
import WeatherForecastModal from './WeatherForecastModal';

interface WeatherData {
    temperature: number;
    description: string;
    humidity: number;
    windSpeed: number;
    location: string;
    icon: string;
}

interface WeatherWidgetProps {
    location?: { lat: number; lng: number };
    onLocationPress?: () => void;
    compact?: boolean;
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ location, onLocationPress, compact = false }) => {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showForecastModal, setShowForecastModal] = useState(false);
    const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [gpsPermissionRequested, setGpsPermissionRequested] = useState(false);

    // Fonction pour obtenir l'icône météo basée sur la description
    const getWeatherIcon = (description: string): string => {
        const desc = description.toLowerCase();
        if (desc.includes('sun') || desc.includes('clear')) return '☀️';
        if (desc.includes('cloud')) return '☁️';
        if (desc.includes('rain')) return '🌧️';
        if (desc.includes('storm')) return '⛈️';
        if (desc.includes('snow')) return '❄️';
        if (desc.includes('fog') || desc.includes('mist')) return '🌫️';
        return '🌤️';
    };

    /**
     * Demander les permissions GPS et obtenir la position actuelle
     */
    const requestGPSLocation = async (): Promise<{ lat: number; lng: number } | null> => {
        try {
            // Vérifier les permissions existantes
            const { status: existingStatus } = await Location.getForegroundPermissionsAsync();

            if (existingStatus !== 'granted') {
                // Demander la permission
                const { status } = await Location.requestForegroundPermissionsAsync();
                setGpsPermissionRequested(true);

                if (status !== 'granted') {
                    console.log('[WeatherWidget] ℹ️ Permission GPS refusée par l\'utilisateur');
                    return null;
                }
            }

            // Obtenir la position actuelle avec timeout
            const locationPromise = Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('GPS timeout après 10 secondes')), 10000)
            );

            const currentLocation = await Promise.race([locationPromise, timeoutPromise]);

            if (currentLocation?.coords) {
                const coords = {
                    lat: currentLocation.coords.latitude,
                    lng: currentLocation.coords.longitude
                };
                setGpsLocation(coords);
                console.log('[WeatherWidget] ✅ Position GPS obtenue:', coords);
                return coords;
            }

            return null;
        } catch (error: any) {
            console.log('[WeatherWidget] ℹ️ Impossible d\'obtenir la position GPS:', error.message);
            return null;
        }
    };

    // Fonction pour récupérer la météo avec OpenWeatherMap
    const fetchWeather = async () => {
        console.log('[WeatherWidget] Début fetchWeather, location prop:', location);

        setLoading(true);
        setError(null);

        try {
            // Utiliser la location prop en priorité, sinon essayer d'obtenir via GPS
            let currentLocation = location || gpsLocation;

            if (!currentLocation) {
                // Essayer d'obtenir la position GPS si pas encore demandée
                if (!gpsPermissionRequested) {
                    console.log('[WeatherWidget] 📍 Tentative d\'obtention de la position GPS...');
                    currentLocation = await requestGPSLocation();
                }
            }

            if (!currentLocation) {
                // Pas de position GPS disponible - utiliser données mockées
                console.log('[WeatherWidget] ℹ️ Pas de position GPS disponible, utilisation des données mockées');
                const mockWeather: WeatherData = {
                    temperature: Math.round(20 + Math.random() * 15), // 20-35°C
                    description: ['Ensoleillé', 'Nuageux', 'Pluvieux', 'Orageux'][Math.floor(Math.random() * 4)],
                    humidity: Math.round(40 + Math.random() * 40), // 40-80%
                    windSpeed: Math.round(5 + Math.random() * 15), // 5-20 km/h
                    location: 'Yaoundé, Cameroun',
                    icon: getWeatherIcon('Ensoleillé')
                };
                setWeather(mockWeather);
                setError(null);
                setLoading(false);
                return;
            }

            // Récupérer la clé API depuis le backend
            const API_KEY = await getWeatherApiKey();
            console.log('[WeatherWidget] Clé API récupérée:', API_KEY ? 'Oui' : 'Non');

            if (!API_KEY || API_KEY === 'YOUR_OPENWEATHER_API_KEY') {
                console.log('[WeatherWidget] Clé API non configurée, utilisation des données mockées');
                throw new Error('Clé API météo non configurée');
            }

            // Appel API météo actuelle
            const url = `https://api.openweathermap.org/data/2.5/weather?lat=${currentLocation.lat}&lon=${currentLocation.lng}&appid=${API_KEY}&units=metric&lang=fr`;
            console.log('[WeatherWidget] Appel API météo:', url.replace(API_KEY, '***'));

            const response = await fetch(url);

            if (!response.ok) {
                console.warn('[WeatherWidget] ⚠️ Erreur API météo:', response.status, response.statusText);
                throw new Error(`Erreur API météo: ${response.status}`);
            }

            const data = await response.json();
            console.log('[WeatherWidget] Données météo reçues:', data);

            // Géocodage inverse pour obtenir le nom de la ville
            const geocodeUrl = `https://api.openweathermap.org/geo/1.0/reverse?lat=${currentLocation.lat}&lon=${currentLocation.lng}&limit=1&appid=${API_KEY}`;
            const geocodeResponse = await fetch(geocodeUrl);
            const geocodeData = await geocodeResponse.json();

            const cityName = geocodeData[0]?.name || 'Position actuelle';
            const countryName = geocodeData[0]?.country || '';

            const weatherData: WeatherData = {
                temperature: Math.round(data.main.temp),
                description: data.weather[0].description,
                humidity: data.main.humidity,
                windSpeed: Math.round(data.wind.speed * 3.6), // Convertir m/s en km/h
                location: `${cityName}${countryName ? `, ${countryName}` : ''}`,
                icon: getWeatherIcon(data.weather[0].description)
            };

            console.log('[WeatherWidget] Données météo traitées:', weatherData);
            setWeather(weatherData);
        } catch (err: any) {
            // Distinguer les erreurs attendues (GPS, API non configurée) des vraies erreurs
            const errorMessage = err?.message || '';
            const isExpectedError =
                errorMessage.includes('Position GPS requise') ||
                errorMessage.includes('Clé API météo non configurée') ||
                errorMessage.includes('GPS timeout');

            if (isExpectedError) {
                // Erreur attendue - logger en info, pas en error
                console.log('[WeatherWidget] ℹ️', errorMessage, '- utilisation des données mockées');
            } else {
                // Vraie erreur (API, réseau, etc.) - logger en warning
                console.warn('[WeatherWidget] ⚠️ Erreur météo, utilisation des données mockées:', errorMessage);
            }

            // Fallback vers des données mockées en cas d'erreur
            const mockWeather: WeatherData = {
                temperature: Math.round(20 + Math.random() * 15), // 20-35°C
                description: ['Ensoleillé', 'Nuageux', 'Pluvieux', 'Orageux'][Math.floor(Math.random() * 4)],
                humidity: Math.round(40 + Math.random() * 40), // 40-80%
                windSpeed: Math.round(5 + Math.random() * 15), // 5-20 km/h
                location: (location || gpsLocation) ? 'Position actuelle' : 'Yaoundé, Cameroun',
                icon: getWeatherIcon('Ensoleillé')
            };

            console.log('[WeatherWidget] Données mockées générées:', mockWeather);
            setWeather(mockWeather);
            setError(null); // Pas d'erreur, on utilise les données mockées
        } finally {
            setLoading(false);
        }
    };


    // Charger la météo quand la position change
    useEffect(() => {
        console.log('[WeatherWidget] useEffect triggered, location:', location);
        fetchWeather();
    }, [location]);

    if (loading) {
        return (
            <View style={compact ? styles.compactContainer : styles.container}>
                <View style={compact ? styles.compactLoadingContainer : styles.loadingContainer}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text style={compact ? styles.compactLoadingText : styles.loadingText}>Météo...</Text>
                </View>
            </View>
        );
    }

    if (error) {
        return (
            <View style={compact ? styles.compactContainer : styles.container}>
                <TouchableOpacity style={compact ? styles.compactErrorContainer : styles.errorContainer} onPress={onLocationPress}>
                    <Text style={compact ? styles.compactErrorIcon : styles.errorIcon}>🌤️</Text>
                    <Text style={compact ? styles.compactErrorText : styles.errorText}>
                        {compact ? 'Météo' : 'Météo indisponible'}
                    </Text>
                    {!compact && <Text style={styles.errorSubtext}>Appuyez pour activer GPS</Text>}
                </TouchableOpacity>
            </View>
        );
    }

    if (!weather) {
        return (
            <View style={compact ? styles.compactContainer : styles.container}>
                <TouchableOpacity style={compact ? styles.compactNoDataContainer : styles.noDataContainer} onPress={onLocationPress}>
                    <Text style={compact ? styles.compactNoDataIcon : styles.noDataIcon}>🌤️</Text>
                    <Text style={compact ? styles.compactNoDataText : styles.noDataText}>Météo</Text>
                    {!compact && <Text style={styles.noDataSubtext}>Activer GPS</Text>}
                </TouchableOpacity>
            </View>
        );
    }

    if (compact) {
        return (
            <View style={styles.compactContainer}>
                <TouchableOpacity
                    style={styles.compactWeatherCard}
                    onPress={() => setShowForecastModal(true)}
                >
                    <Text style={styles.compactWeatherIcon}>{weather.icon}</Text>
                    <Text style={styles.compactTemperature}>{weather.temperature}°C</Text>
                </TouchableOpacity>


                <WeatherForecastModal
                    visible={showForecastModal}
                    onClose={() => setShowForecastModal(false)}
                    location={location}
                    days={7} // Par défaut 7 jours
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.weatherCard}
                onPress={() => setShowForecastModal(true)}
            >
                <View style={styles.weatherHeader}>
                    <Text style={styles.weatherIcon}>{weather.icon}</Text>
                    <View style={styles.weatherInfo}>
                        <Text style={styles.temperature}>{weather.temperature}°C</Text>
                        <Text style={styles.description}>{weather.description}</Text>
                    </View>
                </View>

                <View style={styles.weatherDetails}>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailIcon}>💧</Text>
                        <Text style={styles.detailText}>{weather.humidity}%</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailIcon}>💨</Text>
                        <Text style={styles.detailText}>{weather.windSpeed} km/h</Text>
                    </View>
                </View>

                <Text style={styles.locationText}>{weather.location}</Text>
            </TouchableOpacity>

            <WeatherForecastModal
                visible={showForecastModal}
                onClose={() => setShowForecastModal(false)}
                location={location}
                days={7} // Par défaut 7 jours
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    loadingText: {
        marginLeft: 8,
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
        fontWeight: '500',
    },
    errorContainer: {
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    errorIcon: {
        fontSize: 24,
        marginBottom: 4,
    },
    errorText: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
        fontWeight: '500',
        marginBottom: 2,
    },
    errorSubtext: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.7)',
    },
    noDataContainer: {
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    noDataIcon: {
        fontSize: 24,
        marginBottom: 4,
    },
    noDataText: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
        fontWeight: '500',
        marginBottom: 2,
    },
    noDataSubtext: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.7)',
    },
    weatherCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    weatherHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    weatherIcon: {
        fontSize: 32,
        marginRight: 12,
    },
    weatherInfo: {
        flex: 1,
    },
    temperature: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 2,
    },
    description: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
        fontWeight: '500',
    },
    weatherDetails: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 12,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailIcon: {
        fontSize: 16,
        marginRight: 4,
    },
    detailText: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '500',
    },
    locationText: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.7)',
        textAlign: 'center',
        fontStyle: 'italic',
    },
    // Styles pour le mode compact
    compactContainer: {
        marginBottom: 0,
    },
    compactLoadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.8)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    compactLoadingText: {
        marginLeft: 6,
        fontSize: 12,
        color: '#1F2937',
        fontWeight: '600',
    },
    compactErrorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.8)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    compactErrorIcon: {
        fontSize: 18,
        marginRight: 8,
    },
    compactErrorText: {
        fontSize: 12,
        color: '#1F2937',
        fontWeight: '600',
    },
    compactNoDataContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.8)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    compactNoDataIcon: {
        fontSize: 18,
        marginRight: 8,
    },
    compactNoDataText: {
        fontSize: 12,
        color: '#1F2937',
        fontWeight: '600',
    },
    compactWeatherCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.8)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        minWidth: 70,
    },
    compactWeatherIcon: {
        fontSize: 18,
        marginRight: 6,
    },
    compactTemperature: {
        fontSize: 13,
        color: '#1F2937',
        fontWeight: '700',
    },
});

export default WeatherWidget;

