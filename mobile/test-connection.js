// Script de test pour vérifier la connexion API
const axios = require('axios');

const API_BASE_URL = 'https://yukpomnang.onrender.com';

async function testConnection() {
    console.log('🔍 Test de connexion à l\'API...');

    try {
        // Test 1: Health check
        console.log('\n1. Test Health Check...');
        const healthResponse = await axios.get(`${API_BASE_URL}/health`);
        console.log('✅ Health Check:', healthResponse.data);

        // Test 2: Test de connexion avec des credentials de test
        console.log('\n2. Test de connexion...');
        const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
            email: 'test@example.com',
            password: 'password123'
        });
        console.log('✅ Login Response:', loginResponse.data);

    } catch (error) {
        console.error('❌ Erreur:', error.response?.data || error.message);

        if (error.response?.status === 401) {
            console.log('ℹ️  Erreur 401: Credentials invalides (normal pour un test)');
        }
    }
}

testConnection();
