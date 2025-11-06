#!/bin/bash
# Script d'aide pour ajouter un nouveau fichier au Dockerfile

if [ $# -eq 0 ]; then
    echo "Usage: bash add_file_to_dockerfile.sh <chemin/fichier>"
    echo "Exemple: bash add_file_to_dockerfile.sh templates/email.html"
    exit 1
fi

FILE=$1
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 Vérification du fichier: $FILE"
echo ""

# Vérifier si le fichier existe
if [ ! -f "$FILE" ]; then
    echo -e "${RED}❌ Erreur: Le fichier $FILE n'existe pas !${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Fichier trouvé${NC}"
echo ""

# Extraire le dossier parent
DIR=$(dirname "$FILE")

# Vérifier si le dossier parent est déjà copié
echo "🔍 Vérification du Dockerfile..."
if grep -q "COPY $DIR" Dockerfile; then
    echo -e "${GREEN}✅ Le dossier '$DIR/' est déjà copié dans le Dockerfile${NC}"
    echo "   → Votre fichier sera automatiquement inclus !"
    exit 0
fi

# Si c'est un fichier à la racine
if [ "$DIR" == "." ]; then
    echo -e "${YELLOW}⚠️  Le fichier est à la racine${NC}"
    echo ""
    echo "Ajoutez cette ligne au Dockerfile (après les autres COPY) :"
    echo ""
    echo -e "${GREEN}COPY $FILE ./${NC}"
    echo ""
else
    # Proposer de copier le dossier entier ou juste le fichier
    echo -e "${YELLOW}⚠️  Le dossier '$DIR/' n'est pas encore copié${NC}"
    echo ""
    echo "Option 1 (recommandé) : Copier tout le dossier"
    echo -e "${GREEN}COPY $DIR ./$DIR${NC}"
    echo ""
    echo "Option 2 : Copier seulement ce fichier"
    echo -e "${GREEN}COPY $FILE ./$FILE${NC}"
fi

echo ""
echo "📝 Après modification du Dockerfile, n'oubliez pas :"
echo "   1. bash verify_dockerfile_completeness.sh"
echo "   2. docker build -t test-yukpo ."
echo "   3. git add Dockerfile $FILE"
echo "   4. git commit -m \"feat: Ajouter $FILE\""

