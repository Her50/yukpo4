# ✅ Migration Prête à Appliquer

## 📋 Résumé

La migration de correction des noms dupliqués est prête à être appliquée sur Cloud SQL GCP.

**Fichier de migration** : `backend/migrations/20260216_fix_duplicate_full_names.sql`

---

## 🚀 Application via Console Cloud SQL (RECOMMANDÉ)

### Étape 1: Ouvrir la Console

La console Cloud SQL devrait s'ouvrir automatiquement. Sinon, ouvrez :
```
https://console.cloud.google.com/sql/instances/yukpo-postgres/databases?project=yukpo-project
```

### Étape 2: Accéder à l'Éditeur SQL

1. Cliquez sur la base de données **`yukpo_db`**
2. Cliquez sur l'onglet **"Query"** ou **"SQL Editor"**

### Étape 3: Copier-Coller le SQL

Copiez le contenu du fichier :
```
C:\Users\23767\yukpomnang2\backend\migrations\20260216_fix_duplicate_full_names.sql
```

**OU** utilisez le contenu affiché ci-dessous.

### Étape 4: Exécuter

Cliquez sur **"Run"** pour exécuter la migration.

---

## 📄 Contenu SQL Complet

Le contenu SQL complet est disponible dans :
- **Fichier** : `backend/migrations/20260216_fix_duplicate_full_names.sql`
- **Fichier temporaire** : `C:\Users\23767\AppData\Local\Temp\tmpC416.sql`

---

## ✅ Ce que fait la Migration

1. **Crée 3 fonctions SQL** :
   - `normalize_full_name_sql()` : Normalise un nom en supprimant les duplications
   - `build_full_name_sql()` : Construit un nom_complet à partir de nom/prenom
   - `normalize_users_nom_complet()` : Fonction trigger pour normalisation automatique

2. **Corrige les noms existants** :
   - Normalise tous les `nom_complet` avec duplications
   - Reconstruit les `nom_complet` manquants à partir de `nom` et `prenom`

3. **Crée un trigger automatique** :
   - Normalise automatiquement les nouveaux noms lors des INSERT/UPDATE
   - Empêche les futures duplications

4. **Crée un index** :
   - Améliore les performances des recherches par `nom_complet`

---

## 🔍 Vérification Post-Migration

### Vérifier que les fonctions existent

```sql
SELECT proname FROM pg_proc WHERE proname LIKE '%normalize%';
```

Résultat attendu :
- `normalize_full_name_sql`
- `build_full_name_sql`
- `normalize_users_nom_complet`

### Vérifier que le trigger existe

```sql
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_normalize_users_nom_complet';
```

### Vérifier un exemple de nom corrigé

```sql
SELECT id, nom, prenom, nom_complet 
FROM users 
WHERE nom_complet IS NOT NULL
LIMIT 10;
```

---

## ⚠️ Important

- ✅ La migration est **idempotente** (peut être exécutée plusieurs fois sans problème)
- ✅ Utilise `CREATE OR REPLACE` pour les fonctions
- ✅ Utilise `DROP TRIGGER IF EXISTS` pour le trigger
- ✅ Utilise `CREATE INDEX IF NOT EXISTS` pour l'index

---

## 📝 Notes

- Le fichier temporaire sera conservé pour référence
- Vous pouvez supprimer le fichier temporaire après avoir appliqué la migration
- La migration corrigera automatiquement tous les noms dupliqués existants


