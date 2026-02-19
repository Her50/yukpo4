# 🔑 Mise à Jour du Secret GitHub GCP_DATABASE_URL

**Date** : 2026-02-16  
**Secret** : `GCP_DATABASE_URL`  
**Repository** : `Her50/yukpo4`

---

## ✅ Format Vérifié

Le format de la `DATABASE_URL a été vérifié et est correct :

```
postgresql://yukpo_user:MTeInD(Vw)b$C3Np479P@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Vérifications** :
- ✅ Format Cloud SQL Unix socket détecté
- ✅ Connection name correct : `yukpo-project:europe-west1:yukpo-postgres`
- ✅ User : `yukpo_user`
- ✅ Password : présent
- ✅ Database : `yukpo_db`

---

## 📋 Instructions pour Mise à Jour Manuelle

### Option 1 : Interface Web GitHub (Recommandé)

1. **Ouvrir le lien** :
   👉 https://github.com/Her50/yukpo4/settings/secrets/actions

2. **Trouver ou créer le secret** :
   - Si `GCP_DATABASE_URL` existe déjà, cliquez dessus
   - Sinon, cliquez sur "New repository secret"

3. **Nom du secret** :
   ```
   GCP_DATABASE_URL
   ```

4. **Valeur du secret** (copier-coller exactement) :
   ```
   postgresql://yukpo_user:MTeInD(Vw)b$C3Np479P@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
   ```

5. **Cliquer sur** :
   - "Update secret" (si existe déjà)
   - "Add secret" (si nouveau)

---

### Option 2 : GitHub CLI (Si installé)

```powershell
# Authentification
gh auth login --with-token <<< "[REDACTED]"

# Mettre à jour le secret
gh secret set GCP_DATABASE_URL \
  --repo Her50/yukpo4 \
  --body "postgresql://yukpo_user:MTeInD(Vw)b\$C3Np479P@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres"
```

**Note** : Échapper le `$` avec `\$` dans PowerShell.

---

## 🔍 Vérification

Après la mise à jour, vérifier que le secret est bien configuré :

1. Aller sur : https://github.com/Her50/yukpo4/settings/secrets/actions
2. Vérifier que `GCP_DATABASE_URL` est présent
3. Le prochain push déclenchera un nouveau déploiement Cloud Run

---

## 🚀 Après Mise à Jour

Une fois le secret mis à jour :

1. ✅ Le workflow GitHub Actions utilisera automatiquement la nouvelle valeur
2. ✅ Le prochain push déclenchera un nouveau déploiement
3. ✅ Le déploiement Cloud Run devrait réussir (plus d'erreur "empty host")

---

## 📝 Notes

- **Token GitHub fourni** : `[REDACTED]`
- **Format** : Cloud SQL Unix socket (recommandé pour Cloud Run)
- **Connection name** : `yukpo-project:europe-west1:yukpo-postgres`
- **Database** : `yukpo_db` (362 migrations, 263 tables)

---

## 🔗 Liens Utiles

- **Secrets GitHub** : https://github.com/Her50/yukpo4/settings/secrets/actions
- **Actions GitHub** : https://github.com/Her50/yukpo4/actions
- **Cloud Run Console** : https://console.cloud.google.com/run?project=yukpo-project


