import { useEffect, useState } from 'react';
import { api } from '../services/api';

interface WeatherData {
    temperature: number;
    description: string;
    humidity: number;
    windSpeed: number;
    icon: string;
    city: string;
    country: string;
}

export const useWeather = (latitude?: number, longitude?: number) => {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchWeather = async (lat: number, lon: number) => {
        try {
            setLoading(true);
            setError(null);

            // API météo réelle - OpenWeatherMap
            const response = await api.get('/weather', {
                params: {
                    lat: lat,
                    lon: lon,
                    units: 'metric',
                    lang: 'fr'
                }
            });

            if (response.data) {
                const d: any = response.data;
                const weatherData: WeatherData = {
                    temperature: Math.round(d.main.temp),
                    description: d.weather[0].description,
                    humidity: d.main.humidity,
                    windSpeed: d.wind.speed,
                    icon: getWeatherIcon(d.weather[0].icon),
                    city: d.name,
                    country: d.sys.country
                };
                setWeather(weatherData);
            }
        } catch (err) {
            console.error('Weather API error:', err);
            setError('Impossible de récupérer les données météo');

            // Fallback avec données par défaut en cas d'erreur API
            const fallbackWeather: WeatherData = {
                temperature: 20,
                description: 'Données météo non disponibles',
                humidity: 50,
                windSpeed: 10,
                icon: '🌤️',
                city: 'Position actuelle',
                country: ''
            };
            setWeather(fallbackWeather);
        } finally {
            setLoading(false);
        }
    };

    const getWeatherIcon = (iconCode: string): string => {
        const iconMap: { [key: string]: string } = {
            '01d': '☀️', '01n': '🌙',
            '02d': '⛅', '02n': '☁️',
            '03d': '☁️', '03n': '☁️',
            '04d': '☁️', '04n': '☁️',
            '09d': '🌧️', '09n': '🌧️',
            '10d': '🌦️', '10n': '🌧️',
            '11d': '⛈️', '11n': '⛈️',
            '13d': '❄️', '13n': '❄️',
            '50d': '🌫️', '50n': '🌫️'
        };
        return iconMap[iconCode] || '🌤️';
    };

    useEffect(() => {
        if (latitude && longitude) {
            fetchWeather(latitude, longitude);
        }
    }, [latitude, longitude]);

    return {
        weather,
        loading,
        error,
        fetchWeather
    };
};
