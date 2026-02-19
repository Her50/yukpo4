# 🔍 Analyse du Problème de Connexion Mobile

## 📋 Problème Identifié

**Symptôme** : Vous ne pouvez pas accéder au homescreen après avoir entré vos identifiants de connexion.

**Cause racine** : Le backend Cloud Run ne peut pas démarrer car il ne peut pas se connecter à Cloud SQL.

---

## 🔴 Erreurs dans les Logs (downloaded-logs-20260216-030619.json)

### 1. Erreur de Login (Ligne 3-36)

```
POST /api/auth/login
Status: 503 (Service Unavailable)
Message: "The request failed because the instance failed the readiness check."
```

**Explication** :
- Votre application mobile essaie de se connecter à `/api/auth/login`
- Mais le backend Cloud Run retourne **503** car l'instance ne peut pas démarrer
- La connexion échoue, donc vous ne pouvez pas accéder au homescreen

### 2. Erreur d'Authentification PostgreSQL (Lignes 101-143)

```
FATAL: password authentication failed for user "yukpo_user"
```

**Explication** :
- Le backend essaie de se connecter à Cloud SQL avec l'utilisateur `yukpo_user`
- Mais le mot de passe dans `DATABASE_URL` est incorrect
- **Cause** : Nous avons changé le mot de passe lors de l'application de la migration, mais Cloud Run utilise encore l'ancien mot de passe

### 3. Échec de Démarrage Cloud Run (Lignes 145-185)

```
Default STARTUP TCP probe failed
The instance was not started
```

**Explication** :
- Cloud Run essaie de démarrer l'application
- Mais le healthcheck échoue car l'application ne peut pas se connecter à la DB
- L'instance ne démarre jamais, donc toutes les requêtes retournent 503/500

---

## ✅ Solution

Le problème est que **le mot de passe de la base de données a été changé** lors de l'application de la migration, mais **Cloud Run utilise encore l'ancien mot de passe** dans `DATABASE_URL`.

### Solution 1: Mettre à Jour DATABASE_URL dans Cloud Run (RECOMMANDÉ)

#### Option A: Via GitHub Secrets (Recommandé)

1. **Récupérer le nouveau mot de passe** :
   - Le mot de passe temporaire généré lors de la migration a été utilisé
   - Vous devez définir un nouveau mot de passe permanent

2. **Définir un nouveau mot de passe permanent** :
   ```powershell
   # Définir un nouveau mot de passe permanent
   $newPassword = "VOTRE_NOUVEAU_MOT_DE_PASSE_SECURISE"
   gcloud sql users set-password yukpo_user --instance=yukpo-postgres --password=$newPassword --project=yukpo-project
   ```

3. **Mettre à jour le secret GitHub** :
   - Aller sur : https://github.com/Her50/yukpo4/settings/secrets/actions
   - Trouver le secret : `GCP_DATABASE_URL`
   - Mettre à jour avec :
     ```
     postgresql://yukpo_user:VOTRE_NOUVEAU_MOT_DE_PASSE@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
     ```

4. **Redéployer Cloud Run** :
   - Redéclencher le workflow GitHub Actions
   - OU mettre à jour manuellement Cloud Run

#### Option B: Mettre à Jour Directement Cloud Run

```powershell
# Définir un nouveau mot de passe
$newPassword = "VOTRE_NOUVEAU_MOT_DE_PASSE_SECURISE"
gcloud sql users set-password yukpo_user --instance=yukpo-postgres --password=$newPassword --project=yukpo-project

# Mettre à jour Cloud Run
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --update-env-vars="DATABASE_URL=postgresql://yukpo_user:$newPassword@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres" \
  --project=yukpo-project
```

---

## 🔍 Vérification Post-Correction

### 1. Vérifier que Cloud Run Démarre

```powershell
# Vérifier les logs récents
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" \
  --limit=20 \
  --project=yukpo-project \
  --format=json
```

Vous devriez voir :
- ✅ Pas d'erreurs "password authentication failed"
- ✅ Pas d'erreurs "instance could not start"
- ✅ Des requêtes 200 OK pour `/api/auth/login`

### 2. Tester la Connexion

1. **Ouvrir l'application mobile**
2. **Entrer vos identifiants**
3. **Vérifier que vous accédez au homescreen**

---

## 📝 Checklist de Résolution

- [ ] Définir un nouveau mot de passe permanent pour `yukpo_user`
- [ ] Mettre à jour `DATABASE_URL` dans Cloud Run (via GitHub Secrets ou directement)
- [ ] Redémarrer le service Cloud Run
- [ ] Vérifier que l'application démarre correctement
- [ ] Tester la connexion depuis l'application mobile
- [ ] Vérifier que vous accédez au homescreen après connexion

---

## 🚨 Actions Immédiates

1. **URGENT** : Corriger le mot de passe dans `DATABASE_URL`
   - Le backend ne peut pas démarrer sans connexion à la DB
   - Toutes les requêtes de login échouent avec 503

2. **IMPORTANT** : Redémarrer Cloud Run après correction
   - Pour que les nouvelles variables d'environnement soient prises en compte

3. **VÉRIFICATION** : Tester la connexion
   - Vérifier que vous pouvez vous connecter
   - Vérifier que vous accédez au homescreen

---

## 📚 Références

- **Logs analysés** : `downloaded-logs-20260216-030619.json`
- **Script de migration** : `scripts/apply_migration_fix_names_auto.ps1`
- **Documentation Cloud Run** : https://cloud.google.com/run/docs
- **Documentation Cloud SQL** : https://cloud.google.com/sql/docs/postgres


