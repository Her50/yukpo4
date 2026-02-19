# ✅ Correction Problème Connexion Cloud SQL

**Date**: 2026-02-18  
**Problème**: Impossible de se connecter à l'application  
**Cause**: Socket Unix Cloud SQL non monté dans le conteneur

---

## 🔴 Problème Identifié

### Erreur dans les Logs

```
[MAIN] ❌ ERREUR: Le socket Unix n'existe pas: /cloudsql/yukpo-project:europe-west1:yukpo-postgres
[MAIN] ⚠️ Cloud SQL Unix socket n'est pas monté dans le conteneur
[MAIN] ❌ Erreur fatale: Socket Unix Cloud SQL n'existe pas
```

### Cause Racine

**L'annotation Cloud SQL était vide** dans la configuration Cloud Run :
- `run.googleapis.com/cloudsql-instances` = (vide)

**Conséquence** :
- Le socket Unix `/cloudsql/yukpo-project:europe-west1:yukpo-postgres` n'était pas monté
- L'application ne pouvait pas se connecter à Cloud SQL
- Toutes les requêtes retournaient 503 (Service Unavailable)

---

## ✅ Solution Appliquée

### Commande Exécutée

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --project=yukpo-project \
  --add-cloudsql-instances=yukpo-project:europe-west1:yukpo-postgres
```

### Résultat

- ✅ Connexion Cloud SQL ajoutée
- ✅ Service redéployé : `yukpo-backend-00284-5g2`
- ✅ Socket Unix maintenant monté dans `/cloudsql/`

---

## 🔍 Vérification

### 1. Vérifier la Configuration

```bash
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --project=yukpo-project \
  --format="value(metadata.annotations.'run.googleapis.com/cloudsql-instances')"
```

**Résultat attendu** :
```
yukpo-project:europe-west1:yukpo-postgres
```

### 2. Vérifier les Logs

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND resource.labels.revision_name=yukpo-backend-00284-5g2" \
  --limit=50 \
  --project=yukpo-project \
  --format="value(timestamp,textPayload)"
```

**Rechercher** :
- ✅ `Socket Unix existe: /cloudsql/yukpo-project:europe-west1:yukpo-postgres`
- ✅ `Connexion PostgreSQL établie`
- ✅ Aucune erreur "socket n'existe pas"

### 3. Tester la Connexion

```bash
curl https://yukpo-backend-376093909298.europe-west1.run.app/health
```

**Résultat attendu** : `OK` ou réponse JSON avec statut

---

## 📋 Checklist

- [x] Connexion Cloud SQL ajoutée dans Cloud Run
- [x] Service redéployé avec la nouvelle configuration
- [ ] Logs vérifiés (socket monté)
- [ ] Test de connexion réussi
- [ ] Application accessible

---

## 🎯 Prochaines Étapes

1. **Attendre 1-2 minutes** pour que le service démarre complètement
2. **Vérifier les logs** pour confirmer que le socket est monté
3. **Tester la connexion** à l'application
4. **Vérifier que le login fonctionne**

---

## 📝 Notes

- Le socket Unix Cloud SQL est monté automatiquement par Cloud Run
- Le chemin est toujours `/cloudsql/CONNECTION_NAME`
- La connexion doit être configurée dans les annotations Cloud Run
- Le service doit être redéployé après l'ajout de la connexion

---

**Date**: 2026-02-18  
**Statut**: ✅ **CORRECTION APPLIQUÉE - EN ATTENTE DE VÉRIFICATION**


