# ✅ Correction de l'erreur 500 lors de la création d'une configuration de livraison

## 🔍 Problèmes identifiés dans les logs

### 1. Erreur CASE/WHEN - Type boolean attendu mais integer reçu
**Erreur** : `ERROR: argument of CASE/WHEN must be type boolean, not type integer at character 635`

**Cause** : Dans la requête INSERT de `product_delivery_config`, la clause `CASE WHEN $18 THEN ...` utilise `$18` qui est `is_configured` (un booléen Rust), mais PostgreSQL le reçoit comme un integer.

**Fichier** : `backend/src/routes/delivery_routes.rs` ligne 760-761

**Solution appliquée** :
- Conversion explicite en boolean avec `$18::boolean` dans les clauses CASE
- Correction dans VALUES et dans DO UPDATE SET

### 2. Erreur colonne partner_id n'existe pas
**Erreur** : `ERROR: column "partner_id" does not exist at character 308`

**Cause** : La requête SELECT sur `courier_applications` essaie de récupérer `partner_id` mais cette colonne n'existe pas dans la table (migration non exécutée).

**Fichier** : `backend/src/services/delivery_repository.rs` ligne 881

**Solution appliquée** :
- Création d'une migration pour s'assurer que la colonne existe : `20260210_fix_courier_applications_partner_id.sql`
- La migration ajoute la colonne `partner_id` si elle n'existe pas

## ✅ Corrections appliquées

### 1. Correction de l'erreur CASE/WHEN

**Avant** :
```sql
CASE WHEN $18 THEN NOW() ELSE NULL END
```

**Après** :
```sql
CASE WHEN $18::boolean THEN NOW() ELSE NULL END
```

**Fichier modifié** : `backend/src/routes/delivery_routes.rs`
- Ligne 761 : Conversion dans VALUES
- Ligne 781-782 : Conversion dans DO UPDATE SET

### 2. Migration pour partner_id

**Fichier créé** : `backend/migrations/20260210_fix_courier_applications_partner_id.sql`

```sql
ALTER TABLE courier_applications 
ADD COLUMN IF NOT EXISTS partner_id INTEGER REFERENCES delivery_partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_courier_applications_partner ON courier_applications(partner_id);
```

## 🚀 Prochaines étapes

### 1. Exécuter la migration

```bash
cd backend
sqlx migrate run
```

Ou manuellement :
```sql
ALTER TABLE courier_applications 
ADD COLUMN IF NOT EXISTS partner_id INTEGER REFERENCES delivery_partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_courier_applications_partner ON courier_applications(partner_id);
```

### 2. Redémarrer le backend

Après avoir exécuté la migration, redémarrer le serveur backend pour que les changements prennent effet.

### 3. Tester

Créer une nouvelle configuration de livraison pour un produit et vérifier qu'il n'y a plus d'erreur 500.

## 📁 Fichiers modifiés

- ✅ `backend/src/routes/delivery_routes.rs` - Correction CASE/WHEN
- ✅ `backend/migrations/20260210_fix_courier_applications_partner_id.sql` - Migration pour partner_id

## ⚠️ Note importante

Si l'erreur persiste après avoir exécuté la migration, vérifiez que :
1. La migration a bien été appliquée : `SELECT column_name FROM information_schema.columns WHERE table_name = 'courier_applications' AND column_name = 'partner_id';`
2. Le backend a été redémarré après les modifications
3. Les logs montrent que la requête fonctionne correctement

