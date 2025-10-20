# Migration pour Gestion d'Équipe des Services

## ⚠️ IMPORTANT : Migration à exécuter sur Render

La fonctionnalité de **gestion d'équipe des services** nécessite l'exécution de la migration `20251020_create_service_team_management.sql`.

### 📋 Ce que fait cette migration :

#### Tables créées :
- `service_team_roles` - Rôles d'équipe (Admin, Manager, Editor, Viewer)
- `service_permissions` - 14 permissions granulaires
- `role_permissions` - Association rôles ↔ permissions
- `service_team_members` - Membres des équipes
- `service_team_invitations` - Invitations avec tokens sécurisés
- `service_team_activities` - Historique des activités

#### Fonctionnalités :
- ✅ Gestion multi-utilisateur des services
- ✅ Système de rôles et permissions
- ✅ Invitations par email avec expiration (7 jours)
- ✅ Fonctions SQL pour vérification des permissions
- ✅ Vues optimisées pour les requêtes
- ✅ Auto-nettoyage des invitations expirées

---

## 🚀 Comment exécuter la migration sur Render

### Option 1 : Via le Dashboard Render (Recommandé)

1. Allez sur [Render Dashboard](https://dashboard.render.com)
2. Sélectionnez votre **PostgreSQL database**
3. Cliquez sur **Connect** → **External Connection**
4. Copiez la **Connection String**
5. Utilisez un client PostgreSQL (DBeaver, pgAdmin, ou psql) pour vous connecter
6. Exécutez le fichier : `backend/migrations/20251020_create_service_team_management.sql`

### Option 2 : Via psql en ligne de commande

```bash
# Depuis votre machine locale
psql "postgresql://user:password@host:port/database" < backend/migrations/20251020_create_service_team_management.sql
```

### Option 3 : Via Shell Render

1. Dans votre service Backend sur Render
2. Allez dans **Shell**
3. Exécutez :
```bash
psql $DATABASE_URL < /opt/render/project/src/backend/migrations/20251020_create_service_team_management.sql
```

### Option 4 : Automatique avec SQLx (si configuré)

Si vous utilisez SQLx migrations automatiques :
```bash
# Ajoutez dans votre build command Render
sqlx migrate run --source backend/migrations
cargo build --release
```

---

## ✅ Vérification post-migration

Après l'exécution, vérifiez que les tables existent :

```sql
-- Vérifier les tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'service_team%';

-- Devrait retourner :
-- service_team_roles
-- service_team_members
-- service_team_invitations
-- service_team_activities

-- Vérifier les rôles par défaut
SELECT id, name, level FROM service_team_roles ORDER BY level;

-- Devrait retourner 4 rôles :
-- admin        | Administrateur | 1
-- manager      | Gestionnaire   | 2
-- editor       | Éditeur        | 3
-- viewer       | Observateur    | 4
```

---

## 🎯 Routes disponibles après migration

Une fois la migration exécutée, ces routes seront disponibles :

### Gestion des membres
- `GET  /api/services/:service_id/team` - Liste des membres
- `POST /api/services/team/invite` - Inviter un membre
- `PATCH /api/services/team/members/:member_id` - Modifier le rôle
- `DELETE /api/services/team/members/:member_id` - Retirer un membre

### Rôles et permissions
- `GET /api/services/team/roles` - Liste des rôles
- `GET /api/services/team/permissions` - Liste des permissions

### Statistiques
- `GET /api/services/:service_id/team/stats` - Stats d'équipe

### Invitations
- `POST /api/services/team/invitations/:token/accept` - Accepter une invitation

---

## 🔧 En cas de problème

Si la migration échoue :

1. **Tables existent déjà** : 
   - C'est normal si déjà exécutée
   - Les `CREATE TABLE IF NOT EXISTS` sont sûres

2. **Erreur de permission** :
   - Vérifiez que l'utilisateur PostgreSQL a les droits CREATE

3. **Extension manquante** :
   - Si erreur sur `gen_random_uuid()`, installez : 
   ```sql
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```

4. **Contraintes de clés étrangères** :
   - Vérifiez que les tables `services` et `users` existent

---

## 📊 Utilisation dans l'application

### Exemple : Inviter un membre

```json
POST /api/services/team/invite
{
  "service_id": 123,
  "email": "user@example.com",
  "role": "editor",
  "permissions": []
}
```

### Exemple : Vérifier les permissions

```sql
-- Vérifier si user_id 5 peut éditer le service 123
SELECT check_service_permission(5, 123, 'edit_content');

-- Obtenir toutes les permissions d'un user sur un service
SELECT * FROM get_user_service_permissions(5, 123);
```

---

## 🎉 Avantages de cette fonctionnalité

- 👥 **Collaboration** : Plusieurs utilisateurs peuvent gérer un service
- 🔐 **Sécurité** : Permissions granulaires par rôle
- 📧 **Invitations** : Système d'invitation par email sécurisé
- 📊 **Traçabilité** : Historique des activités d'équipe
- ⚡ **Performance** : Index optimisés pour les requêtes

---

## 📝 Notes importantes

1. Les propriétaires de services (créateurs) ont **toutes les permissions** automatiquement
2. Les invitations expirent après **7 jours**
3. Un utilisateur ne peut avoir qu'**un seul rôle** par service
4. Les rôles sont **hiérarchiques** (Admin > Manager > Editor > Viewer)
5. Les permissions peuvent être **personnalisées** par rôle

---

## 🔗 Fichiers concernés

- Migration : `backend/migrations/20251020_create_service_team_management.sql`
- Routes : `backend/src/routes/service_team_routes.rs`
- Contrôleur : `backend/src/controllers/service_team_controller.rs`
- Schema SQL complet avec 4 rôles, 14 permissions, fonctions utilitaires et vues optimisées

---

**Date de création** : 2025-10-20  
**Status** : ✅ Prêt pour production  
**Priorité** : 🔴 HAUTE - Fonctionnalité importante pour la collaboration

