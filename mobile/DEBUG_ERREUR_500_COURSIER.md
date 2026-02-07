# 🔍 Debug Erreur 500 - Création compte coursier

## ❌ Problème

Erreur 500 lors de la sauvegarde dans l'écran de création de compte coursier.

## 🔍 Causes possibles identifiées

### 1. ⚠️ Partner ID invalide (-1 pour Yukpo virtuel)

**Problème** : Le code mobile utilise `partner_id: -1` pour le partenaire "Yukpo" virtuel, mais le backend essaie de valider ce ID dans la base de données.

**Solution appliquée** : Conversion de `-1` en `null` avant l'envoi au backend.

### 2. ⚠️ Colonne `partner_id` manquante dans la base de données

**Problème** : Si la migration n'a pas été exécutée, la colonne `partner_id` n'existe pas dans `courier_applications`.

**Vérification** :
```sql
-- Vérifier si la colonne existe
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'courier_applications' AND column_name = 'partner_id';
```

**Solution** : Exécuter la migration :
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

### 3. ⚠️ Erreur de sérialisation JSON

**Problème** : Les champs `profile_data` ou `documents` peuvent contenir des données invalides qui causent une erreur lors de la sérialisation.

**Vérification** : Vérifier les logs backend pour voir l'erreur exacte.

### 4. ⚠️ Contrainte de clé étrangère

**Problème** : Si `partner_id` pointe vers un partenaire qui n'existe pas ou qui n'est pas actif.

**Solution** : Le backend valide déjà cela, mais vérifier que la validation fonctionne correctement.

## ✅ Corrections appliquées

### Correction 1 : Gestion du partner_id -1

**Fichier** : `mobile/src/screens/delivery/CourierRegistrationScreen.tsx`

**Avant** :
```typescript
partner_id: selectedPartnerId, // Peut être -1
```

**Après** :
```typescript
// Convertir -1 (Yukpo virtuel) en null
const validPartnerId = selectedPartnerId && selectedPartnerId > 0 ? selectedPartnerId : null;
partner_id: validPartnerId, // null si -1 ou invalide
```

## 🔧 Actions de diagnostic

### 1. Vérifier les logs backend

```bash
# Voir les logs en temps réel
tail -f logs/backend.log | grep -i "courier\|error\|500"
```

### 2. Vérifier la structure de la base de données

```sql
-- Vérifier les colonnes de courier_applications
\d courier_applications

-- Ou
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'courier_applications'
ORDER BY ordinal_position;
```

### 3. Tester avec un partenaire valide

Dans l'application mobile :
1. Sélectionner un partenaire réel (pas Yukpo virtuel)
2. Tenter la sauvegarde
3. Vérifier si l'erreur persiste

### 4. Vérifier les migrations

```bash
cd backend
sqlx migrate info
```

Vérifier que la migration `20260104_apply_delivery_partners_migrations.sql` a été appliquée.

## 📋 Checklist de résolution

- [ ] Correction du partner_id -1 appliquée dans le code mobile
- [ ] Migration `partner_id` exécutée sur la base de données
- [ ] Logs backend consultés pour identifier l'erreur exacte
- [ ] Test avec un partenaire valide effectué
- [ ] Test avec Yukpo (null) effectué
- [ ] Erreur 500 résolue

## 🆘 Si le problème persiste

1. **Vérifier les logs backend complets** pour voir l'erreur exacte
2. **Vérifier la structure de la base de données** avec `\d courier_applications`
3. **Tester la requête SQL directement** :
   ```sql
   INSERT INTO courier_applications (user_id, status, profile_data, documents, partner_id)
   VALUES (1, 'draft', '{}'::jsonb, '[]'::jsonb, NULL);
   ```
4. **Vérifier les contraintes** :
   ```sql
   SELECT conname, contype, pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conrelid = 'courier_applications'::regclass;
   ```

