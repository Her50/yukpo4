#!/usr/bin/env bash
# ============================================================
#  setup-gcp-wif.sh — Configuration Workload Identity Federation
#  À exécuter UNE SEULE FOIS depuis un poste ayant gcloud + les droits Owner/Admin GCP
#
#  Résultat : plus aucune clé JSON à stocker ni à faire tourner.
#  GitHub s'authentifie via OIDC token éphémère (sécurité maximale).
#
#  Usage:
#    chmod +x scripts/setup-gcp-wif.sh
#    ./scripts/setup-gcp-wif.sh
# ============================================================
set -euo pipefail

# ── Configuration ────────────────────────────────────────────
PROJECT_ID="yukpo-project"
GITHUB_REPO="Her50/yukpo4"           # format: owner/repo
SA_NAME="github-actions-deployer"
SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
POOL_NAME="github-actions-pool"
PROVIDER_NAME="github-provider"
REGION="europe-west1"
# ─────────────────────────────────────────────────────────────

echo "╔══════════════════════════════════════════════════════╗"
echo "║   Setup Workload Identity Federation — Yukpo GCP    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Projet        : $PROJECT_ID"
echo "Dépôt GitHub  : $GITHUB_REPO"
echo "Compte service: $SA_EMAIL"
echo ""

# ── 0. Vérifications préalables ──────────────────────────────
if ! command -v gcloud &>/dev/null; then
  echo "❌ gcloud CLI non trouvé. Installez-le : https://cloud.google.com/sdk/docs/install"
  exit 1
fi

gcloud config set project "$PROJECT_ID" --quiet
echo "✅ Projet GCP actif : $PROJECT_ID"

# Activer les APIs nécessaires
echo ""
echo "📡 Activation des APIs GCP nécessaires..."
gcloud services enable \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project="$PROJECT_ID" --quiet
echo "✅ APIs activées"

# ── 1. Compte de service ─────────────────────────────────────
echo ""
echo "👤 Vérification du compte de service..."
if gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" &>/dev/null; then
  echo "✅ Compte de service existant : $SA_EMAIL"
else
  echo "➕ Création du compte de service..."
  gcloud iam service-accounts create "$SA_NAME" \
    --display-name="GitHub Actions Deployer (WIF)" \
    --description="Compte pour le déploiement CI/CD via Workload Identity Federation" \
    --project="$PROJECT_ID"
  echo "✅ Compte de service créé"
fi

# ── 2. Rôles IAM ─────────────────────────────────────────────
echo ""
echo "🔐 Attribution des rôles IAM..."
ROLES=(
  "roles/run.admin"                      # Déploiement Cloud Run
  "roles/artifactregistry.writer"        # Push images Docker
  "roles/storage.admin"                  # Accès GCS (médias, backups)
  "roles/cloudsql.client"               # Connexion Cloud SQL
  "roles/secretmanager.secretAccessor"  # Lecture secrets GCP
  "roles/iam.serviceAccountUser"        # Impersonation SA par Cloud Run
  "roles/iam.serviceAccountTokenCreator" # Génération tokens OIDC
  "roles/compute.viewer"                # Lecture instances VM (GPU)
)

for ROLE in "${ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$ROLE" \
    --condition=None \
    --quiet 2>/dev/null && echo "  ✅ $ROLE" || echo "  ⚠️  $ROLE (déjà présent ou erreur)"
done

# ── 3. Pool Workload Identity ────────────────────────────────
echo ""
echo "🏊 Configuration du Workload Identity Pool..."
if gcloud iam workload-identity-pools describe "$POOL_NAME" \
    --location="global" --project="$PROJECT_ID" &>/dev/null; then
  echo "✅ Pool existant : $POOL_NAME"
else
  gcloud iam workload-identity-pools create "$POOL_NAME" \
    --project="$PROJECT_ID" \
    --location="global" \
    --display-name="GitHub Actions Pool" \
    --description="Pool pour l'authentification GitHub Actions via OIDC"
  echo "✅ Pool créé : $POOL_NAME"
fi

# ── 4. Provider OIDC GitHub ──────────────────────────────────
echo ""
echo "🔗 Configuration du Provider OIDC GitHub..."
if gcloud iam workload-identity-pools providers describe "$PROVIDER_NAME" \
    --workload-identity-pool="$POOL_NAME" \
    --location="global" --project="$PROJECT_ID" &>/dev/null; then
  echo "⚙️  Provider existant, mise à jour..."
  gcloud iam workload-identity-pools providers update-oidc "$PROVIDER_NAME" \
    --project="$PROJECT_ID" \
    --location="global" \
    --workload-identity-pool="$POOL_NAME" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository=='$GITHUB_REPO'"
else
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_NAME" \
    --project="$PROJECT_ID" \
    --location="global" \
    --workload-identity-pool="$POOL_NAME" \
    --display-name="GitHub OIDC Provider" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository=='$GITHUB_REPO'"
fi
echo "✅ Provider OIDC configuré (réservé à $GITHUB_REPO uniquement)"

# ── 5. Binding SA ↔ Pool ────────────────────────────────────
echo ""
echo "🔑 Liaison Compte de service ↔ Pool WIF..."
POOL_RESOURCE=$(gcloud iam workload-identity-pools describe "$POOL_NAME" \
  --project="$PROJECT_ID" \
  --location="global" \
  --format="value(name)")

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/$POOL_RESOURCE/attribute.repository/$GITHUB_REPO" \
  --condition=None --quiet
echo "✅ Binding effectué"

# ── 6. Récupération des valeurs pour GitHub Secrets ─────────
echo ""
echo "════════════════════════════════════════════════════════"
echo "   ✅ SETUP TERMINÉ — COPIE CES VALEURS DANS GITHUB"
echo "════════════════════════════════════════════════════════"
echo ""

PROVIDER_RESOURCE=$(gcloud iam workload-identity-pools providers describe "$PROVIDER_NAME" \
  --workload-identity-pool="$POOL_NAME" \
  --location="global" \
  --project="$PROJECT_ID" \
  --format="value(name)")

echo "Dans GitHub → Settings → Secrets and variables → Actions :"
echo ""
echo "  Secret name                    │ Value"
echo "  ───────────────────────────────┼────────────────────────────────────────"
echo "  GCP_WORKLOAD_IDENTITY_PROVIDER │ $PROVIDER_RESOURCE"
echo "  GCP_SERVICE_ACCOUNT_EMAIL      │ $SA_EMAIL"
echo "  GCP_PROJECT_ID                 │ $PROJECT_ID"
echo ""
echo "⚠️  Supprimer le secret GCP_SA_KEY de GitHub (plus nécessaire)"
echo ""
echo "Puis relancer le workflow : gh workflow run gcp-deploy.yml --repo $GITHUB_REPO"
