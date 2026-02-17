# 📋 GUIDE : Vérification des Variables d'Environnement dans GCP

**Date** : 2026-02-17

---

## 🔍 OÙ VOIR LES VARIABLES D'ENVIRONNEMENT DANS GCP

### 1. Via la Console GCP (Interface Web)

#### Étape 1 : Accéder au Service Cloud Run

1. Aller sur : https://console.cloud.google.com/run?project=yukpo-project
2. Cliquer sur le service **`yukpo-backend`**
3. Cliquer sur l'onglet **"Variables d'environnement et secrets"** (ou **"ENVIRONMENT VARIABLES & SECRETS"**)

#### Étape 2 : Vérifier les Variables d'Environnement

Dans la section **"Variables d'environnement"**, vous devriez voir :
- `CLOUD_RUN=true`
- `ENABLE_AUTO_MIGRATIONS=true`
- `SQLX_OFFLINE=true`
- `HOST=0.0.0.0`
- `RUST_LOG=info`
- `APP_ENV=production`
- etc.

#### Étape 3 : Vérifier les Secrets

Dans la section **"Secrets"**, vous devriez voir :
- `DATABASE_URL` → Référence vers `database-url:latest`
- `JWT_SECRET` → Référence vers `jwt-secret:latest`
- `REDIS_URL` → Référence vers `redis-url:latest`
- `MONGODB_URL` → Référence vers `mongodb-url:latest`

**⚠️ IMPORTANT** : Les secrets sont référencés, pas stockés directement. Le nom du secret dans Secret Manager doit correspondre.

---

### 2. Via gcloud CLI

#### Vérifier toutes les variables d'environnement

```bash
gcloud run services describe yukpo-backend \
  --region europe-west1 \
  --format="yaml(spec.template.spec.containers[0].env)" \
  --project yukpo-project
```

#### Vérifier tous les secrets

```bash
gcloud run services describe yukpo-backend \
  --region europe-west1 \
  --format="yaml(spec.template.spec.containers[0].envFrom)" \
  --project yukpo-project
```

#### Vérifier une variable spécifique

```bash
gcloud run services describe yukpo-backend \
  --region europe-west1 \
  --format="value(spec.template.spec.containers[0].env)" \
  --project yukpo-project | grep CLOUD_RUN
```

---

### 3. Via Secret Manager

#### Lister tous les secrets

```bash
gcloud secrets list --project yukpo-project
```

#### Vérifier qu'un secret existe

```bash
# Vérifier que database-url existe
gcloud secrets describe database-url --project yukpo-project

# Vérifier que jwt-secret existe
gcloud secrets describe jwt-secret --project yukpo-project
```

#### Voir la valeur d'un secret (nécessite permissions)

```bash
# ⚠️ ATTENTION : Affiche la valeur en clair
gcloud secrets versions access latest --secret="database-url" --project yukpo-project
```

---

## 🔧 DIAGNOSTIC DU PROBLÈME

### Problème Identifié : Rust ne démarre jamais

**Symptômes** :
- Aucun log `[MAIN]` dans les logs Cloud Run
- Le wrapper s'arrête après "Port libéré, démarrage de Rust..."
- Toutes les requêtes HTTP retournent 501/502/503

**Causes possibles** :

1. **Le binaire n'existe pas dans l'image**
2. **Le binaire n'est pas exécutable**
3. **Le binaire crash immédiatement (avant le premier log)**
4. **Les variables d'environnement ne sont pas héritées par Rust**
5. **Cloud Run tue le processus avant que Rust ne démarre**

---

## ✅ CHECKLIST DE VÉRIFICATION

### 1. Vérifier que les secrets existent dans Secret Manager

```bash
# Exécuter ces commandes et vérifier que tous les secrets existent
gcloud secrets describe database-url --project yukpo-project
gcloud secrets describe jwt-secret --project yukpo-project
gcloud secrets describe redis-url --project yukpo-project
gcloud secrets describe mongodb-url --project yukpo-project
```

**Si un secret n'existe pas**, le créer :

```bash
# Exemple pour database-url
echo -n "postgresql://user:pass@/db?host=/cloudsql/..." | \
  gcloud secrets create database-url \
    --data-file=- \
    --project yukpo-project

# Donner accès au service account Cloud Run
gcloud secrets add-iam-policy-binding database-url \
  --member="serviceAccount:yukpo-backend@yukpo-project.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project yukpo-project
```

### 2. Vérifier que CLOUD_RUN est défini

