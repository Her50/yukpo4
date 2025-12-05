# 📋 Instructions pour appliquer la migration effects sur Render

## Méthode recommandée : Interface Render Dashboard

1. **Aller sur** : https://dashboard.render.com
2. **Sélectionner** la base de données `yukpo_db`
3. **Ouvrir l'onglet** "Connect" ou "Query"
4. **Copier-coller** le contenu de `APPLY_EFFECTS_MIGRATION_RENDER.sql`
5. **Exécuter** la requête

## Alternative : Client SQL (pgAdmin, DBeaver, etc.)

1. Connectez-vous avec :
   - **Host**: `dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com`
   - **Port**: `5432`
   - **Database**: `yukpo_db`
   - **Username**: `yukpo_db_user`
   - **Password**: `88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4`

2. Ouvrez et exécutez le fichier `APPLY_EFFECTS_MIGRATION_RENDER.sql`

## Vérification

Après application, exécutez :

```sql
-- Devrait retourner 50+
SELECT COUNT(*) FROM effects;

-- Devrait montrer les 4 catégories
SELECT category, COUNT(*) FROM effects GROUP BY category;
```

---

**Note** : La migration sera aussi appliquée automatiquement au prochain démarrage du backend via `auto_migrate.rs` si la table n'existe pas encore.


