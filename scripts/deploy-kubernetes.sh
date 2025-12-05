#!/bin/bash
# ✅ Phase 2: Script de déploiement Kubernetes complet

set -e

NAMESPACE="yukpomnang"

echo "🚀 Déploiement Kubernetes - Yukpomnang"
echo "=================================================="

# ✅ Créer le namespace
echo "📦 Création du namespace..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# ✅ Appliquer les secrets (doit exister)
if [ -f "deployment/kubernetes/secrets.yaml" ]; then
    echo "🔐 Application des secrets..."
    kubectl apply -f deployment/kubernetes/secrets.yaml
else
    echo "⚠️  secrets.yaml non trouvé - créer depuis secrets.yaml.example"
    echo "   cp deployment/kubernetes/secrets.yaml.example deployment/kubernetes/secrets.yaml"
    echo "   Puis remplir avec vos valeurs réelles"
    exit 1
fi

# ✅ Appliquer le ConfigMap
echo "⚙️  Application du ConfigMap..."
kubectl apply -f deployment/kubernetes/configmap.yaml

# ✅ Déployer Redis (si pas déjà déployé)
echo "📦 Déploiement Redis..."
kubectl apply -f deployment/kubernetes/redis-deployment.yaml

# ✅ Attendre que Redis soit prêt
echo "⏳ Attente que Redis soit prêt..."
kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=300s

# ✅ Déployer le backend
echo "📦 Déploiement du backend..."
kubectl apply -f deployment/kubernetes/deployment.yaml

# ✅ Appliquer le HPA
echo "📈 Application du HPA..."
kubectl apply -f deployment/kubernetes/hpa.yaml

# ✅ Appliquer l'Ingress (si nécessaire)
if [ -f "deployment/kubernetes/ingress.yaml" ]; then
    echo "🌐 Application de l'Ingress..."
    kubectl apply -f deployment/kubernetes/ingress.yaml
fi

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

