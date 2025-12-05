#!/bin/bash
# ✅ Script pour déployer en staging

set -e

NAMESPACE="${NAMESPACE:-yukpomnang-staging}"
ENVIRONMENT="${ENVIRONMENT:-staging}"

echo "🚀 Déploiement en Staging"
echo "=================================================="
echo "Namespace: $NAMESPACE"
echo "Environment: $ENVIRONMENT"
echo ""

# ✅ Créer le namespace
echo "📦 Création du namespace..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# ✅ Appliquer les secrets (doit exister)
if [ -f "deployment/kubernetes/secrets.yaml" ]; then
    echo "🔐 Application des secrets..."
    kubectl apply -f deployment/kubernetes/secrets.yaml -n $NAMESPACE
else
    echo "⚠️  secrets.yaml non trouvé - créer depuis secrets.yaml.example"
    exit 1
fi

# ✅ Appliquer le ConfigMap
echo "⚙️  Application du ConfigMap..."
kubectl apply -f deployment/kubernetes/configmap.yaml -n $NAMESPACE

# ✅ Déployer Redis (si pas déjà déployé)
echo "📦 Déploiement Redis..."
kubectl apply -f deployment/kubernetes/redis-deployment.yaml -n $NAMESPACE

# ✅ Attendre que Redis soit prêt
echo "⏳ Attente que Redis soit prêt..."
kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=300s || echo "⚠️  Redis pas encore prêt"

# ✅ Déployer le backend
echo "📦 Déploiement du backend..."
kubectl apply -f deployment/kubernetes/deployment.yaml -n $NAMESPACE

# ✅ Appliquer le HPA
echo "📈 Application du HPA..."
kubectl apply -f deployment/kubernetes/hpa.yaml -n $NAMESPACE

# ✅ Vérifier le déploiement
echo ""
echo "✅ Déploiement terminé!"
echo ""
echo "📊 Statut des pods:"
kubectl get pods -n $NAMESPACE

echo ""
echo "📊 Statut des services:"
kubectl get services -n $NAMESPACE

echo ""
echo "📊 Statut du HPA:"
kubectl get hpa -n $NAMESPACE

echo ""
echo "🔍 Logs du backend:"
echo "kubectl logs -f deployment/yukpomnang-backend -n $NAMESPACE"

