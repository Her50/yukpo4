# Correction SQLX_OFFLINE dans Render

## Problème

La variable d'environnement `SQLX_OFFLINE` est définie à `"false"` dans Render, alors qu'elle devrait être `"true"` pour permettre la compilation sans connexion à la base de données.

## Solution

### Méthode 1: Via l'interface Render (Recommandé)

1. Allez sur votre dashboard Render
2. Sélectionnez votre service `yukpomnang-backend`
3. Allez dans **Settings** > **Environment Variables**
4. Cherchez la variable `SQLX_OFFLINE`
5. Si elle existe et vaut `"false"`, changez-la en `"true"`
6. Si elle n'existe pas, ajoutez-la avec la valeur `"true"`
7. Sauvegardez et redéployez

### Méthode 2: Via render.yaml

Le fichier `render.yaml` définit déjà `SQLX_OFFLINE="true"` (ligne 63-64), mais si Render a une variable d'environnement définie dans l'interface, elle peut override le fichier.

**Important**: Les variables définies dans l'interface Render ont priorité sur celles définies dans `render.yaml`.

### Vérification

Après avoir changé la variable, vérifiez que la compilation fonctionne :

```bash
# Dans Render, regardez les logs de build
# Vous devriez voir :
# "Mode SQLx: OFFLINE (pas de vérification DB à la compilation)"
```

### Pourquoi SQLX_OFFLINE doit être "true"

- **Compilation plus rapide**: Pas besoin de se connecter à la DB pendant le build
- **Builds reproductibles**: Les métadonnées SQLx sont dans le cache `.sqlx/`
- **Pas de dépendance réseau**: Le build peut se faire sans accès à la DB
- **Sécurité**: Pas besoin d'exposer les credentials DB pendant le build

### Génération des métadonnées SQLx

Si vous modifiez des requêtes SQL, régénérez les métadonnées :

```bash
cd backend
export DATABASE_URL="postgresql://..."
cargo sqlx prepare -- --bin yukpomnang_backend
git add .sqlx/
git commit -m "Update SQLx metadata"
```

## Notes

- Le fichier `render.yaml` définit déjà `SQLX_OFFLINE="true"` dans le `buildCommand` (ligne 22) ET dans les `envVars` (ligne 63-64)
- Si la variable est toujours `"false"` dans Render, c'est qu'elle a été définie manuellement dans l'interface et override le fichier
- Supprimez la variable de l'interface Render pour utiliser celle du fichier, ou changez-la en `"true"`

