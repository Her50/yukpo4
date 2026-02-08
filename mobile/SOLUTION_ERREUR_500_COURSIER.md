# ✅ Solution Erreur 500 - Création compte coursier

## 🔍 Problème identifié

Erreur 500 lors de la sauvegarde dans l'écran de création de compte coursier.

## ✅ Corrections appliquées

### 1. Gestion du partner_id invalide (-1)

**Problème** : Le code mobile utilisait `partner_id: -1` pour le partenaire "Yukpo" virtuel, ce qui pouvait causer des erreurs de validation.

**Fichier modifié** : `mobile/src/screens/delivery/CourierRegistrationScreen.tsx`

**Correction** :
```typescript
// ✅ CORRIGÉ: Convertir -1 (Yukpo virtuel) en null
const validPartnerId = selectedPartnerId && selectedPartnerId > 0 ? selectedPartnerId : null;

const response = await deliveryApi.submitCourierApplication({
    profile_data: profileData,
    documents,
    submitted: submit,
    partner_id: validPartnerId, // null si -1 ou invalide
});
```

### 2. Validation améliorée côté backend

**Fichier modifié** : `backend/src/services/delivery_service.rs`

**Correction** : Validation des IDs négatifs ou zéro avant la requête SQL :
```rust
// Ignorer les IDs invalides (négatifs, zéro, ou -1 pour Yukpo virtuel)
if partner_id <= 0 {
    log::info!("partner_id {} invalide, utilisation de NULL", partner_id);
    None
} else {
    // Valider dans la base de données
    ...
}
```

### 3. Nettoyage du partner_id dans la route

**Fichier modifié** : `backend/src/routes/delivery_routes.rs`

**Correction** : Nettoyage du `partner_id` avant traitement :
```rust
let cleaned_partner_id = if let Some(pid) = payload.partner_id {
    if pid > 0 {
        Some(pid)
    } else {
        None // Convertir les IDs invalides en None
    }
} else {
    None
};
```

## 🔧 Vérifications à effectuer

### 1. Vérifier que la colonne `partner_id` existe

**Option A : Via SQL**
```sql
-- Vérifier si la colonne existe
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'courier_applications' AND column_name = 'partner_id';
```

**Option B : Via script**
```bash
cd backend
psql $DATABASE_URL -f scripts/check-courier-applications-schema.sql
```

### 2. Si la colonne n'existe pas, l'ajouter

```sql
ALTER TABLE courier_applications 
ADD COLUMN IF NOT EXISTS partner_id INTEGER REFERENCES delivery_partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_courier_applications_partner ON courier_applications(partner_id);
```

**Ou exécuter la migration complète** :
```bash
cd backend
sqlx migrate run
```

### 3. Vérifier les logs backend

```bash
# Voir les logs en temps réel
tail -f logs/backend.log | grep -i "courier\|error\|500"
```

## 📋 Checklist de résolution

- [x] Correction du partner_id -1 appliquée dans le code mobile
- [x] Validation améliorée côté backend
- [x] Nettoyage du partner_id dans la route
- [ ] Migration `partner_id` vérifiée/exécutée sur la base de données
- [ ] Test de sauvegarde effectué avec succès
- [ ] Logs backend vérifiés (pas d'erreur 500)

## 🚀 Prochaines étapes

1. **Rebuild l'application mobile** :
   ```bash
   cd mobile
   npx expo run:android
   ```

2. **Vérifier la base de données** :
   ```bash
   cd backend
   psql $DATABASE_URL -f scripts/check-courier-applications-schema.sql
   ```

3. **Tester la sauvegarde** :
   - Ouvrir l'écran de création de compte coursier
   - Remplir le formulaire
   - Cliquer sur "Enregistrer en brouillon" ou "Soumettre"
   - Vérifier que l'erreur 500 ne se produit plus

## 🆘 Si le problème persiste

1. **Vérifier les logs backend** pour voir l'erreur exacte
2. **Vérifier la structure de la base de données** avec le script SQL
3. **Vérifier que la migration a été exécutée** :
   ```bash
   cd backend
   sqlx migrate info
   ```

4. **Tester avec un partenaire réel** (pas Yukpo virtuel) pour isoler le problème



