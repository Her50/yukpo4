#!/bin/bash
# Script pour executer les scripts de diagnostic/correction depuis AWS CloudShell
# Date: 2026-01-30
# Usage: Copiez ce script dans AWS CloudShell et executez-le

set -e

echo "============================================================"
echo "Execution des scripts de diagnostic et correction AWS"
echo "Depuis AWS CloudShell"
echo "============================================================"
echo ""

# DATABASE_URL
export DATABASE_URL="postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/yukpomnang?sslmode=require"
export PGPASSWORD="SztViedrXvuBDyj16TWaIAs25FfUColh"

# Installer psql si necessaire
if ! command -v psql &> /dev/null; then
    echo "Installation de PostgreSQL client..."
    sudo yum install -y postgresql15 || sudo apt-get update && sudo apt-get install -y postgresql-client
fi

echo "psql trouve: $(which psql)"
echo ""

# Cloner le repo si necessaire
REPO_DIR="$HOME/yukpomnang2"
if [ ! -d "$REPO_DIR" ]; then
    echo "Clonage du repo..."
    # Remplacez par votre URL de repo
    echo "ERREUR: Repo non clone. Clonez manuellement:"
    echo "  git clone <votre-repo-url> $REPO_DIR"
    echo "  ou telechargez les scripts SQL manuellement"
    exit 1
fi

cd "$REPO_DIR/backend/scripts"

# Verifier que les scripts existent
if [ ! -f "diagnostic_migrations_aws.sql" ]; then
    echo "ERREUR: Script diagnostic_migrations_aws.sql non trouve"
    exit 1
fi

if [ ! -f "fix_migrations_aws.sql" ]; then
    echo "ERREUR: Script fix_migrations_aws.sql non trouve"
    exit 1
fi

echo "Scripts trouves"
echo ""

# ============================================================================
# ETAPE 1: DIAGNOSTIC
# ============================================================================
echo "============================================================"
echo "ETAPE 1: DIAGNOSTIC"
echo "============================================================"
echo ""

echo "Execution du script de diagnostic..."
echo ""

if psql "$DATABASE_URL" -f diagnostic_migrations_aws.sql; then
    echo ""
    echo "Diagnostic termine avec succes"
else
    echo ""
    echo "Diagnostic termine avec des erreurs (continuation...)"
fi
echo ""

# Demander confirmation
if [ "$AUTO_CONFIRM" != "true" ]; then
    echo "============================================================"
    echo "ATTENTION: Le script de correction va modifier la base de donnees"
    echo "============================================================"
    echo ""
    read -p "Voulez-vous continuer avec le script de correction? (O/N): " confirmation
    if [ "$confirmation" != "O" ] && [ "$confirmation" != "o" ] && [ "$confirmation" != "Y" ] && [ "$confirmation" != "y" ]; then
        echo ""
        echo "Operation annulee par l'utilisateur"
        exit 0
    fi
    echo ""
else
    echo "Auto-confirmation activee, continuation automatique..."
    echo ""
fi

# ============================================================================
# ETAPE 2: CORRECTION
# ============================================================================
echo "============================================================"
echo "ETAPE 2: CORRECTION"
echo "============================================================"
echo ""

echo "Execution du script de correction..."
echo ""

if psql "$DATABASE_URL" -f fix_migrations_aws.sql; then
    echo ""
    echo "Correction terminee avec succes"
else
    echo ""
    echo "Correction terminee avec des erreurs"
    exit 1
fi
echo ""

# ============================================================================
# ETAPE 3: VERIFICATION FINALE
# ============================================================================
echo "============================================================"
echo "ETAPE 3: VERIFICATION FINALE"
echo "============================================================"
echo ""

echo "Execution du diagnostic final..."
echo ""

if psql "$DATABASE_URL" -f diagnostic_migrations_aws.sql; then
    echo ""
    echo "Verification finale terminee"
else
    echo ""
    echo "Verification finale terminee avec des erreurs"
fi
echo ""

echo "============================================================"
echo "PROCESSUS TERMINE"
echo "============================================================"
echo ""
echo "Prochaines etapes:"
echo "   1. Examiner les resultats ci-dessus"
echo "   2. Verifier les logs de l'application"
echo "   3. Tester les fonctionnalites critiques"
echo ""


