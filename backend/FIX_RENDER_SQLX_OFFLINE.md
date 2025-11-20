# 🔧 Correction SQLX_OFFLINE dans Render

## 🚨 Problème

Vous êtes actuellement à `SQLX_OFFLINE=false` dans Render, ce qui cause des erreurs de compilation car SQLx essaie de se connecter à la base de données pendant le build.

## ✅ Solution

### Option 1 : Via le Dashboard Render (RECOMMANDÉ - Plus rapide)

1. **Aller sur le Dashboard Render**
   - https://dashboard.render.com
   - Sélectionner votre service `yukpomnang-backend`

2. **Accéder aux Environment Variables**
   - Cliquer sur "Environment" dans le menu de gauche
   - Chercher la variable `SQLX_OFFLINE`

3. **Modifier la valeur**
   - Si elle existe et vaut `false`, la modifier en `true`
   - Si elle n'existe pas, l'ajouter avec la valeur `true`

4. **Redéployer**
   - Cliquer sur "Manual Deploy" → "Deploy latest commit"
   - Ou faire un commit vide pour déclencher un nouveau déploiement

### Option 2 : Via render.yaml (Déjà configuré)

Le fichier `render.yaml` contient déjà :
```yaml
envVars:
  - key: SQLX_OFFLINE
    value: true
```

**Mais** : Si une variable d'environnement existe dans le dashboard, elle **écrase** la valeur du `render.yaml`.

### Option 3 : Forcer dans build.sh (Garantie)

Le script `backend/build.sh` définit déjà `SQLX_OFFLINE=true` :
```bash
export SQLX_OFFLINE=true
cargo build --release
```

Cela devrait fonctionner, mais il est préférable de le définir aussi dans le dashboard.

## 🔍 Vérification

### 1. Vérifier dans les logs de build Render

Les logs doivent afficher :
```
Mode SQLx: OFFLINE (pas de vérification DB à la compilation)
```

### 2. Vérifier que la variable est bien définie

Dans les logs de build, chercher :
```
SQLX_OFFLINE=true
```

### 3. Si vous voyez des erreurs de connexion DB

Si vous voyez des erreurs comme :
```
error: error communicating with database: Hôte inconnu
```

Cela signifie que `SQLX_OFFLINE=false` est toujours actif.

## 📋 Checklist de correction

- [ ] Aller sur le Dashboard Render
- [ ] Vérifier la variable `SQLX_OFFLINE` dans Environment
- [ ] La définir à `true` si elle est à `false` ou absente
- [ ] Redéployer le service
- [ ] Vérifier les logs de build pour confirmer `SQLX_OFFLINE=true`
- [ ] Vérifier que la compilation réussit sans erreurs de connexion DB

## 🎯 Solution définitive

Pour éviter ce problème à l'avenir, **supprimer la variable `SQLX_OFFLINE` du dashboard Render** et laisser uniquement le `render.yaml` et le `build.sh` la gérer.

**Avantages :**
- ✅ Configuration centralisée dans le code
- ✅ Pas de risque de désynchronisation
- ✅ Versionnée dans Git

## ⚠️ Note importante

Si vous avez des requêtes `sqlx::query!()` sans métadonnées dans `.sqlx/`, même avec `SQLX_OFFLINE=true`, la compilation échouera.

**Solutions :**
1. Régénérer les métadonnées : `cargo sqlx prepare --workspace`
2. Convertir vers `sqlx::query()` ou `sqlx::query_as()` (recommandé pour portabilité)

Voir `ANALYSE_PORTABILITE_CLOUD_SQLX.md` pour plus de détails.

