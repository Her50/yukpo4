# 🔍 Explication : Différence entre les Comptes Utilisateurs

## 📋 Deux Types de Comptes Différents

Il y a **deux types de comptes complètement différents** dans votre système :

---

## 1. 🔧 Compte de Base de Données PostgreSQL (`yukpo_user`)

### Qu'est-ce que c'est ?

C'est un **compte système PostgreSQL** utilisé par l'**application backend** pour se connecter à la base de données.

### Caractéristiques :

- **Type** : Compte technique/système
- **Utilisateur** : `yukpo_user`
- **Rôle** : Permet à l'application backend de lire/écrire dans la base de données
- **Utilisé par** : Le code backend Rust (Axum)
- **Stocké** : Dans la configuration Cloud SQL (pas dans votre application)
- **Visible** : Dans `DATABASE_URL` de Cloud Run

### Exemple de DATABASE_URL :

```
postgresql://yukpo_user:MTeInD(Vw)b$C3Np479P@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Décomposition** :
- `yukpo_user` = nom d'utilisateur PostgreSQL
- `MTeInD(Vw)b$C3Np479P` = mot de passe PostgreSQL
- `yukpo_db` = nom de la base de données

### À quoi ça sert ?

L'application backend utilise ce compte pour :
- Se connecter à PostgreSQL
- Exécuter des requêtes SQL
- Lire/écrire dans les tables (`users`, `products`, `services`, etc.)

**C'est comme un "compte de service"** - l'application l'utilise en arrière-plan, vous ne l'utilisez jamais directement.

---

## 2. 👤 Compte Utilisateur de l'Application (Votre Email)

### Qu'est-ce que c'est ?

C'est **votre compte utilisateur** dans l'application mobile/web que vous utilisez pour vous connecter.

### Caractéristiques :

- **Type** : Compte utilisateur final
- **Identifiant** : Votre email (ex: `lelehernandez2007@gmail.com`)
- **Mot de passe** : Le mot de passe que vous avez défini lors de l'inscription
- **Stocké** : Dans la table `users` de la base de données PostgreSQL
- **Utilisé par** : Vous, l'utilisateur final
- **Visible** : Dans l'écran de connexion de l'application mobile/web

### Comment ça fonctionne ?

1. **Vous vous connectez** avec votre email et mot de passe dans l'application mobile
2. **L'application backend** reçoit votre email/mot de passe
3. **Le backend** utilise le compte `yukpo_user` pour se connecter à PostgreSQL
4. **Le backend** cherche votre compte dans la table `users` avec votre email
5. **Le backend** vérifie votre mot de passe (hashé avec bcrypt)
6. **Si correct**, le backend vous donne un token JWT
7. **Vous êtes connecté** et pouvez accéder au homescreen

### Exemple de requête SQL (exécutée par le backend) :

```sql
-- Le backend utilise yukpo_user pour exécuter cette requête
SELECT id, email, password_hash, role, tokens_balance, nom_complet
FROM users
WHERE email = 'lelehernandez2007@gmail.com'
```

---

## 🔄 Flux de Connexion Complet

```
┌─────────────────┐
│  Vous (Mobile)  │
│  Email + Pass   │
└────────┬────────┘
         │
         │ POST /api/auth/login
         ▼
┌─────────────────────────────────┐
│  Backend Cloud Run              │
│  Utilise: yukpo_user            │
│  (compte PostgreSQL technique)  │
└────────┬────────────────────────┘
         │
         │ Connexion PostgreSQL
         │ avec yukpo_user
         ▼
┌─────────────────────────────────┐
│  Cloud SQL PostgreSQL           │
│  Table: users                   │
│  Cherche: votre email           │
│  Vérifie: votre mot de passe    │
└────────┬────────────────────────┘
         │
         │ Retourne vos données
         ▼
┌─────────────────────────────────┐
│  Backend génère un JWT          │
│  avec vos infos                 │
└────────┬────────────────────────┘
         │
         │ Token JWT
         ▼
┌─────────────────┐
│  Vous (Mobile)  │
│  Connecté ✅    │
│  Homescreen     │
└─────────────────┘
```

---

## 📊 Tableau Comparatif

| Caractéristique | `yukpo_user` (PostgreSQL) | Votre Email (Application) |
|----------------|---------------------------|---------------------------|
| **Type** | Compte système technique | Compte utilisateur final |
| **Utilisé par** | Application backend | Vous, l'utilisateur |
| **Stocké** | Configuration Cloud SQL | Table `users` dans PostgreSQL |
| **Visible** | Dans `DATABASE_URL` | Dans l'écran de connexion |
| **Mot de passe** | Technique (changé récemment) | Votre mot de passe personnel |
| **Nombre** | 1 seul compte | Autant que d'utilisateurs |
| **Rôle** | Accès à toute la base | Accès à vos données uniquement |

---

## ✅ Résumé

- **`yukpo_user`** = Compte technique PostgreSQL utilisé par le backend (vous ne l'utilisez jamais directement)
- **Votre email** = Votre compte utilisateur dans l'application (ce que vous utilisez pour vous connecter)

**Ils sont complètement différents et servent des objectifs différents !**

---

## 🔍 Vérification

Pour voir votre compte utilisateur dans la base de données :

```sql
-- Se connecter à PostgreSQL avec yukpo_user
SELECT id, email, role, nom_complet, created_at 
FROM users 
WHERE email = 'lelehernandez2007@gmail.com';
```

Ceci montre **votre compte utilisateur** (pas le compte `yukpo_user`).


