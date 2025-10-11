#!/usr/bin/env bash
# Script EAS Build hook qui s'exécute AVANT npm install
# Pas besoin de corriger les exports ici car ils seront corrigés par postinstall
echo "✅ EAS Build pre-install hook executed"
exit 0

