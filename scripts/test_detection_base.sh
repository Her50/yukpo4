#!/bin/bash
# Script pour tester la logique exacte de détection de la base

export PGPASSWORD='PYvHBVetTuWIKNkXgqJcFiU48D39SLwd'
DB_HOST='yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com'
DB_USER='yukpo_admin'
DB_NAME='yukpo'

echo "========================================"
echo "TEST DE LA LOGIQUE DE DETECTION"
echo "========================================"
echo ""

# Simuler exactement ce que fait start-cloud.sh
ADMIN_DB_URL="postgresql://${DB_USER}:${PGPASSWORD}@${DB_HOST}:5432/postgres"

echo "1. ADMIN_DB_URL (connexion a postgres):"
echo "   postgresql://${DB_USER}:***@${DB_HOST}:5432/postgres"
echo ""

echo "2. Test de connexion a la base postgres..."
psql "$ADMIN_DB_URL" -c "SELECT current_database(), current_user;" 2>&1
echo ""

echo "3. Test de la requete avec -tAc (comme dans start-cloud.sh)..."
DB_EXISTS_OUTPUT=$(psql "$ADMIN_DB_URL" -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>&1)
echo "Sortie brute: [$DB_EXISTS_OUTPUT]"
echo ""

echo "4. Filtrage (grep -v ERROR | tr -d '[:space:]')..."
DB_EXISTS=$(echo "$DB_EXISTS_OUTPUT" | grep -v "ERROR" | tr -d '[:space:]' || echo "")
echo "Resultat apres filtrage: [$DB_EXISTS]"
echo ""

echo "5. Comparaison avec '1'..."
if [ "$DB_EXISTS" = "1" ]; then
    echo "SUCCES: La base est detectee (DB_EXISTS = 1)"
else
    echo "ERREUR: La base n'est pas detectee (DB_EXISTS != 1)"
    echo "Valeur de DB_EXISTS: [$DB_EXISTS]"
    echo "Longueur: ${#DB_EXISTS}"
    echo "Caracteres (hex): $(echo -n "$DB_EXISTS" | xxd -p 2>/dev/null || echo 'xxd non disponible')"
fi
echo ""

echo "6. Test sans -tAc pour comparaison..."
psql "$ADMIN_DB_URL" -c "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}';" 2>&1
echo ""

echo "7. Test direct de connexion a yukpo..."
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT current_database(), current_user;" 2>&1

