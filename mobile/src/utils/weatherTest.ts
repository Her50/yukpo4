// Script de test pour vérifier l'API météo
import { getWeatherApiKey } from '../config/weatherConfig';

export const testWeatherApi = async () => {
    console.log('=== TEST API MÉTÉO ===');

    try {
        // Test 1: Récupération de la clé API
        console.log('1. Test récupération clé API...');
        const apiKey = await getWeatherApiKey();
        console.log('Clé API récupérée:', apiKey ? 'Oui' : 'Non');
        console.log('Clé API valide:', apiKey && apiKey !== 'YOUR_OPENWEATHER_API_KEY' ? 'Oui' : 'Non');

        if (!apiKey || apiKey === 'YOUR_OPENWEATHER_API_KEY') {
            console.log('❌ Clé API non configurée ou invalide');
            return false;
        }

        // Test 2: Appel API météo actuelle
        console.log('2. Test API météo actuelle...');
        const testLocation = { lat: 3.848, lng: 11.502 }; // Yaoundé, Cameroun
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${testLocation.lat}&lon=${testLocation.lng}&appid=${apiKey}&units=metric&lang=fr`;

        const weatherResponse = await fetch(weatherUrl);
        console.log('Statut réponse météo:', weatherResponse.status);

        if (weatherResponse.ok) {
            const weatherData = await weatherResponse.json();
            console.log('✅ Données météo reçues:', {
                ville: weatherData.name,
                pays: weatherData.sys.country,
                température: weatherData.main.temp + '°C',
                description: weatherData.weather[0].description
            });
        } else {
            console.log('❌ Erreur API météo:', weatherResponse.status, weatherResponse.statusText);
            return false;
        }

        // Test 3: Appel API prévisions
        console.log('3. Test API prévisions...');
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${testLocation.lat}&lon=${testLocation.lng}&appid=${apiKey}&units=metric&lang=fr`;

        const forecastResponse = await fetch(forecastUrl);
        console.log('Statut réponse prévisions:', forecastResponse.status);

        if (forecastResponse.ok) {
            const forecastData = await forecastResponse.json();
            console.log('✅ Données prévisions reçues:', {
                nombrePrévisions: forecastData.list.length,
                ville: forecastData.city.name,
                pays: forecastData.city.country
            });
        } else {
            console.log('❌ Erreur API prévisions:', forecastResponse.status, forecastResponse.statusText);
            return false;
        }

        console.log('=== TEST RÉUSSI ===');
        return true;

    } catch (error) {
        console.error('❌ Erreur lors du test:', error);
        return false;
    }
};

// Fonction pour tester l'endpoint backend
export const testBackendWeatherEndpoint = async () => {
    console.log('=== TEST ENDPOINT BACKEND ===');

    try {
        const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
        const response = await fetch(`${backendUrl}/api/weather/config`);

        console.log('Statut endpoint backend:', response.status);

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Données backend reçues:', data);
            return true;
        } else {
            console.log('❌ Erreur endpoint backend:', response.status, response.statusText);
            return false;
        }
    } catch (error) {
        console.error('❌ Erreur endpoint backend:', error);
        return false;
    }
};








