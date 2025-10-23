# 🔧 CORRECTION BASE DE DONNÉES RENDER - YUKPOMNANG

## 🚨 PROBLÈME ACTUEL
Erreur 500 lors de la création de service : 
```
Postgres protocol error: Postgres returned a non-UTF-8 string
```

## ✅ SOLUTION

### 1. Obtenir l'URL de la base de données Render

1. Allez sur https://dashboard.render.com
2. Cliquez sur votre service **PostgreSQL**
3. Dans l'onglet **"Info"**, copiez l'URL :
   - **Internal Database URL** (recommandé) : `postgresql://...render.com:5432/...`
   - OU **External Database URL** (si backend hors Render)

### 2. Format de l'URL avec UTF-8

Votre `DATABASE_URL` doit avoir ce format :

```bash
postgresql://user:password@host.render.com:5432/database_name?client_encoding=UTF8&sslmode=require
```

**Paramètres importants :**
- `client_encoding=UTF8` : Force l'encodage UTF-8 ✅
- `sslmode=require` : Active SSL (requis par Render) ✅

### 3. Configurer sur Render

#### Option A : Variables d'environnement Render (RECOMMANDÉ)

1. Dashboard Render → **Votre Service Backend**
2. Onglet **"Environment"**
3. Cliquez **"Add Environment Variable"**
4. Ajoutez :

```
DATABASE_URL = postgresql://[USER]:[PASSWORD]@[HOST].render.com:5432/[DB]?client_encoding=UTF8&sslmode=require
HOST = 0.0.0.0
PORT = 8001
ENVIRONMENT = production
RUST_LOG = info
JWT_SECRET = [VOTRE_SECRET]
YUKPO_API_KEY = yukpo_backend_key_2024
PINECONE_API_KEY = [VOTRE_CLE]
PINECONE_INDEX = service-embeddings
OPENAI_API_KEY = [VOTRE_CLE]
```

#### Option B : Fichier .env (LOCAL uniquement)

Modifiez `backend/.env` :

```bash
DATABASE_URL=postgresql://user:password@host.render.com:5432/database?client_encoding=UTF8&sslmode=require
HOST=0.0.0.0
PORT=8001
ENVIRONMENT=production
```

### 4. Vérifier la connexion PostgreSQL

Testez la connexion avec ce script :

```powershell
cd backend
cargo sqlx database create
cargo sqlx migrate run
```

Si erreur, vérifiez :
- ✅ URL copiée correctement
- ✅ Paramètres `client_encoding=UTF8&sslmode=require` ajoutés
- ✅ Base de données créée sur Render
- ✅ IP autorisée (si External URL)

### 5. Redéployer sur Render

Après avoir configuré les variables d'environnement :

1. **Manual Deploy** : Dashboard → Service → "Manual Deploy"
2. Attendez le déploiement (2-5 min)
3. Vérifiez les logs : Dashboard → Service → "Logs"

### 6. Tester la création de service

Depuis le mobile :
1. Connectez-vous
2. Créez un service/produit
3. Si erreur 500 persiste, vérifiez les logs Render

## 🔍 DIAGNOSTIC

### Vérifier les logs Render :

```bash
# Dans Dashboard Render → Service → Logs
# Cherchez :
"Postgres protocol error"
"connection refused"
"authentication failed"
```

### Causes communes :

| Erreur | Cause | Solution |
|--------|-------|----------|
| `non-UTF-8 string` | Encodage manquant | Ajouter `client_encoding=UTF8` |
| `connection refused` | URL incorrecte | Vérifier l'URL Render |
| `authentication failed` | Mauvais credentials | Re-copier l'URL |
| `SSL required` | SSL manquant | Ajouter `sslmode=require` |

## ✅ CHECKLIST

- [ ] Base de données PostgreSQL créée sur Render
- [ ] URL de connexion copiée (Internal Database URL)
- [ ] Paramètres UTF-8 et SSL ajoutés à l'URL
- [ ] Variables d'environnement configurées sur Render
- [ ] Service backend redéployé
- [ ] Logs vérifiés (pas d'erreur PostgreSQL)
- [ ] Test création service depuis mobile

## 📞 SI LE PROBLÈME PERSISTE

Envoyez-moi :
1. Les logs Render (Dashboard → Service → Logs)
2. Le message d'erreur exact
3. Confirmation que l'URL contient `client_encoding=UTF8&sslmode=require`

---

**Date : 23 Octobre 2025**
**Problème : Erreur 500 création service**
**Cause : Connexion PostgreSQL mal configurée**
**Solution : URL avec UTF-8 + SSL sur Render**

