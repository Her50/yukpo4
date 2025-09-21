# Guide de Déploiement Yukpomnang

## Architecture

- **Frontend**: Déployé sur Vercel (SPA React/TypeScript)
- **Backend**: Déployé sur Render (API Rust/Axum)
- **Base de données**: PostgreSQL avec pgvector sur Render

## URLs de Production

- Frontend: https://yukpomnang.vercel.app
- Backend API: https://yukpomnang.onrender.com
- Health Check: https://yukpomnang.onrender.com/healthz

## Configuration

### Frontend (Vercel)

Le fichier `vercel.json` configure:
- Build du frontend dans `frontend/dist`
- Rewrites pour rediriger `/api/*` vers le backend Render
- Headers CORS pour permettre les requêtes cross-origin
- Fallback vers `index.html` pour le routing SPA

### Backend (Render)

Le backend est configuré avec:
- CORS permettant toutes les origines
- JWT pour l'authentification
- Routes protégées nécessitant un token

## Déploiement

### Automatique (Script PowerShell)

```powershell
./deploy-vercel.ps1
```

### Manuel

1. **Frontend sur Vercel**:
   ```bash
   cd frontend
   npm install
   npm run build
   vercel --prod
   ```

2. **Backend sur Render**:
   - Push sur GitHub/GitLab
   - Render se déploie automatiquement

## Test de Connexion

Ouvrez `test-connection.html` dans un navigateur pour tester:
- Connexion au backend
- Health check
- Endpoints API
- Configuration CORS

## Endpoints API Principaux

### Publics
- `GET /healthz` - Health check
- `POST /auth/login` - Connexion
- `POST /auth/register` - Inscription

### Protégés (nécessitent JWT)
- `GET /services/filter` - Liste des services
- `GET /api/user/me` - Profil utilisateur
- `POST /services/create` - Créer un service

## Variables d'Environnement

### Frontend (.env.production)
```env
VITE_API_BASE_URL=https://yukpomnang.onrender.com
VITE_APP_ENV=production
VITE_APP_DEBUG=false
```

### Backend (sur Render)
```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
CORS_ORIGIN=*
```

## Dépannage

### Erreur CORS
- Vérifier que le backend inclut les headers CORS
- S'assurer que `vercel.json` configure les rewrites

### Erreur 404 sur /api
- Vérifier les routes dans `backend/src/routes/`
- S'assurer que les routes sont bien montées dans `lib.rs`

### Erreur 401 Unauthorized
- Vérifier que le token JWT est envoyé dans les headers
- S'assurer que le token n'est pas expiré

## Monitoring

- Frontend: Dashboard Vercel
- Backend: Dashboard Render
- Logs: Disponibles dans les dashboards respectifs 