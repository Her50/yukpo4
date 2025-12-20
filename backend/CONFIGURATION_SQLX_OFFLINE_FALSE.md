# Configuration SQLX_OFFLINE=false

## ✅ Configuration appliquée

`SQLX_OFFLINE` a été configuré à `false` dans :
- `render.yaml` : buildCommand (ligne 22) et envVars (ligne 63-64)

## ⚠️ Points importants

### 1. Accès à la base de données requis

Avec `SQLX_OFFLINE=false`, SQLx doit pouvoir se connecter à la base de données pendant le build. Assurez-vous que :

- ✅ `DATABASE_URL` est correctement configurée dans Render
- ✅ La base de données est accessible depuis les serveurs de build de Render
- ✅ Les credentials sont valides

### 2. Si les builds échouent

Si vous voyez des erreurs comme :
```
error: error communicating with database: Hôte inconnu
error: error communicating with database: Connection refused
```

**Solutions possibles :**

#### Option A : Vérifier que DATABASE_URL est accessible
- Vérifiez que `DATABASE_URL` est bien définie dans Render
- Testez la connexion depuis un terminal :
  ```bash
  psql "postgresql://user:password@host:port/database" -c "SELECT 1"
  ```

#### Option B : Utiliser SQLX_OFFLINE=true si nécessaire
Si Render ne permet pas l'accès à la DB pendant le build, revenez à `SQLX_OFFLINE=true` :
```yaml
export SQLX_OFFLINE=true
```

Puis régénérez les métadonnées :
```bash
cargo sqlx prepare --workspace
git add .sqlx/
git commit -m "Update SQLx metadata"
```

### 3. Avantages de SQLX_OFFLINE=false

- ✅ Vérification SQL en temps réel contre la DB réelle
- ✅ Détection précoce d'erreurs SQL
- ✅ Pas besoin de régénérer les métadonnées manuellement
- ✅ Synchronisation automatique avec le schéma DB

### 4. Inconvénients potentiels

- ⚠️ Builds plus lents (requêtes DB à chaque compilation)
- ⚠️ Dépendance réseau (si DB down, build échoue)
- ⚠️ Peut ne pas fonctionner si Render bloque l'accès DB pendant le build

## 🔍 Vérification

Après le déploiement, vérifiez les logs de build :

**Si ça fonctionne, vous verrez :**
```
✅ SQLX_OFFLINE configuré à false dans buildCommand
Mode SQLx: ONLINE (vérification DB à la compilation)
```

**Si ça échoue, vous verrez :**
```
error: error communicating with database: ...
```

## 📋 Checklist

- [ ] `SQLX_OFFLINE=false` configuré dans render.yaml
- [ ] `DATABASE_URL` correctement configurée dans Render
- [ ] Base de données accessible depuis Render
- [ ] Build testé et vérifié
- [ ] Si erreurs, considérer revenir à `SQLX_OFFLINE=true`

