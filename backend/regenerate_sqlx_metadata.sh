#!/bin/bash

# Script pour régénérer les métadonnées SQLx
# Nécessite une connexion à la base de données

echo "=== Régénération des métadonnées SQLx ==="

# Vérifier que DATABASE_URL est défini
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERREUR: DATABASE_URL n'est pas défini"
    echo "Définissez DATABASE_URL avant d'exécuter ce script"
    exit 1
fi

echo "✅ DATABASE_URL est défini"

# Désactiver le mode offline temporairement
export SQLX_OFFLINE=false

# Installer sqlx-cli si nécessaire
if ! command -v sqlx &> /dev/null; then
    echo "Installation de sqlx-cli..."
    cargo install sqlx-cli --no-default-features --features postgres
fi

# Appliquer les migrations
echo "1. Application des migrations..."
sqlx migrate run

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de l'application des migrations"
    exit 1
fi

# Générer les métadonnées
echo "2. Génération des métadonnées SQLx..."
cargo sqlx prepare --workspace

if [ $? -eq 0 ]; then
    echo "✅ Métadonnées générées avec succès"
    echo "📁 Fichiers créés dans .sqlx/"
    
    # Compter les fichiers
    if [ -d ".sqlx" ]; then
        COUNT=$(find .sqlx -name "*.json" | wc -l)
        echo "📊 Nombre de fichiers de métadonnées: $COUNT"
    fi
    
    echo ""
    echo "✅ Régénération terminée avec succès"
    echo "💡 N'oubliez pas de commiter les fichiers .sqlx/"
else
    echo "❌ Erreur lors de la génération des métadonnées"
    exit 1
fi

