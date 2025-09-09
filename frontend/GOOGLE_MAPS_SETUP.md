# Configuration Google Maps API

## Problème actuel
Les warnings Google Maps indiquent que l'API n'est pas configurée correctement.

## Solution

### 1. Créer un fichier `.env` dans le dossier `frontend/`

```bash
# Dans le dossier frontend/
touch .env
```

### 2. Ajouter la configuration suivante dans `.env`

```env
# Configuration Google Maps API
VITE_APP_GOOGLE_MAPS_API_KEY=VOTRE_CLE_API_GOOGLE_MAPS

# Configuration Backend
VITE_APP_API_URL=http://localhost:3001

# Configuration Environnement
VITE_APP_ENV=development
```

### 3. Obtenir une clé API Google Maps

1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créer un nouveau projet ou sélectionner un projet existant
3. Activer l'API Google Maps JavaScript
4. Créer des identifiants (clé API)
5. Restreindre la clé API aux domaines autorisés

### 4. Remplacer `VOTRE_CLE_API_GOOGLE_MAPS` par votre vraie clé API

### 5. Redémarrer le serveur de développement

```bash
npm run dev
```

## Warnings corrigés

- ✅ Performance warning LoadScript corrigé en déplaçant `libraries` en dehors du composant
- ✅ Configuration API key pour résoudre les erreurs Google Maps
- ✅ Backend corrigé pour accepter les données base64 en format string

## Notes

- Le fichier `.env` ne doit pas être commité dans git
- La clé API doit être restreinte aux domaines de production
- En développement, `localhost` est autorisé par défaut 