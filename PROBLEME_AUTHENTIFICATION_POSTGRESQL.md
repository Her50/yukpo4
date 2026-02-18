# 🚨 Problème Identifié : Authentification PostgreSQL

**Date** : 18 Février 2026 00:55

## Erreur dans les Logs

```
password authentication failed for user "yukpo_user"
```

## Analyse

### ✅ Ce qui fonctionne
1. **Socket Unix** : Le socket existe maintenant (`/cloudsql/yukpo-project:europe-west1:yukpo-postgres`)
2. **Connexion Cloud SQL** : Configurée dans Cloud Run (révision 00217)
3. **Parsing de l'URL** : Le code extrait correctement user, password, database, socket

### ❌ Problème actuel
**Authentification échoue** : Le mot de passe est incorrect ou mal décodé.

## Causes Possibles

### 1. Mot de passe URL-encodé non décodé
Le mot de passe dans `DATABASE_URL` est URL-encodé :
- `%23` = `#`
- `%25` = `%`
- `%3D` = `=`

**Exemple** :
```
VTWc%23%25vKZt%3DqewDIfaB!n97y
```
Devrait être décodé en :
```
VTWc#%vKZt=qewDIfaB!n97y
```

### 2. Le code ne décode pas le mot de passe
Dans `backend/src/main.rs`, ligne 546 :
```rust
connect_options = connect_options.password(password);
```

Le mot de passe est passé directement sans décodage URL.

## Solution

### Option 1 : Décoder le mot de passe avec `urlencoding`
```rust
use urlencoding::decode;

let password_decoded = decode(password)
    .map_err(|e| format!("Erreur décodage mot de passe: {}", e))?
    .to_string();
    
connect_options = connect_options.password(&password_decoded);
```

### Option 2 : Utiliser `percent_encoding` (standard Rust)
```rust
use percent_encoding::percent_decode;

let password_decoded = percent_decode(password.as_bytes())
    .decode_utf8()
    .map_err(|e| format!("Erreur décodage mot de passe: {}", e))?
    .to_string();
    
connect_options = connect_options.password(&password_decoded);
```

### Option 3 : Vérifier le mot de passe dans le secret
Le secret `database-url` contient peut-être le mot de passe déjà décodé ou mal encodé.

## Action Immédiate

1. Vérifier le contenu exact du secret `database-url`
2. Vérifier si le mot de passe est correct dans Cloud SQL
3. Ajouter le décodage URL du mot de passe dans le code

## Vérification des Utilisateurs

Pour lister les utilisateurs dans `yukpo_db`, il faut d'abord résoudre le problème d'authentification.

Une fois la connexion fonctionnelle, utiliser :
- Endpoint admin : `/api/admin/users` (nécessite authentification admin)
- Ou créer un endpoint temporaire pour lister les utilisateurs

