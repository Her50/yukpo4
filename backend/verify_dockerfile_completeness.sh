#!/bin/bash
# Script de vérification : tous les fichiers utilisés dans le code sont-ils copiés dans le Dockerfile ?

echo "🔍 Vérification de la complétude du Dockerfile..."
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Extraire les chemins de fichiers depuis le code source
echo "📂 Extraction des chemins de fichiers depuis le code Rust..."
PATHS=$(grep -rE 'read_to_string\(|include_str!\(|File::open\(' src/ | grep -oP '["](.*?)["]' | sed 's/"//g' | grep -E '\.(md|json|toml|txt)$' | sort | uniq)

echo "✅ Chemins trouvés dans le code :"
echo "$PATHS"
echo ""

# Extraire ce qui est copié dans le Dockerfile
echo "📋 Extraction des COPY depuis le Dockerfile..."
COPIED=$(grep '^COPY' Dockerfile | awk '{print $2}')

echo "✅ Éléments copiés dans le Dockerfile :"
echo "$COPIED"
echo ""

# Vérification
echo "🔍 Vérification de la correspondance..."
MISSING=0

for path in $PATHS; do
    # Normaliser le chemin (retirer backend/ si présent)
    normalized_path=$(echo "$path" | sed 's|^backend/||')
    
    # Extraire le premier dossier/fichier
    first_part=$(echo "$normalized_path" | cut -d'/' -f1)
    
    # Vérifier si copié
    if echo "$COPIED" | grep -q "$first_part"; then
        echo -e "${GREEN}✅${NC} $path → Copié via '$first_part'"
    else
        echo -e "${RED}❌${NC} $path → MANQUANT dans Dockerfile !"
        MISSING=$((MISSING + 1))
    fi
done

echo ""
if [ $MISSING -eq 0 ]; then
    echo -e "${GREEN}🎉 Tous les fichiers sont correctement copiés !${NC}"
    exit 0
else
    echo -e "${RED}⚠️  $MISSING fichier(s) manquant(s) dans le Dockerfile !${NC}"
    exit 1
fi

