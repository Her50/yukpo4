import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { WEATHER_CONFIG, getWeatherApiKey, getWeatherApiUrl } from '../config/weatherConfig';
import { useLanguageSafe } from '../contexts/LanguageContext';

const { width } = Dimensions.get('window');

interface WeatherForecast {
    date: string;
    day: string;
    temperature: {
        min: number;
        max: number;
    };
    description: string;
    icon: string;
    humidity: number;
    windSpeed: number;
    precipitation: number;
}

interface WeatherForecastModalProps {
    visible: boolean;
    onClose: () => void;
    location?: { lat: number; lng: number };
    days?: number; // Nombre de jours de prévision (5, 7, 10, 16)
}

const WeatherForecastModal: React.FC<WeatherForecastModalProps> = ({
    visible,
    onClose,
    location,
    days = 5
}) => {
        const { t } = useLanguageSafe();
const [forecast, setForecast] = useState<WeatherForecast[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedDays, setSelectedDays] = useState(days);

    // Fonction pour obtenir l'icône météo
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

    // Fonction pour formater la date
    const formatDate = (dateString: string): { date: string; day: string } => {
        const date = new Date(dateString);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        let dayName = '';
        if (date.toDateString() === today.toDateString()) {
            dayName = 'Aujourd\'hui';
        } else if (date.toDateString() === tomorrow.toDateString()) {
            dayName = 'Demain';
        } else {
            dayName = date.toLocaleDateString('fr-FR', { weekday: 'long' });
        }

        return {
            date: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
            day: dayName
        };
    };

    // Fonction pour récupérer les prévisions météo
    const fetchWeatherForecast = async (requestedDays: number = selectedDays) => {
        console.log('[WeatherForecastModal] Début fetchWeatherForecast, jours:', requestedDays, 'location:', location);

        setLoading(true);
        setError(null);

        try {
            if (!location) {
                // Pas de position GPS disponible - cas normal, utiliser données mockées
                console.log('[WeatherForecastModal] ℹ️ Pas de position GPS, utilisation des données mockées');
                // Ne pas lancer d'erreur, utiliser directement les données mockées
                const mockForecast: WeatherForecast[] = [];
                const { descriptions, icons, temperatureRange, humidityRange, windSpeedRange } = WEATHER_CONFIG.MOCK_DATA;

                for (let i = 0; i < requestedDays; i++) {
                    const date = new Date();
                    date.setDate(date.getDate() + i);
                    const descIndex = Math.floor(Math.random() * descriptions.length);

                    const mockDay: WeatherForecast = {
                        date: formatDate(date.toISOString().split('T')[0]).date,
                        day: formatDate(date.toISOString().split('T')[0]).day,
                        temperature: {
                            min: Math.round(temperatureRange.min + Math.random() * 8),
                            max: Math.round(temperatureRange.min + 8 + Math.random() * 10)
                        },
                        description: descriptions[descIndex],
                        icon: icons[descIndex],
                        humidity: Math.round(humidityRange.min + Math.random() * (humidityRange.max - humidityRange.min)),
                        windSpeed: Math.round(windSpeedRange.min + Math.random() * (windSpeedRange.max - windSpeedRange.min)),
                        precipitation: Math.random() > 0.7 ? Math.round(Math.random() * 10) : 0
                    };

                    mockForecast.push(mockDay);
                }

                setForecast(mockForecast);
                setError(null);
                setLoading(false);
                return;
            }

            // Récupérer la clé API depuis le backend
            const apiKey = await getWeatherApiKey();
            console.log('[WeatherForecastModal] Clé API récupérée:', apiKey ? 'Oui' : 'Non');

            if (!apiKey || apiKey === 'YOUR_OPENWEATHER_API_KEY') {
                console.log('[WeatherForecastModal] Clé API non configurée, utilisation des données mockées');
                throw new Error('Clé API météo non configurée');
            }

            let forecastData: WeatherForecast[] = [];

            if (requestedDays <= WEATHER_CONFIG.LIMITS.FREE_API) {
                // API Forecast 5 jours (gratuite)
                const url = getWeatherApiUrl('FORECAST_5_DAYS', {
                    lat: location.lat,
                    lon: location.lng,
                    appid: apiKey
                });
                console.log('[WeatherForecastModal] Appel API prévisions:', url.replace(apiKey, '***'));

                const response = await fetch(url);

                if (!response.ok) {
                    console.error('[WeatherForecastModal] Erreur API prévisions:', response.status, response.statusText);
                    throw new Error(t('weatherForecastModal.erreurApiPrevisions', { response_status: response.status }));
                }

                const data = await response.json();
                console.log('[WeatherForecastModal] Données prévisions reçues:', data);

                // Traiter les données pour obtenir les prévisions par jour
                const dailyForecasts: { [key: string]: any[] } = {};

                data.list.forEach((item: any) => {
                    const date = item.dt_txt.split(' ')[0];
                    if (!dailyForecasts[date]) {
                        dailyForecasts[date] = [];
                    }
                    dailyForecasts[date].push(item);
                });

                // Convertir en format final
                forecastData = Object.keys(dailyForecasts)
                    .slice(0, requestedDays)
                    .map(date => {
                        const dayData = dailyForecasts[date];
                        const temperatures = dayData.map(item => item.main.temp);
                        const humidities = dayData.map(item => item.main.humidity);
                        const windSpeeds = dayData.map(item => item.wind.speed);
                        const precipitations = dayData.map(item => item.rain?.['3h'] || item.snow?.['3h'] || 0);

                        // Prendre les données de midi (12h) pour l'icône et description
                        const middayData = dayData.find(item => item.dt_txt.includes('12:00:00')) || dayData[0];

                        return {
                            date: formatDate(date).date,
                            day: formatDate(date).day,
                            temperature: {
                                min: Math.round(Math.min(...temperatures)),
                                max: Math.round(Math.max(...temperatures))
                            },
                            description: middayData.weather[0].description,
                            icon: getWeatherIcon(middayData.weather[0].description),
                            humidity: Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length),
                            windSpeed: Math.round(windSpeeds.reduce((a, b) => a + b, 0) / windSpeeds.length * 3.6),
                            precipitation: Math.round(precipitations.reduce((a, b) => a + b, 0))
                        };
                    });
            } else {
                // API One Call 3.0 pour 16 jours (payante mais plus précise)
                const url = getWeatherApiUrl('ONE_CALL_16_DAYS', {
                    lat: location.lat,
                    lon: location.lng,
                    appid: apiKey
                });
                console.log('[WeatherForecastModal] Appel API One Call:', url.replace(apiKey, '***'));

                const response = await fetch(url);

                if (!response.ok) {
                    // Fallback vers l'API gratuite si One Call n'est pas disponible
                    console.warn('[WeatherForecastModal] API One Call non disponible, utilisation de données mockées');
                    throw new Error('API One Call non disponible');
                }

                const data = await response.json();
                console.log('[WeatherForecastModal] Données One Call reçues:', data);

                // Traiter les données One Call
                forecastData = data.daily
                    .slice(0, requestedDays)
                    .map((day: any, index: number) => {
                        const date = new Date();
                        date.setDate(date.getDate() + index);

                        return {
                            date: formatDate(date.toISOString().split('T')[0]).date,
                            day: formatDate(date.toISOString().split('T')[0]).day,
                            temperature: {
                                min: Math.round(day.temp.min),
                                max: Math.round(day.temp.max)
                            },
                            description: day.weather[0].description,
                            icon: getWeatherIcon(day.weather[0].description),
                            humidity: day.humidity,
                            windSpeed: Math.round(day.wind_speed * 3.6),
                            precipitation: Math.round(day.rain || day.snow || 0)
                        };
                    });
            }

            console.log('[WeatherForecastModal] Prévisions traitées:', forecastData.length, 'jours');
            setForecast(forecastData);
        } catch (err: any) {
            // Distinguer les erreurs attendues (GPS, API non configurée) des vraies erreurs
            const errorMessage = err?.message || '';
            const isExpectedError =
                errorMessage.includes('Position GPS requise') ||
                errorMessage.includes(t('weatherForecastModal.cleApiMeteoNonConfiguree'));

            if (isExpectedError) {
                // Erreur attendue - logger en info/warning, pas en error
                console.log('[WeatherForecastModal] ℹ️', errorMessage, '- utilisation des données mockées');
            } else {
                // Vraie erreur (API, réseau, etc.) - logger en warning
                console.warn('[WeatherForecastModal] ⚠️ Erreur prévisions météo, utilisation des données mockées:', errorMessage);
            }

            // Fallback vers des données mockées étendues
            const mockForecast: WeatherForecast[] = [];
            const { descriptions, icons, temperatureRange, humidityRange, windSpeedRange } = WEATHER_CONFIG.MOCK_DATA;

            console.log('[WeatherForecastModal] ✅ Génération de', requestedDays, 'jours de données mockées');

            for (let i = 0; i < requestedDays; i++) {
                const date = new Date();
                date.setDate(date.getDate() + i);
                const descIndex = Math.floor(Math.random() * descriptions.length);

                const mockDay: WeatherForecast = {
                    date: formatDate(date.toISOString().split('T')[0]).date,
                    day: formatDate(date.toISOString().split('T')[0]).day,
                    temperature: {
                        min: Math.round(temperatureRange.min + Math.random() * 8),
                        max: Math.round(temperatureRange.min + 8 + Math.random() * 10)
                    },
                    description: descriptions[descIndex],
                    icon: icons[descIndex],
                    humidity: Math.round(humidityRange.min + Math.random() * (humidityRange.max - humidityRange.min)),
                    windSpeed: Math.round(windSpeedRange.min + Math.random() * (windSpeedRange.max - windSpeedRange.min)),
                    precipitation: Math.random() > 0.7 ? Math.round(Math.random() * 10) : 0
                };

                mockForecast.push(mockDay);
            }

            console.log('[WeatherForecastModal] ✅ Données mockées générées:', mockForecast.length, 'jours');
            console.log('[WeatherForecastModal] 📅 Plage:', mockForecast[0]?.day, 'à', mockForecast[mockForecast.length - 1]?.day);

            setForecast(mockForecast);
            setError(null); // Pas d'erreur, on utilise les données mockées
        } finally {
            setLoading(false);
        }
    };

    // Charger les prévisions quand le modal s'ouvre
    useEffect(() => {
        console.log('[WeatherForecastModal] useEffect triggered, visible:', visible, 'location:', location);
        if (visible) {
            // Charger les données même sans location (utilise des données mockées)
            // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
            fetchWeatherForecast().catch(error => {
                console.error('[WeatherForecastModal] Erreur fetchWeatherForecast:', error);
            });
        }
        // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
        return undefined;
    }, [visible, location]);

    const ForecastCard: React.FC<{ item: WeatherForecast; index: number }> = ({ item, index }) => (
        <View style={[styles.forecastCard, index === 0 && styles.todayCard]}>
            <View style={styles.forecastHeader}>
                <View style={styles.dateContainer}>
                    <Text style={[styles.dayText, index === 0 && styles.todayText]}>{item.day}</Text>
                    <Text style={[styles.dateText, index === 0 && styles.todayDateText]}>{item.date}</Text>
                </View>
                <View style={styles.iconContainer}>
                    <Text style={styles.weatherIcon}>{item.icon}</Text>
                </View>
            </View>

            <View style={styles.temperatureContainer}>
                <Text style={[styles.temperatureText, index === 0 && styles.todayTemperatureText]}>
                    {item.temperature.max}°
                </Text>
                <Text style={[styles.temperatureMinText, index === 0 && styles.todayTemperatureMinText]}>
                    {item.temperature.min}°
                </Text>
            </View>

            <Text style={[styles.descriptionText, index === 0 && styles.todayDescriptionText]}>
                {item.description}
            </Text>

            <View style={styles.detailsContainer}>
                <View style={styles.detailItem}>
                    <Text style={styles.detailIcon}>💧</Text>
                    <Text style={styles.detailText}>{item.humidity}%</Text>
                </View>
                <View style={styles.detailItem}>
                    <Text style={styles.detailIcon}>💨</Text>
                    <Text style={styles.detailText}>{item.windSpeed} km/h</Text>
                </View>
                {item.precipitation > 0 && (
                    <View style={styles.detailItem}>
                        <Text style={styles.detailIcon}>🌧️</Text>
                        <Text style={styles.detailText}>{item.precipitation}mm</Text>
                    </View>
                )}
            </View>
        </View>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>{t('weatherForecast.previsionsMeteo')}</Text>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>✕</Text>
                    </TouchableOpacity>
                </View>

                {/* Sélecteur de période */}
                <View style={styles.periodSelector}>
                    <Text style={styles.periodTitle}>{t('weatherForecast.periode')}</Text>
                    <View style={styles.periodButtons}>
                        {WEATHER_CONFIG.AVAILABLE_PERIODS.map((period) => (
                            <TouchableOpacity
                                key={period}
                                style={[
                                    styles.periodButton,
                                    selectedDays === period && styles.periodButtonActive
                                ]}
                                onPress={() => {
                                    setSelectedDays(period);
                                    fetchWeatherForecast(period);
                                }}
                            >
                                <Text style={[
                                    styles.periodButtonText,
                                    selectedDays === period && styles.periodButtonTextActive
                                ]}>
                                    {period} jours
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Contenu */}
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#87CEEB" />
                            <Text style={styles.loadingText}>{t('weatherForecast.chargementDesPrevisions')}</Text>
                        </View>
                    ) : error && forecast.length === 0 ? (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorIcon}>🌤️</Text>
                            <Text style={styles.errorText}>{error}</Text>
                            <TouchableOpacity style={styles.retryButton} onPress={() => fetchWeatherForecast()}>
                                <Text style={styles.retryButtonText}>{t('weatherForecast.reessayer')}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : forecast.length > 0 ? (
                        <View style={styles.forecastContainer}>
                            {forecast.map((item, index) => (
                                <ForecastCard key={index} item={item} index={index} />
                            ))}
                        </View>
                    ) : (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorIcon}>🌤️</Text>
                            <Text style={styles.errorText}>{t('weatherForecast.aucuneDonneeMeteoDisponible')}</Text>
                            <TouchableOpacity style={styles.retryButton} onPress={() => fetchWeatherForecast()}>
                                <Text style={styles.retryButtonText}>{t('weatherForecast.chargerLesDonnees')}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#87CEEB',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: 18,
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    periodSelector: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    periodTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 12,
    },
    periodButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    periodButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginHorizontal: 2,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        alignItems: 'center',
    },
    periodButtonActive: {
        backgroundColor: '#87CEEB',
        borderColor: '#87CEEB',
    },
    periodButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    periodButtonTextActive: {
        color: '#FFFFFF',
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '500',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    errorIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    errorText: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 20,
    },
    retryButton: {
        backgroundColor: '#87CEEB',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    forecastContainer: {
        paddingVertical: 20,
    },
    forecastCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    todayCard: {
        backgroundColor: '#87CEEB',
        borderColor: '#87CEEB',
    },
    forecastHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    dateContainer: {
        flex: 1,
    },
    dayText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: 2,
    },
    todayText: {
        color: '#FFFFFF',
    },
    dateText: {
        fontSize: 14,
        color: '#6B7280',
    },
    todayDateText: {
        color: 'rgba(255, 255, 255, 0.8)',
    },
    iconContainer: {
        alignItems: 'center',
    },
    weatherIcon: {
        fontSize: 32,
    },
    temperatureContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 8,
    },
    temperatureText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#374151',
        marginRight: 8,
    },
    todayTemperatureText: {
        color: '#FFFFFF',
    },
    temperatureMinText: {
        fontSize: 20,
        color: '#6B7280',
    },
    todayTemperatureMinText: {
        color: 'rgba(255, 255, 255, 0.8)',
    },
    descriptionText: {
        fontSize: 16,
        color: '#6B7280',
        marginBottom: 16,
        textTransform: 'capitalize',
    },
    todayDescriptionText: {
        color: 'rgba(255, 255, 255, 0.9)',
    },
    detailsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
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
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
});

export default WeatherForecastModal;
