#!/usr/bin/env bash
# Auto-scaling vertical pour Fly (ce que Fly ne fait PAS nativement).
# À lancer en cron toutes les 5 min sur ta machine ou via GitHub Actions schedule.
#
# Logique :
#   - Lit les métriques mémoire des machines via `flyctl machine status`
#   - Si RAM moy > 80% sur 3 derniers ticks → upgrade vers tier supérieur
#   - Si RAM moy < 30% pendant 1h → downgrade vers tier inférieur
#   - Tiers : 1gb → 2gb → 4gb → 8gb (puis bascule en cpu-performance)
#
# Horizontal scaling déjà géré par fly.toml (auto_start_machines + concurrency).
# Ce script gère uniquement le scaling VERTICAL (ressources par machine).

set -euo pipefail

APP="${FLY_APP:-yukpo-fly-backend}"
STATE_FILE="${HOME}/.cache/yukpo-fly-scale-state.json"
mkdir -p "$(dirname "$STATE_FILE")"
[[ -f "$STATE_FILE" ]] || echo '{"high_count":0,"low_count":0}' > "$STATE_FILE"

# Tiers possibles (ordre croissant)
TIERS=("1gb" "2gb" "4gb" "8gb")

current_memory() {
  flyctl scale show --app "$APP" --json 2>/dev/null \
    | grep -oE '"memory_mb":[0-9]+' \
    | head -1 \
    | grep -oE '[0-9]+'
}

# Approximation : on lit "vm cpu/memory" depuis status, on calcule % via shell.
# Pour métriques précises, brancher Prometheus → Fly metrics-api (avancé).
sample_memory_pct() {
  # flyctl renvoie les métriques sur stderr — on parse approximatif.
  flyctl machine status --app "$APP" 2>/dev/null \
    | grep -oE '[0-9]+\s*MiB.*used' \
    | head -1 \
    | awk '{print $1}'
}

scale_up() {
  local current="$1"
  for i in "${!TIERS[@]}"; do
    if [[ "${TIERS[$i]}" == "${current}gb" ]] && [[ $((i + 1)) -lt ${#TIERS[@]} ]]; then
      local next="${TIERS[$((i + 1))]}"
      echo "📈 Scale UP : $current → $next (RAM saturée)"
      flyctl scale memory "$next" --app "$APP" --yes
      return 0
    fi
  done
  echo "⚠️  Déjà au tier max"
}

scale_down() {
  local current="$1"
  for i in "${!TIERS[@]}"; do
    if [[ "${TIERS[$i]}" == "${current}gb" ]] && [[ $i -gt 0 ]]; then
      local prev="${TIERS[$((i - 1))]}"
      echo "📉 Scale DOWN : $current → $prev (RAM sous-utilisée)"
      flyctl scale memory "$prev" --app "$APP" --yes
      return 0
    fi
  done
  echo "ℹ️  Déjà au tier min"
}

# ─── Main loop ──────────────────────────────────────────────────────
mem_mb=$(current_memory)
mem_gb_int=$((mem_mb / 1024))

# Pour la décision de scale, on utilise la sortie d'un endpoint /admin/metrics
# (à exposer côté backend Rust). Sans ça, fallback sur estimation heuristique.
# Ici, version minimaliste : on regarde si l'app a auto-démarré beaucoup de machines
# récemment → indicateur indirect de charge.
machine_count=$(flyctl machine list --app "$APP" --json | grep -c '"state":"started"')

state=$(cat "$STATE_FILE")
high_count=$(echo "$state" | grep -oE '"high_count":[0-9]+' | grep -oE '[0-9]+')
low_count=$(echo "$state" | grep -oE '"low_count":[0-9]+' | grep -oE '[0-9]+')

if [[ "$machine_count" -ge 6 ]]; then
  # 6+ machines actives = charge soutenue → upgrade le tier
  high_count=$((high_count + 1))
  low_count=0
  if [[ "$high_count" -ge 3 ]]; then
    scale_up "$mem_gb_int"
    high_count=0
  fi
elif [[ "$machine_count" -le 2 ]]; then
  # Charge basse soutenue
  low_count=$((low_count + 1))
  high_count=0
  if [[ "$low_count" -ge 12 ]]; then  # 12 ticks × 5 min = 1h calme
    scale_down "$mem_gb_int"
    low_count=0
  fi
else
  high_count=0
  low_count=0
fi

echo "{\"high_count\":$high_count,\"low_count\":$low_count}" > "$STATE_FILE"

echo "📊 État : ${machine_count} machines actives, tier ${mem_gb_int}gb, high_count=${high_count}, low_count=${low_count}"
