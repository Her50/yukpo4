# 🔧 Solution Temporaire : Utiliser IP Publique Cloud SQL

**Date**: 2026-02-15  
**Problème** : Le format Unix socket Cloud SQL cause une erreur "empty host" avec sqlx

---

## 🔴 Problème Identifié

Le format Unix socket Cloud SQL (`postgresql://user:pass@/db?host=/cloudsql/...`) cause une erreur "empty host" car sqlx/tokio-postgres ne parse pas correctement ce format.

**Erreur** :
```
error with configuration: empty host
```

---

## ✅ Solution Temporaire : IP Publique

Utiliser l'IP publique de Cloud SQL temporairement pour tester la connexion :

**Format** :
```
postgresql://yukpo_user:TempPassword123!@34.79.199.41:5432/yukpo_db?sslmode=require
```

### Avantages
- ✅ Fonctionne immédiatement avec sqlx
- ✅ Permet de tester la connexion
- ✅ Pas de problème de parsing

### Inconvénients
- ⚠️ Moins sécurisé (IP publique)
- ⚠️ Nécessite d'autoriser les IPs Cloud Run dans Cloud SQL

---

## 🔧 Configuration Cloud SQL

Pour autoriser les connexions depuis Cloud Run via IP publique :

1. **Aller sur** : https://console.cloud.google.com/sql/instances/yukpo-postgres/connections?project=yukpo-project

2. **Autoriser les IPs Cloud Run** :
   - Cloud Run utilise des IPs dynamiques
   - Option 1 : Autoriser `0.0.0.0/0` temporairement (non recommandé en production)
   - Option 2 : Utiliser uniquement le Unix socket (nécessite correction du code)

---

## 🚀 Solution Long Terme : Corriger le Format Unix Socket

Pour utiliser le Unix socket (plus sécurisé), il faut :

1. **Vérifier la documentation sqlx** pour le format Unix socket
2. **Ou utiliser une bibliothèque différente** pour gérer les Unix sockets
3. **Ou configurer sqlx différemment** pour Cloud SQL

---

## 📋 Vérification

Après mise à jour avec IP publique, vérifier les logs :

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" --limit=20 --project=yukpo-project
```

**Logs attendus** :
```
✅ Pool PostgreSQL créé avec succès
✅ Serveur lance sur http://0.0.0.0:8080
```

---

**⚠️ NOTE** : Cette solution est temporaire. Il faut corriger le format Unix socket pour une solution de production sécurisée.



