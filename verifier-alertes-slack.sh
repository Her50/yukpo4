#!/bin/bash
# Script de verification de l'integration des alertes Slack

BACKEND_URL="https://yukpomnang.onrender.com"

echo "=== VERIFICATION ALERTES SLACK ==="
echo ""

echo "1. VERIFICATION CODE INTEGRE"
echo "----------------------------"

# Vérifier que les fichiers existent
if [ -f "backend/src/tasks/pipeline_health_worker.rs" ]; then
    echo "OK: pipeline_health_worker.rs existe"
    
    # Vérifier que PIPELINE_ALERT_WEBHOOK est utilisé
    if grep -q "PIPELINE_ALERT_WEBHOOK" backend/src/tasks/pipeline_health_worker.rs; then
        echo "OK: PIPELINE_ALERT_WEBHOOK utilise dans le code"
    else
        echo "ERREUR: PIPELINE_ALERT_WEBHOOK non trouve"
    fi
else
    echo "ERREUR: pipeline_health_worker.rs non trouve"
fi

if [ -f "backend/src/tasks/delivery_sla_monitor.rs" ]; then
    echo "OK: delivery_sla_monitor.rs existe"
    
    # Vérifier que SLA_ALERT_WEBHOOK est utilisé
    if grep -q "SLA_ALERT_WEBHOOK" backend/src/tasks/delivery_sla_monitor.rs; then
        echo "OK: SLA_ALERT_WEBHOOK utilise dans le code"
    else
        echo "ERREUR: SLA_ALERT_WEBHOOK non trouve"
    fi
else
    echo "ERREUR: delivery_sla_monitor.rs non trouve"
fi

# Vérifier que les workers sont démarrés dans main.rs
if grep -q "start_pipeline_health_worker" backend/src/main.rs; then
    echo "OK: Pipeline health worker demarre dans main.rs"
else
    echo "ERREUR: Pipeline health worker non demarre"
fi

if grep -q "start_delivery_sla_monitor" backend/src/main.rs; then
    echo "OK: Delivery SLA monitor demarre dans main.rs"
else
    echo "ERREUR: Delivery SLA monitor non demarre"
fi

echo ""
echo "2. VERIFICATION CONFIGURATION RENDER"
echo "------------------------------------"
echo "Variables a configurer sur Render:"
echo "  - PIPELINE_ALERT_WEBHOOK (pour alertes pipeline)"
echo "  - SLA_ALERT_WEBHOOK (pour alertes SLA delivery)"
echo ""
echo "Pour verifier sur Render:"
echo "  1. Aller sur https://dashboard.render.com"
echo "  2. Service 'yukpomnang' → Environment"
echo "  3. Verifier que les variables sont configurees"
echo ""

echo "3. VERIFICATION FONCTIONNEMENT"
echo "------------------------------"
echo "Les workers sont actifs si:"
echo "  - Les variables sont configurees sur Render"
echo "  - Le service est redemarre"
echo "  - Les logs montrent:"
echo "    * [PipelineWorker] ..."
echo "    * [DeliverySLA] ..."
echo ""

echo "4. TEST DES ALERTES"
echo "-------------------"
echo "Pour tester les alertes:"
echo "  1. Attendre qu'un probleme se produise (pipeline degraded, SLA depasse)"
echo "  2. Ou forcer un test (developpement uniquement)"
echo "  3. Verifier que les messages arrivent dans Slack"
echo ""

