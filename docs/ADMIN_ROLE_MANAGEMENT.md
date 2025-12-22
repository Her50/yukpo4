# 📋 Gestion des Rôles Administrateur

## 🔍 Vue d'ensemble

Dans l'application Yukpomnang, les utilisateurs peuvent avoir différents rôles, notamment le rôle **"admin"** qui leur donne accès à des fonctionnalités et écrans spécifiques.

## 🗄️ Structure de la base de données

Le rôle de l'utilisateur est stocké dans la colonne `role` de la table `users` :

- **Valeurs possibles** : `"user"` (par défaut), `"admin"`, `"client"`, `"prestataire"`
- **Type** : `VARCHAR` ou `TEXT`
- **Valeur par défaut** : `"user"`

## 🔐 Comment promouvoir un utilisateur en administrateur

### Méthode 1 : Via SQL direct

Exécutez directement une requête SQL sur votre base de données :

```sql
-- Promouvoir un utilisateur existant en admin par son email
UPDATE users 
SET role = 'admin', updated_at = NOW()
WHERE email = 'user@example.com';

-- Promouvoir un utilisateur existant en admin par son ID
UPDATE users 
SET role = 'admin', updated_at = NOW()
WHERE id = 1;
```

### Méthode 2 : Via le script PowerShell (Windows)

Un script est disponible dans `backend/create_admin_user.ps1` :

```powershell
# Depuis le dossier backend
.\create_admin_user.ps1
```

Ce script :
- Lit la `DATABASE_URL` depuis le fichier `.env`
- Crée ou met à jour un utilisateur admin avec :
  - Email : `admin@yukpo.dev`
  - Mot de passe : `admin123` (hashé avec bcrypt)
  - Rôle : `admin`

### Méthode 3 : Créer un nouvel utilisateur admin

Exécutez le script SQL fourni dans `backend/create_test_user.sql` :

```sql
INSERT INTO users (
    email, 
    password_hash, 
    role, 
    is_provider, 
    tokens_balance, 
    token_price_user, 
    token_price_provider, 
    commission_pct, 
    preferred_lang, 
    created_at, 
    updated_at, 
    gps_consent
)
VALUES (
    'admin@yukpo.dev',
    '$2b$12$LQv3c1yqBwEXfGJp/mGJP.n0O6WkHQcXgN4Oqs/vCXdpWo8H5Zl0G', -- password123
    'admin',
    true,
    10000,
    1.0,
    0.8,
    0.1,
    'fr',
    NOW(),
    NOW(),
    true
) ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    tokens_balance = EXCLUDED.tokens_balance,
    is_provider = EXCLUDED.is_provider,
    updated_at = NOW();
```

## ✅ Vérification du rôle dans le code

### Backend (Rust)

Les vérifications de rôle admin sont effectuées dans plusieurs contrôleurs :

```rust
// Exemple dans delivery_routes.rs
if user.role != "admin" {
    return Err(AppError::Forbidden(
        "Accès réservé aux administrateurs".into(),
    ));
}
```

### Frontend Mobile (React Native)

Dans les écrans admin, le rôle est vérifié :

```typescript
// Exemple dans CourierAdminScreen.tsx
if (user?.role !== 'admin') {
    Alert.alert('Accès refusé', 'Cette page est réservée aux administrateurs', [
        { text: 'OK', onPress: () => navigation.goBack() },
    ]);
    return;
}
```

### Frontend Web (React)

Le hook `usePermissions` gère les permissions :

```typescript
const role = user?.role || "public";
const isAdmin = role === "admin";
```

## 🎯 Écrans et fonctionnalités réservés aux admins

Les fonctionnalités suivantes nécessitent le rôle `admin` :

1. **CourierAdminScreen** (`mobile/src/screens/delivery/CourierAdminScreen.tsx`)
   - Gestion des coursiers
   - Validation/refus des candidatures de coursiers
   - Gestion des statuts de livraison

2. **Routes API backend** :
   - `/api/delivery/couriers/applications` (liste des candidatures)
   - `/api/delivery/couriers/applications/{id}/approve` (approuver)
   - `/api/delivery/couriers/applications/{id}/reject` (rejeter)
   - Certaines routes KYC (Know Your Customer)

3. **Fonctionnalités web** :
   - Accès aux outils d'administration via `canAccessAdminTools`
   - Gestion des utilisateurs (si implémenté)
   - Accès aux logs système

## 🚀 Améliorations futures recommandées

### 1. Créer une interface de gestion des rôles

Il serait utile d'ajouter une interface dans l'application pour :

- Lister tous les utilisateurs
- Voir leurs rôles actuels
- Modifier les rôles (seulement pour les admins)
- Voir l'historique des changements de rôles

### 2. Ajouter une route API pour la gestion des rôles

Créer un endpoint sécurisé :

```rust
// backend/src/routes/admin_routes.rs
POST /api/admin/users/{user_id}/role
Body: { "role": "admin" | "user" | "client" | "prestataire" }
```

### 3. Ajouter des permissions granulaires

Au lieu d'un simple booléen "admin", implémenter un système de permissions :

- `can_manage_users`
- `can_view_logs`
- `can_manage_couriers`
- `can_reset_tokens`
- etc.

### 4. Journalisation des changements

Créer une table `role_changes` pour tracer :

- Qui a changé le rôle
- Quand
- De quel rôle vers quel rôle
- Raison du changement

## 📝 Notes importantes

⚠️ **Sécurité** : La promotion d'un utilisateur en admin doit être effectuée avec précaution, car cela donne accès à des fonctionnalités sensibles.

🔒 **Recommandation** : Limitez le nombre d'administrateurs et utilisez des mots de passe forts.

📊 **Base de données** : Sur Render ou en production, connectez-vous directement à la base de données PostgreSQL pour effectuer les changements de rôle.

## 🔗 Fichiers liés

- `backend/src/models/user_model.rs` - Modèle User avec le champ `role`
- `backend/create_admin_user.ps1` - Script PowerShell pour créer un admin
- `backend/create_test_user.sql` - Script SQL pour créer un admin
- `mobile/src/screens/delivery/CourierAdminScreen.tsx` - Écran admin mobile
- `backend/src/routes/delivery_routes.rs` - Routes protégées par rôle admin
- `backend/src/controllers/kyc_admin_controller.rs` - Contrôleur admin KYC


