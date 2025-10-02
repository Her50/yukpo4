// Script de test avec de vrais identifiants
const axios = require('axios');

const API_BASE_URL = 'https://yukpomnang.onrender.com';

async function testRealLogin() {
    console.log('🔍 Test de connexion avec de vrais identifiants...');

    try {
        // Test 1: Health check
        console.log('\n1. Test Health Check...');
        const healthResponse = await axios.get(`${API_BASE_URL}/api/health`);
        console.log('✅ Health Check:', healthResponse.data);

        // Test 2: Test de connexion avec des identifiants réels
        console.log('\n2. Test de connexion...');
        console.log('Entrez vos identifiants :');

        // Simuler des identifiants (remplacez par les vôtres)
        const testCredentials = {
            email: 'test@example.com', // Remplacez par votre email
            password: 'password123'    // Remplacez par votre mot de passe
        };

        console.log('Tentative avec:', testCredentials.email);

        const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, testCredentials);
        console.log('✅ Login Response:', loginResponse.data);

        if (loginResponse.data.token) {
            console.log('🎉 Token reçu ! Connexion réussie');
            console.log('Token:', loginResponse.data.token.substring(0, 50) + '...');
        }

    } catch (error) {
        console.error('❌ Erreur:', error.response?.data || error.message);

        if (error.response?.status === 401) {
            console.log('ℹ️  Erreur 401: Credentials invalides');
            console.log('💡 Vérifiez vos identifiants dans le script');
        } else if (error.response?.status === 404) {
            console.log('ℹ️  Erreur 404: Endpoint non trouvé');
            console.log('💡 Vérifiez l\'URL de l\'API');
        }
    }
}

testRealLogin();
