const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();

// Augmenter la limite de taille pour les requêtes
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'dist')));

// Configuration du proxy pour le backend
app.use('/api', createProxyMiddleware({
  target: 'http://127.0.0.1:5173',
  changeOrigin: true,
  timeout: 60000,
  onProxyReq: (proxyReq, req, res) => {
    console.log('Sending Request to Backend:', req.method, req.url);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log('Received Response from Backend:', proxyRes.statusCode, req.url);
  },
  onError: (err, req, res) => {
    console.log('Proxy Error:', err);
  }
}));

// Route par défaut pour SPA
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = 5173;
app.listen(PORT, () => {
  console.log(`🚀 Custom server running on http://localhost:${PORT}`);
  console.log(`📡 Proxying /api requests to http://127.0.0.1:5173`);
}); 