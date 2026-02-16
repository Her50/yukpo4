# 🔑 Correction Mot de Passe Cloud SQL

**Date** : 2026-02-16  
**Erreur** : `password authentication failed for user "yukpo_user"`

---

## 🔍 Diagnostic

D'après les logs Cloud Run :
```
Configuration Cloud SQL: user=yukpo_user, db=yukpo_db, socket=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
password authentication failed for user "yukpo_user"
```

**Problème** :
- ✅ Le format `DATABASE_URL` est correct (Cloud SQL Unix socket détecté)
- ❌ Le mot de passe dans le secret GitHub `GCP_DATABASE_URL` est incorrect
- ❌ OU le mot de passe de l'utilisateur `yukpo_user` dans Cloud SQL n'est pas celui attendu

---

## ✅ Solutions

### Option 1 : Vérifier et Réinitialiser le Mot de Passe dans Cloud SQL

1. **Se connecter à Cloud SQL** :
   ```bash
   gcloud sql connect yukpo-postgres --user=yukpo_user --database=yukpo_db --project=yukpo-project
   ```

2. **OU réinitialiser le mot de passe** :
   ```bash
   gcloud sql users set-password yukpo_user \
     --instance=yukpo-postgres \
     --password="NOUVEAU_MOT_DE_PASSE" \
     --project=yukpo-project
   ```

3. **Mettre à jour le secret GitHub** avec le nouveau mot de passe :
   ```
   postgresql://yukpo_user:NOUVEAU_MOT_DE_PASSE@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
   ```

### Option 2 : Vérifier le Mot de Passe Actuel

Si vous connaissez le mot de passe actuel, vérifiez qu'il est bien dans le secret GitHub :

1. **Aller sur** : https://github.com/Her50/yukpo4/settings/secrets/actions
2. **Vérifier** le secret `GCP_DATABASE_URL`
3. **S'assurer** que le mot de passe dans l'URL correspond à celui dans Cloud SQL

### Option 3 : Utiliser un Nouveau Mot de Passe

1. **Générer un nouveau mot de passe sécurisé** :
   ```bash
   openssl rand -base64 32
   ```

2. **Mettre à jour dans Cloud SQL** :
   ```bash
   gcloud sql users set-password yukpo_user \
     --instance=yukpo-postgres \
     --password="NOUVEAU_MOT_DE_PASSE" \
     --project=yukpo-project
   ```

3. **Mettre à jour le secret GitHub** :
   - Aller sur : https://github.com/Her50/yukpo4/settings/secrets/actions
   - Cliquer sur `GCP_DATABASE_URL`
   - Mettre à jour avec :
     ```
     postgresql://yukpo_user:NOUVEAU_MOT_DE_PASSE@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
     ```

---

## 🔍 Vérification

### Vérifier le Mot de Passe dans Cloud SQL

```bash
# Lister les utilisateurs
gcloud sql users list --instance=yukpo-postgres --project=yukpo-project

# Tester la connexion
gcloud sql connect yukpo-postgres --user=yukpo_user --database=yukpo_db --project=yukpo-project
```

### Vérifier le Format DATABASE_URL

```powershell
.\scripts\verifier-format-database-url.ps1 -DatabaseUrl "postgresql://yukpo_user:VOTRE_MOT_DE_PASSE@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres"
```

---

## 📝 Notes

- **Mot de passe actuel supposé** : `MTeInD(Vw)b$C3Np479P` (d'après `CREER_TOKEN_GITHUB.md`)
- **Utilisateur** : `yukpo_user`
- **Database** : `yukpo_db`
- **Instance** : `yukpo-postgres`
- **Connection name** : `yukpo-project:europe-west1:yukpo-postgres`

**Important** : Si le mot de passe contient des caractères spéciaux (`$`, `(`, `)`, etc.), ils doivent être correctement échappés dans l'URL ou le secret GitHub.

---

## 🚀 Après Correction

Une fois le mot de passe corrigé :

1. ✅ Le secret GitHub `GCP_DATABASE_URL` sera mis à jour
2. ✅ Le prochain déploiement Cloud Run utilisera le bon mot de passe
3. ✅ La connexion à Cloud SQL devrait réussir
4. ✅ Le conteneur devrait démarrer correctement

---

## 🔗 Liens Utiles

- **Secrets GitHub** : https://github.com/Her50/yukpo4/settings/secrets/actions
- **Cloud SQL Console** : https://console.cloud.google.com/sql/instances/yukpo-postgres?project=yukpo-project
- **Cloud Run Logs** : https://console.cloud.google.com/logs?project=yukpo-project

