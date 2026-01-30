#!/bin/bash
# Script pour executer les scripts de diagnostic et correction AWS depuis une instance EC2
# Date: 2026-01-30
# Usage: ./execute_diagnostic_fix_aws_ec2.sh

set -e

echo "============================================================"
echo "Execution des scripts de diagnostic et correction AWS"
echo "============================================================"
echo ""

# Recuperer DATABASE_URL depuis l'environnement ou AWS Secrets Manager
if [ -z "$DATABASE_URL" ]; then
    echo "Recuperation de DATABASE_URL depuis AWS Secrets Manager..."
    
    # Essayer de recuperer depuis Secrets Manager
    if command -v aws &> /dev/null; then
        SECRET_NAME="yukpomnang/backend/secrets"
        REGION="us-east-1"
        
        SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id "$SECRET_NAME" --region "$REGION" --query SecretString --output text 2>/dev/null || echo "")
        
        if [ -n "$SECRET_JSON" ]; then
            export DATABASE_URL=$(echo "$SECRET_JSON" | jq -r '.DATABASE_URL')
            echo "DATABASE_URL recuperee depuis Secrets Manager"
        else
            echo "ERREUR: Impossible de recuperer DATABASE_URL depuis Secrets Manager"
            echo "   Definissez DATABASE_URL manuellement:"
            echo "   export DATABASE_URL='postgresql://user:pass@host:5432/db'"
            exit 1
        fi
    else
        echo "ERREUR: AWS CLI non installe et DATABASE_URL non definie"
        echo "   Installez AWS CLI ou definissez DATABASE_URL:"
        echo "   export DATABASE_URL='postgresql://user:pass@host:5432/db'"
        exit 1
    fi
else
    echo "DATABASE_URL trouvee dans l'environnement"
fi

echo ""

# Verifier que psql est installe
if ! command -v psql &> /dev/null; then
    echo "ERREUR: psql n'est pas installe"
    echo "   Installez PostgreSQL client:"
    echo "   sudo yum install postgresql15 -y  # Amazon Linux"
    echo "   sudo apt-get install postgresql-client -y  # Ubuntu"
    exit 1
fi

echo "psql trouve: $(which psql)"
echo ""

# Chemin des scripts
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIAGNOSTIC_SCRIPT="$SCRIPT_DIR/diagnostic_migrations_aws.sql"
FIX_SCRIPT="$SCRIPT_DIR/fix_migrations_aws.sql"

# Verifier que les scripts existent
if [ ! -f "$DIAGNOSTIC_SCRIPT" ]; then
    echo "ERREUR: Script de diagnostic non trouve: $DIAGNOSTIC_SCRIPT"
    exit 1
fi

if [ ! -f "$FIX_SCRIPT" ]; then
    echo "ERREUR: Script de correction non trouve: $FIX_SCRIPT"
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

if psql "$DATABASE_URL" -f "$DIAGNOSTIC_SCRIPT" 2>&1; then
    echo ""
    echo "Diagnostic termine avec succes"
else
    echo ""
    echo "Diagnostic termine avec des erreurs (continuation...)"
fi
echo ""

# Demander confirmation avant d'appliquer les corrections
echo "============================================================"
echo "ATTENTION: Le script de correction va modifier la base de donnees"
echo "============================================================"
echo ""

if [ "$AUTO_CONFIRM" != "true" ]; then
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

if psql "$DATABASE_URL" -f "$FIX_SCRIPT" 2>&1; then
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

if psql "$DATABASE_URL" -f "$DIAGNOSTIC_SCRIPT" 2>&1; then
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


