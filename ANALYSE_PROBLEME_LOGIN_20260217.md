# 🔍 Analyse du Problème de Connexion - 17 Février 2026

## 📊 Résumé Exécutif

**Problème identifié** : Échec d'authentification PostgreSQL empêchant l'application de démarrer correctement.

**Fichier analysé** : `downloaded-logs-20260217-171552.json`

**Période** : 16:00:57 UTC - 16:15:31 UTC (environ 15 minutes)

**Nombre d'erreurs** : **116 erreurs d'authentification** détectées

---

## ❌ Problème Principal

### Erreur Répétée

```
FATAL: password authentication failed for user "yukpo_user"
```

Cette erreur apparaît **116 fois** dans les logs analysés, indiquant que l'application backend essaie continuellement de se connecter à la base de données PostgreSQL mais échoue à chaque tentative.

### Détails Techniques

- **Base de données** : `yukpo_db`
- **Utilisateur** : `yukpo_user`
- **Instance Cloud SQL** : `yukpo-project:yukpo-postgres`
- **Région** : `europe-west1`
- **Méthode d'authentification** : MD5 (selon `pg_hba.conf line 37`)

---

## 🔗 Chaîne de Causation

```
1. Application backend démarre (Cloud Run)
   ↓
2. Application essaie de se connecter à PostgreSQL
   ↓
3. Authentification échoue (mot de passe incorrect)
   ↓
4. Application ne peut pas initialiser le pool de connexions
   ↓
5. Application ne peut pas démarrer correctement
   ↓
6. Endpoints API ne répondent pas / retournent des erreurs
   ↓
7. Utilisateur ne peut pas se connecter à l'application
```

---

## 🎯 Causes Possibles

### 1. **Mot de passe incorrect dans les secrets Cloud Run** ⚠️
   - Le secret `DATABASE_URL` ou le mot de passe dans Cloud Run ne correspond pas au mot de passe réel de l'utilisateur PostgreSQL
   - Le mot de passe a peut-être été modifié dans Cloud SQL mais pas mis à jour dans Cloud Run

### 2. **Format d'URL incorrect** ⚠️
   - L'URL de connexion (`DATABASE_URL`) pourrait être mal formatée
   - Caractères spéciaux dans le mot de passe non échappés correctement
   - Problème avec l'URL encoding

### 3. **Problème de synchronisation des secrets** ⚠️
   - Le secret GitHub Actions n'a pas été mis à jour après un changement de mot de passe
   - Le secret Cloud Run n'a pas été mis à jour

### 4. **Problème avec le socket Unix Cloud SQL** ⚠️
   - Si l'application utilise le socket Unix pour Cloud SQL, il pourrait y avoir un problème de parsing de l'URL
   - Le code récent dans `main.rs` gère le format Cloud SQL, mais il pourrait y avoir un problème

---

## ✅ Solutions Recommandées

### Solution 1 : Vérifier et Mettre à Jour le Mot de Passe (PRIORITÉ HAUTE)

1. **Vérifier le mot de passe actuel dans Cloud SQL** :
   ```bash
   # Se connecter à Cloud SQL et vérifier l'utilisateur
   gcloud sql users list --instance=yukpo-postgres
   ```

2. **Récupérer le secret DATABASE_URL actuel dans Cloud Run** :
   ```bash
   gcloud run services describe yukpo-backend \
     --region=europe-west1 \
     --format="value(spec.template.spec.containers[0].env)"
   ```

3. **Comparer les mots de passe** :
   - Extraire le mot de passe de l'URL DATABASE_URL
   - Vérifier qu'il correspond au mot de passe dans Cloud SQL

4. **Mettre à jour le secret si nécessaire** :
   ```bash
   # Si le mot de passe a changé, mettre à jour le secret
   gcloud secrets versions add DATABASE_URL --data-file=- <<EOF
   postgresql://yukpo_user:NOUVEAU_MOT_DE_PASSE@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
   EOF
   ```

### Solution 2 : Réinitialiser le Mot de Passe PostgreSQL

Si le mot de passe est perdu ou inconnu :

```bash
# Réinitialiser le mot de passe de l'utilisateur
gcloud sql users set-password yukpo_user \
  --instance=yukpo-postgres \
  --password=NOUVEAU_MOT_DE_PASSE_SECURISE

# Mettre à jour le secret Cloud Run
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --update-secrets=DATABASE_URL=DATABASE_URL:latest
```

### Solution 3 : Vérifier le Format de l'URL DATABASE_URL

L'URL doit être au format Cloud SQL Unix socket :

```
postgresql://yukpo_user:MOT_DE_PASSE@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Points à vérifier** :
- ✅ Le mot de passe ne contient pas de caractères spéciaux non échappés (`@`, `:`, `/`, `?`, `#`, `%`)
- ✅ Si le mot de passe contient des caractères spéciaux, ils doivent être URL-encodés :
  - `@` → `%40`
  - `:` → `%3A`
  - `/` → `%2F`
  - `?` → `%3F`
  - `#` → `%23`
  - `%` → `%25`

### Solution 4 : Vérifier les Logs de l'Application Backend

Les logs analysés sont uniquement les logs PostgreSQL. Il faut aussi vérifier les logs Cloud Run de l'application :

```bash
# Voir les logs Cloud Run récents
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" \
  --limit=50 \
  --format=json \
  --freshness=1h
```

Ces logs devraient montrer :
- Les erreurs de connexion côté application
- Les messages de diagnostic du code Rust
- Les tentatives de reconnexion

---

## 🔧 Actions Immédiates

1. **Vérifier le secret DATABASE_URL dans Cloud Run**
2. **Comparer avec le mot de passe réel dans Cloud SQL**
3. **Mettre à jour le secret si nécessaire**
4. **Redémarrer le service Cloud Run** pour appliquer les changements
5. **Vérifier que l'application démarre correctement**

---

## 📝 Notes Techniques

### Format d'URL Cloud SQL

Le code dans `backend/src/main.rs` gère deux formats :

1. **Format Cloud SQL Unix socket** (pour Cloud Run) :
   ```
   postgresql://user:pass@/db?host=/cloudsql/PROJECT:REGION:INSTANCE
   ```

2. **Format standard** (pour autres environnements) :
   ```
   postgresql://user:pass@host:port/db
   ```

Le code détecte automatiquement le format et utilise `PgConnectOptions` pour le format Cloud SQL.

### Authentification MD5

Les logs montrent que PostgreSQL utilise l'authentification MD5 :
```
Connection matched pg_hba.conf line 37: "local   all           all                                     md5"
```

Cela signifie que le mot de passe est hashé avec MD5, mais le mot de passe en clair doit être correct dans l'URL de connexion.

---

## 🚨 Impact

- **Application backend** : Ne peut pas démarrer correctement
- **API endpoints** : Ne répondent pas ou retournent des erreurs 500/503
- **Application mobile** : Ne peut pas se connecter au backend
- **Utilisateurs** : Ne peuvent pas se connecter à l'application

---

## 📅 Prochaines Étapes

1. ✅ Analyser les logs (FAIT)
2. ⏳ Vérifier le secret DATABASE_URL dans Cloud Run
3. ⏳ Comparer avec le mot de passe dans Cloud SQL
4. ⏳ Mettre à jour le secret si nécessaire
5. ⏳ Redémarrer le service Cloud Run
6. ⏳ Vérifier que l'application démarre correctement
7. ⏳ Tester la connexion utilisateur

---

**Date d'analyse** : 17 Février 2026  
**Analysé par** : Assistant IA  
**Fichier source** : `downloaded-logs-20260217-171552.json`


