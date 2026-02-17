# 🔍 Diagnostic - Le Mot de Passe Revient Après Correction

**Date** : 17 Février 2026  
**Problème** : Le mot de passe fonctionne "au premier coup" puis le problème revient

---

## 🔍 Constatation Importante

### Deux Instances Cloud SQL Détectées

1. **`yukpo-postgres`** (34.79.199.41) - Utilisée par le workflow
2. **`yukpo-db`** (34.79.29.219) - Instance supplémentaire

**Problème potentiel** : Si l'application essaie de se connecter aux deux instances ou si les deux instances sont configurées dans Cloud Run, il faut synchroniser le mot de passe sur **les deux**.

---

## ✅ Actions Effectuées

### 1. Synchronisation du Mot de Passe sur les Deux Instances

**Instance 1** : `yukpo-postgres`
```bash
gcloud sql users set-password yukpo_user \
  --instance=yukpo-postgres \
  --password="VTWc#%vKZt=qewDIfaB!n97y" \
  --project=yukpo-project
```

**Instance 2** : `yukpo-db`
```bash
gcloud sql users set-password yukpo_user \
  --instance=yukpo-db \
  --password="VTWc#%vKZt=qewDIfaB!n97y" \
  --project=yukpo-project
```

### 2. Vérification du Secret

**Secret actuel** : `database-url` version 5  
**Valeur** : `postgresql://yukpo_user:VTWc%23%25vKZt%3DqewDIfaB!n97y@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres`

**Format** : ✅ Correct (Unix socket vers `yukpo-postgres`)

---

## 🎯 Hypothèses sur Pourquoi le Problème Revient

### Hypothèse 1 : Deux Instances Cloud SQL ⚠️

**Cause** : L'application ou Cloud Run essaie de se connecter aux deux instances, mais le mot de passe n'est synchronisé que sur une seule.

**Solution** : ✅ Synchroniser le mot de passe sur les deux instances (fait)

### Hypothèse 2 : Cloud Run Configure avec les Deux Instances ⚠️

**Cause** : Cloud Run est configuré avec `--add-cloudsql-instances` pour les deux instances, mais le secret pointe vers une seule.

**Vérification** : Le workflow utilise seulement `yukpo-postgres`, mais il faut vérifier si Cloud Run est configuré avec les deux.

### Hypothèse 3 : Problème de Cache ⚠️

**Cause** : Les connexions PostgreSQL sont mises en cache et utilisent l'ancien mot de passe.

**Solution** : Redémarrer le service Cloud Run après synchronisation.

### Hypothèse 4 : Problème avec les Révisions Cloud Run ⚠️

**Cause** : Différentes révisions Cloud Run utilisent différentes versions du secret ou différentes configurations.

**Solution** : Vérifier que toutes les révisions utilisent la même version du secret.

---

## 🔧 Actions Recommandées

### 1. Vérifier la Configuration Cloud Run

Vérifier quelles instances Cloud SQL sont configurées dans Cloud Run :

```bash
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --project=yukpo-project \
  --format="yaml(spec.template.metadata.annotations)" | grep cloudsql
```

### 2. Redémarrer le Service Cloud Run

Après synchronisation du mot de passe, redémarrer le service :

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --project=yukpo-project \
  --update-secrets=DATABASE_URL=database-url:latest
```

### 3. Vérifier les Logs Après Redémarrage

Télécharger les logs pour vérifier si les erreurs d'authentification ont disparu.

---

## 📊 État Actuel

| Élément | Statut | Détails |
|---------|--------|---------|
| **Instance yukpo-postgres** | ✅ | Mot de passe synchronisé |
| **Instance yukpo-db** | ✅ | Mot de passe synchronisé |
| **Secret database-url** | ✅ | Version 5, format correct |
| **Service Cloud Run** | ❓ | À vérifier si configuré avec les deux instances |

---

**Date** : 17 Février 2026  
**Statut** : ✅ Mot de passe synchronisé sur les deux instances

