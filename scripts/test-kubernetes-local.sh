#!/bin/bash
# ✅ Script pour tester Kubernetes localement (minikube/kind)

set -e

echo "🔍 Test de Kubernetes local"
echo "=================================================="

# ✅ Vérifier que kubectl est disponible
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl n'est pas installé"
    echo "   Installer: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi

# ✅ Vérifier le contexte Kubernetes
echo "📊 Contexte Kubernetes actuel:"
kubectl config current-context

# ✅ Vérifier la connexion
echo ""
echo "🔍 Test de connexion..."
kubectl cluster-info

if [ $? -eq 0 ]; then
    echo "✅ Connexion Kubernetes réussie"
    
    # ✅ Vérifier les nodes
    echo ""
    echo "📊 Nodes disponibles:"
    kubectl get nodes
    
    # ✅ Vérifier les namespaces
    echo ""
    echo "📊 Namespaces:"
    kubectl get namespaces
    
    # ✅ Tester le déploiement (dry-run)
    echo ""
    echo "🔍 Test de déploiement (dry-run)..."
    if [ -f "deployment/kubernetes/deployment.yaml" ]; then
        kubectl apply --dry-run=client -f deployment/kubernetes/deployment.yaml
        if [ $? -eq 0 ]; then
            echo "✅ Déploiement validé (dry-run)"
        else
            echo "⚠️  Erreur dans le déploiement"
        fi
    fi
    
    echo ""
    echo "✅ Tests Kubernetes terminés!"
else
    echo "❌ Échec de la connexion Kubernetes"
    exit 1
fi

