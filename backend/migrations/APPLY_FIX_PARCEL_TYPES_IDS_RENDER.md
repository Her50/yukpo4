# Application directe de la migration fix_parcel_types_ids sur Render

## 🚀 Méthode 1 : Via Shell Render (Recommandé)

1. **Accéder au Shell Render** :
   - Aller sur https://dashboard.render.com
   - Sélectionner votre service backend
   - Cliquer sur "Shell" dans le menu latéral

2. **Exécuter le script** :
```bash
cd /opt/render/project/src
chmod +x scripts/apply_fix_parcel_types_ids_render.sh
./scripts/apply_fix_parcel_types_ids_render.sh
```

## 🚀 Méthode 2 : Via cargo run (Direct)

1. **Accéder au Shell Render**

2. **Exécuter directement** :
```bash
cd /opt/render/project/src/backend
cargo run --bin apply_fix_parcel_types_ids
```

## 🚀 Méthode 3 : Via psql (SQL direct)

1. **Accéder au Shell Render**

2. **Exécuter le SQL directement** :
```bash
cd /opt/render/project/src/backend/migrations
psql $DATABASE_URL -f 20260115_fix_parcel_types_ids.sql
```

## ✅ Vérification après migration

Pour vérifier que la migration a bien été appliquée :

```sql
SELECT id, slug, display_name 
FROM parcel_types 
ORDER BY id;
```

Résultat attendu :
- ID 1: bike (Vélo)
- ID 2: motorcycle (Moto)
- ID 3: tricycle (Tricycle)
- ID 4: car (Voiture)
- ID 5: pickup (Pick-up)
- ID 6: van (Camionnette)
- ID 7: truck (Camion)
- ID 8: walking (À pied)

## 📝 Notes importantes

- La migration est **idempotente** : elle peut être exécutée plusieurs fois sans problème
- Elle utilise des IDs temporaires négatifs pour éviter les conflits lors de la mise à jour
- La séquence est automatiquement réinitialisée à 8 après la migration
- Les vérifications intégrées garantissent que tous les IDs sont corrects

## 🔧 Dépannage

Si vous rencontrez une erreur de clé étrangère :
1. Vérifiez que tous les types existent : `SELECT * FROM parcel_types;`
2. Vérifiez les références : `SELECT * FROM product_delivery_config WHERE required_vehicle_type_id NOT IN (1,2,3,4,5,6,7,8);`
3. Si des références invalides existent, corrigez-les avant d'appliquer la migration