```bash
gcloud run services describe yukpo-backend \
  --region europe-west1 \
  --format="value(spec.template.spec.containers[0].env)" \
  --project yukpo-project | grep CLOUD_RUN
```

**Résultat attendu** : `CLOUD_RUN=true`

### 3. Vérifier que les secrets sont référencés correctement

```bash
gcloud run services describe yukpo-backend \
  --region europe-west1 \
  --format="yaml(spec.template.spec.containers[0].envFrom)" \
  --project yukpo-project
```

**Résultat attendu** : Les secrets doivent être référencés avec les noms corrects :
- `database-url:latest`
- `jwt-secret:latest`
- etc.

### 4. Vérifier les logs du wrapper

Dans les logs Cloud Run, chercher :
- `🚀 [WRAPPER] Démarrage wrapper Cloud Run...`
- `✅ [WRAPPER] Port libéré, démarrage de Rust...`
- `🔍 [WRAPPER] Étape 1: Vérification existence du binaire Rust...`
- `🔍 [WRAPPER] Étape 2: Vérification exécutabilité du binaire...`
- `🔍 [WRAPPER] Étape 3: Test d'exécution du binaire...`
- `🚀 [WRAPPER] Étape 4: Démarrage application Rust...`

**Si les logs s'arrêtent à une étape**, c'est là que le problème se situe.

### 5. Vérifier les logs Rust

Dans les logs Cloud Run, chercher :
- `[MAIN] 🚀 Application Rust démarre - Point d'entrée atteint`
- `[MAIN] 🔍 Vérification des variables d'environnement critiques...`
- `[MAIN] DATABASE_URL: ✅ Présente`

**Si aucun log Rust n'apparaît**, Rust ne démarre pas ou crash immédiatement.

---

## 🔧 COMMANDES DE DIAGNOSTIC COMPLÈTES

### Script de diagnostic complet

```bash
#!/bin/bash
# Script de diagnostic Cloud Run

PROJECT_ID="yukpo-project"
SERVICE_NAME="yukpo-backend"
REGION="europe-west1"

echo "🔍 DIAGNOSTIC CLOUD RUN - $SERVICE_NAME"
echo "========================================"

echo ""
echo "1. Variables d'environnement :"
gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format="yaml(spec.template.spec.containers[0].env)" \
  --project $PROJECT_ID

echo ""
echo "2. Secrets référencés :"
gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format="yaml(spec.template.spec.containers[0].envFrom)" \
  --project $PROJECT_ID

echo ""
echo "3. Secrets dans Secret Manager :"
gcloud secrets list --project $PROJECT_ID | grep -E "(database-url|jwt-secret|redis-url|mongodb-url)"

echo ""
echo "4. Vérification CLOUD_RUN :"
gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format="value(spec.template.spec.containers[0].env)" \
  --project $PROJECT_ID | grep CLOUD_RUN || echo "❌ CLOUD_RUN non trouvé"

echo ""
echo "5. Derniers logs (20 dernières lignes) :"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" \
  --limit 20 \
  --format="table(timestamp,severity,textPayload)" \
  --project $PROJECT_ID
```

---

## 🚨 PROBLÈMES COURANTS ET SOLUTIONS

### Problème 1 : Secret n'existe pas dans Secret Manager

**Erreur** : `Secret [database-url] not found`

**Solution** :
```bash
# Créer le secret
echo -n "valeur-du-secret" | gcloud secrets create database-url \
  --data-file=- \
  --project yukpo-project

# Donner accès au service account
gcloud secrets add-iam-policy-binding database-url \
  --member="serviceAccount:yukpo-backend@yukpo-project.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project yukpo-project
```

### Problème 2 : Secret existe mais nom incorrect

**Erreur** : Le workflow référence `database-url:latest` mais le secret s'appelle `DATABASE_URL`

**Solution** : Soit renommer le secret, soit modifier le workflow pour utiliser le bon nom.

### Problème 3 : CLOUD_RUN n'est pas défini

**Symptôme** : Le wrapper ne démarre pas (l'ENTRYPOINT vérifie `CLOUD_RUN=true`)

**Solution** : Vérifier que `CLOUD_RUN=true` est dans les variables d'environnement de Cloud Run.

### Problème 4 : Variables d'environnement non héritées

**Symptôme** : Rust ne voit pas les variables (logs montrent `❌ MANQUANTE`)

**Solution** : Vérifier que les secrets sont bien montés comme variables, pas comme fichiers.

---

**Date** : 2026-02-17

