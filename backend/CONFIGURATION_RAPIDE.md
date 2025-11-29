# ⚡ Configuration Rapide - Variables d'Environnement

## 🔴 MINIMUM VITAL (3 variables)

Ces 3 variables sont **absolument nécessaires** pour que l'application démarre:

```bash
# 1. Base de données PostgreSQL
DATABASE_URL=postgresql://user:password@host:port/database

# 2. Secret JWT (générer avec: openssl rand -hex 32)
JWT_SECRET=votre_secret_aleatoire_tres_long_minimum_64_caracteres

# 3. Origines CORS autorisées
ALLOWED_ORIGINS=https://yukpomnang.com,https://app.yukpomnang.com
```

---

## 🟠 FORTEMENT RECOMMANDÉES (5 variables)

Sans ces variables, certaines fonctionnalités ne fonctionneront pas:

```bash
# 4. Redis (pour rate limiting et anti-brute-force)
REDIS_URL=redis://localhost:6379/0

# 5. MongoDB (pour l'historique)
MONGODB_URL=mongodb://localhost:27017/yukpomnang

# 6. OpenAI (pour les fonctionnalités IA)
OPENAI_API_KEY=sk-proj-votre-cle-ici

# 7. Google Maps (pour la géolocalisation)
GOOGLE_MAPS_API_KEY=votre-cle-google-maps

# 8. Environnement
ENVIRONMENT=production
```

---

## 📋 Liste Complète

### Obligatoires (2)
- ✅ `DATABASE_URL` - PostgreSQL
- ✅ `JWT_SECRET` - Secret JWT (générer aléatoirement)

### Fortement Recommandées (3)
- ⭐ `REDIS_URL` - Cache et rate limiting
- ⭐ `MONGODB_URL` - Historique
- ⭐ `ALLOWED_ORIGINS` - Sécurité CORS

### IA (Au moins 1 requise)
- ⭐ `OPENAI_API_KEY` - Recommandé
- `MISTRAL_API_KEY` - Fallback
- `GEMINI_API_KEY` - Fallback
- `ANTHROPIC_API_KEY` - Fallback

### OAuth (Optionnel - Si utilisé)
- `GOOGLE_CLIENT_ID`
- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`

### Services Google (Optionnel)
- ⭐ `GOOGLE_MAPS_API_KEY` - Recommandé
- `GOOGLE_TRANSLATE_API_KEY`

### Configuration (Optionnel)
- `ENVIRONMENT` - production/development
- `RUST_LOG` - info/debug/warn
- `LOG_FORMAT` - plain/json
- Et 30+ autres (voir VARIABLES_ENVIRONNEMENT.md)

---

## 🔑 Comment Obtenir les Clés

### 1. DATABASE_URL
- **Render.com:** Service PostgreSQL → Info → Internal Database URL
- **Neon.tech:** Dashboard → Connection String
- **Supabase:** Settings → Database → Connection String

### 2. JWT_SECRET
Générer une clé aléatoire:
```bash
# Linux/Mac
openssl rand -hex 32

# Windows PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | % {[char]$_})
```

### 3. OPENAI_API_KEY
1. Aller sur https://platform.openai.com/api-keys
2. Créer un compte
3. Créer une nouvelle clé API
4. Copier la clé (commence par `sk-proj-`)

### 4. GOOGLE_MAPS_API_KEY
1. Aller sur https://console.cloud.google.com/apis/credentials
2. Créer un projet
3. Créer une clé API
4. Activer: Maps JavaScript API, Geocoding API

### 5. REDIS_URL
- **Upstash:** Dashboard → Redis → Connection String
- **Render.com:** Service Redis → Internal Redis URL
- **Local:** `redis://localhost:6379/0`

---

## 📝 Fichier .env Exemple

Créez un fichier `.env` à la racine du dossier `backend/` avec:

```bash
# Obligatoires
DATABASE_URL=postgresql://user:password@host:5432/yukpomnang
JWT_SECRET=changez-moi-avec-une-cle-aleatoire-tres-longue
ALLOWED_ORIGINS=https://yukpomnang.com,https://app.yukpomnang.com

# Recommandées
REDIS_URL=redis://localhost:6379/0
MONGODB_URL=mongodb://localhost:27017/yukpomnang
OPENAI_API_KEY=sk-proj-votre-cle
GOOGLE_MAPS_API_KEY=votre-cle
ENVIRONMENT=production
RUST_LOG=info
```

---

## 🚀 Sur Render.com

### Étapes:

1. **Aller sur:** https://dashboard.render.com
2. **Sélectionner** votre service backend
3. **Onglet:** Environment
4. **Ajouter** chaque variable une par une:

```
Nom: DATABASE_URL
Valeur: postgresql://...

Nom: JWT_SECRET
Valeur: [générer avec openssl rand -hex 32]

Nom: ALLOWED_ORIGINS
Valeur: https://yukpomnang.com,https://app.yukpomnang.com

... etc
```

### ⚠️ Important:
- Cocher "Secret" pour les clés API (JWT_SECRET, OPENAI_API_KEY, etc.)
- Cliquer sur "Save Changes" après chaque variable
- Redémarrer le service après avoir ajouté toutes les variables

---

## ✅ Vérification

### Test local
```bash
# Vérifier que les variables sont chargées
cargo run

# Si JWT_SECRET manque, vous verrez:
# ❌ JWT_SECRET manquant - Configuration invalide
```

### Test sur Render
- Vérifier les logs du service
- L'application doit démarrer sans erreur
- Les routes `/api/test/ping` doivent répondre

---

## 📚 Documentation Complète

Pour plus de détails, voir:
- `VARIABLES_ENVIRONNEMENT.md` - Guide complet de toutes les variables
- `README_SECURITE.md` - Guide de sécurité

---

**Besoin d'aide?** Vérifiez les logs avec `RUST_LOG=debug cargo run`

