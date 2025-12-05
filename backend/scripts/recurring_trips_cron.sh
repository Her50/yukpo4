#!/bin/bash
# ✅ Script pour exécuter la tâche cron des trajets récurrents
# Date: 2025-01-29
# Usage: ./scripts/recurring_trips_cron.sh [action] [days_ahead]

set -e

ACTION=${1:-"full"}
DAYS_AHEAD=${2:-""}

cd "$(dirname "$0")/.."

echo "🚀 Exécution tâche cron trajets récurrents: $ACTION"

if [ -z "$DAYS_AHEAD" ]; then
    cargo run --bin recurring_trips_cron --release -- $ACTION
else
    cargo run --bin recurring_trips_cron --release -- $ACTION $DAYS_AHEAD
fi

echo "✅ Tâche terminée"

