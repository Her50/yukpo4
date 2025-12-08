# 🔧 Instructions pour corriger SQLX_OFFLINE dans Render

## 🚨 Problème actuel

Dans Render, la variable d'environnement `SQLX_OFFLINE` est définie à `"false"`, ce qui cause des erreurs de compilation car SQLx essaie de se connecter à la base de données pendant le build.

## ✅ Solution immédiate

### Étape 1: Aller dans le Dashboard Render

1. Ouvrez https://dashboard.render.com
2. Connectez-vous à votre compte
3. Sélectionnez le service **yukpomnang-backend**

### Étape 2: Modifier la variable d'environnement

1. Dans le menu de gauche, cliquez sur **"Environment"**
2. Cherchez la variable `SQLX_OFFLINE` dans la liste
3. **Deux options :**

   **Option A - Si la variable existe :**
   - Cliquez sur `SQLX_OFFLINE`
   - Changez la valeur de `false` à `true`
   - Cliquez sur "Save Changes"

   **Option B - Si la variable n'existe pas :**
   - Cliquez sur "Add Environment Variable"
   - Clé : `SQLX_OFFLINE`
   - Valeur : `true`
   - Cliquez sur "Save Changes"

### Étape 3: Redéployer

1. Cliquez sur "Manual Deploy" dans le menu supérieur
2. Sélectionnez "Deploy latest commit"
3. Attendez que le build se termine

### Étape 4: Vérifier

Dans les logs de build, vous devriez voir :
```
✅ SQLX_OFFLINE forcé à true dans buildCommand
Mode SQLx: OFFLINE (pas de vérification DB à la compilation)
```

## 🔍 Pourquoi cette correction est nécessaire

- **Avec SQLX_OFFLINE=false** : SQLx essaie de se connecter à la DB pendant la compilation, ce qui échoue car la DB n'est pas accessible au moment du build
- **Avec SQLX_OFFLINE=true** : SQLx utilise les métadonnées pré-générées dans `.sqlx/`, pas besoin de connexion DB

## 📋 Configuration actuelle

Le fichier `render.yaml` force déjà `SQLX_OFFLINE=true` dans le `buildCommand` (ligne 22), mais si une variable d'environnement est définie dans l'interface Render, elle peut override cette valeur.

**Solution recommandée :** Définir `SQLX_OFFLINE=true` dans l'interface Render pour garantir que la valeur est correcte.

## ⚠️ Note importante

Même après avoir corrigé `SQLX_OFFLINE`, si vous avez des requêtes `sqlx::query!()` sans métadonnées dans `.sqlx/`, la compilation peut échouer.

**Solution :** Régénérez les métadonnées SQLx :
```bash
cd backend
export DATABASE_URL="postgresql://..."
cargo sqlx prepare --workspace
git add .sqlx/
git commit -m "Update SQLx metadata"
git push
```

## ✅ Vérification finale

Après le redéploiement, vérifiez que :
- ✅ Le build réussit sans erreurs de connexion DB
- ✅ Les logs montrent "SQLX_OFFLINE forcé à true"
- ✅ L'application démarre correctement

