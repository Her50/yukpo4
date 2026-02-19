# 🔍 Explication Simple : Problème de Connexion à la Base de Données

**Date** : 2026-02-17

---

## ❓ LE PROBLÈME EN UNE PHRASE

**Le backend Rust ne peut pas se connecter à PostgreSQL car l'URL de connexion (`DATABASE_URL`) est dans un format que la bibliothèque sqlx ne comprend pas.**

---

## 📋 EXPLICATION DÉTAILLÉE

### 1. Qu'est-ce que DATABASE_URL ?

`DATABASE_URL` est une chaîne de caractères qui contient toutes les informations pour se connecter à la base de données PostgreSQL.

**Format standard** (que sqlx comprend) :
```
postgresql://utilisateur:motdepasse@adresse-ip:5432/nom_base
```

**Format Cloud SQL** (que sqlx ne comprend PAS directement) :
```
postgresql://utilisateur:motdepasse@/nom_base?host=/cloudsql/projet:region:instance
```

### 2. Pourquoi Cloud SQL utilise un format différent ?

Cloud SQL utilise des **sockets Unix** au lieu d'une connexion TCP/IP classique. C'est plus sécurisé car :
- Pas besoin d'exposer l'IP publique
- Pas besoin de SSL/TLS
- Connexion directe via un fichier socket

**Le problème** : sqlx/tokio-postgres ne peut pas parser automatiquement le paramètre `?host=/cloudsql/...` dans l'URL.

### 3. Que se passe-t-il exactement ?

1. ✅ Rust démarre
2. ✅ Rust lit `DATABASE_URL` depuis les variables d'environnement
3. ✅ Rust nettoie `DATABASE_URL` (supprime les retours à la ligne)
4. ✅ Rust parse l'URL et extrait :
   - Utilisateur : `yukpo_user`
   - Mot de passe : `VTWc#%vKZt=qewDIfaB!n97y`
   - Base de données : `yukpo_db`
   - Socket path : `/cloudsql/yukpo-project:europe-west1:yukpo-postgres`
5. ❌ Rust essaie de créer la connexion avec `connect_lazy(&db_url)`
6. ❌ sqlx/tokio-postgres essaie de parser l'URL et trouve `@/nom_base` (pas de hostname après `@`)
7. ❌ Erreur : **"empty host"** (host vide)

### 4. Pourquoi "empty host" ?

Dans une URL PostgreSQL standard :
```
postgresql://user:pass@HOSTNAME:5432/db
                    ^^^^^^^^
                    Le hostname est ici
```

Dans l'URL Cloud SQL :
```
postgresql://user:pass@/db?host=/cloudsql/...
                    ^
                    Pas de hostname ici ! (juste @/)
```

sqlx cherche un hostname après `@` mais ne trouve rien, d'où l'erreur "empty host".

---

## ✅ LA SOLUTION

Au lieu d'utiliser l'URL directement, il faut construire manuellement les options de connexion :

**Avant** (ne fonctionne pas) :
```rust
pool_options.connect_lazy(&db_url)  // ❌ sqlx ne comprend pas ?host=/cloudsql/...
```

**Après** (fonctionne) :
```rust
let connect_options = PgConnectOptions::new()
    .host("/cloudsql/yukpo-project:europe-west1:yukpo-postgres")  // ✅ Socket path
    .username("yukpo_user")
    .database("yukpo_db")
    .password("VTWc#%vKZt=qewDIfaB!n97y")
    .ssl_mode(PgSslMode::Disable);

pool_options.connect_lazy_with(connect_options)  // ✅ Fonctionne !
```

---

## 🎯 RÉSUMÉ

| Élément | Statut | Explication |
|---------|--------|-------------|
| **DATABASE_URL existe** | ✅ | La variable est bien définie dans Cloud Run |
| **DATABASE_URL est correcte** | ✅ | Le format Cloud SQL est valide |
| **Rust peut lire DATABASE_URL** | ✅ | Les secrets sont accessibles |
| **sqlx peut parser l'URL** | ❌ | sqlx ne comprend pas `?host=/cloudsql/...` |
| **Solution** | ✅ | Utiliser `PgConnectOptions` manuellement |

---

## 🔧 CE QUI A ÉTÉ CORRIGÉ

1. ✅ Nettoyage de `DATABASE_URL` (suppression des retours à la ligne)
2. ✅ Parsing manuel de l'URL Cloud SQL
3. ✅ Construction de `PgConnectOptions` avec le socket path
4. ✅ Utilisation de `connect_lazy_with()` au lieu de `connect_lazy()`

---

## 📊 ANALOGIE SIMPLE

Imaginez que vous donnez une adresse à un GPS :

**Format standard** (que le GPS comprend) :
```
123 Rue Example, Paris, France
```

**Format Cloud SQL** (que le GPS ne comprend pas) :
```
Paris, France?chemin=/cloudsql/123-rue-example
```

Le GPS ne comprend pas le paramètre `?chemin=...`, donc il dit "adresse invalide".

**Solution** : Extraire manuellement le chemin et le donner au GPS dans un format qu'il comprend.

---

**Conclusion** : Le problème n'est PAS que le lien est mauvais, mais que sqlx ne peut pas le comprendre automatiquement. Il faut le traduire dans un format que sqlx comprend.


