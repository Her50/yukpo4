#!/bin/bash

# Script de build personnalisé pour Render
# Ce script configure la base de données puis compile l'application

echo "=== Build Yukpomnang Backend ==="

# Étape 1: Configuration de la base de données
echo "1. Configuration de la base de données..."
if [ -f "scripts/setup-database.sh" ]; then
    chmod +x scripts/setup-database.sh
    ./scripts/setup-database.sh
    if [ $? -ne 0 ]; then
        echo "Erreur lors de la configuration de la base de données"
        exit 1
    fi
else
    echo "Script de configuration de base de données non trouvé"
fi

# Étape 2: Compilation avec Cargo
echo "2. Compilation de l'application..."
echo "Mode SQLx: En ligne (vérification de la base de données)"
# Désactivation de SQLX_OFFLINE pour permettre la vérification des migrations
cargo build --release

if [ $? -eq 0 ]; then
    echo "✓ Compilation réussie"
    echo "=== Build terminé avec succès ==="
else
    echo "✗ Erreur lors de la compilation"
    exit 1
fi
