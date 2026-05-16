#!/usr/bin/env bash
# deploy-security-hardening.sh — Déploiement Bourse du Livre hardening
# (audit complet du 2026-05-16).
#
# Ordre OBLIGATOIRE :
#   1. Build et déploiement du backend (binaire embarque les migrations)
#   2. Appliquer la migration 20260516_002 (audit_logs + flag + soft-delete)
#   3. Importer la liste YUKPO_OFFICIAL_LIBRAIRIE en flag DB, puis vider l'env var
#   4. Push du frontend patché (avec ?token=<jwt> sur tous les WS)
#   5. Activer WS_REQUIRE_AUTH=true APRÈS confirmation que le frontend en prod
#      envoie bien le token (sinon → 401 sur toutes les connexions WS)
#
# Pré-requis : fly CLI authentifié, psql, accès au repo, JWT_SECRET déjà set.

set -euo pipefail

APP="${APP:-yukpo-fly-backend}"
ORG="${ORG:-personal}"
echo "=== Hardening sécurité Bourse du Livre — $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo "App: $APP"
echo

# ============================================================================
# 1. Vérifications pré-déploiement
# ============================================================================
echo "[1/6] Vérifications pré-déploiement"
fly status -a "$APP" > /dev/null || { echo "❌ Fly app introuvable : $APP"; exit 1; }
test -f backend/fly.toml || { echo "❌ Exécuter depuis la racine du repo"; exit 1; }
test -f backend/migrations/20260516_002_security_hardening_bourse.sql || {
  echo "❌ Migration manquante"; exit 1;
}
echo "✅ OK"
echo

# ============================================================================
# 2. Configurer les nouveaux secrets / env vars (avant deploy pour qu'ils
#    soient présents dès le premier boot)
# ============================================================================
echo "[2/6] Configuration secrets Fly"
echo "    - DEBUG_ALLOWED_IPS (IPs de l'équipe monitoring, optionnel)"
echo "    - WS_MAX_CONN_PER_USER (défaut 10)"
echo "    - REFERRAL_MAX_CONVERSIONS_24H (défaut 20)"
echo "    - DB_STATEMENT_TIMEOUT_MS (défaut 30000)"
echo "    - DB_LOCK_TIMEOUT_MS (défaut 8000)"
echo
read -r -p "Continuer ? [y/N] " ok
[ "${ok,,}" = "y" ] || { echo "Annulé"; exit 0; }

fly secrets set \
  WS_MAX_CONN_PER_USER=10 \
  REFERRAL_MAX_CONVERSIONS_24H=20 \
  REFERRAL_MIN_FILLEUL_AGE_MINUTES=15 \
  -a "$APP"
# WS_REQUIRE_AUTH=true sera set à l'étape 6, après confirmation frontend.

# ============================================================================
# 3. Deploy du backend
# ============================================================================
echo "[3/6] Deploy backend Fly (--no-cache car nouvelles migrations sqlx)"
fly deploy --no-cache -a "$APP"
echo

# ============================================================================
# 4. Vérifier que la migration est passée
# ============================================================================
echo "[4/6] Vérification post-deploy"
sleep 5
fly logs -a "$APP" -n | grep -E "audit_logs|migration|started" | head -20 || true
echo
echo "Vérifier manuellement :"
echo "  - fly logs -a $APP | grep 'pool'"
echo "  - psql \$DATABASE_URL -c '\\d audit_logs'"
echo

# ============================================================================
# 5. Importer la liste librairie officielle en flag DB (one-shot)
# ============================================================================
echo "[5/6] Migration env var → flag DB"
current=$(fly secrets list -a "$APP" --json 2>/dev/null \
  | grep -oP '"name":"YUKPO_OFFICIAL_LIBRAIRIE_USER_IDS","digest":"[^"]+"' \
  || echo "")
if [ -n "$current" ]; then
  echo "  YUKPO_OFFICIAL_LIBRAIRIE_USER_IDS est encore définie."
  echo "  Étapes manuelles :"
  cat <<'EOF'
    1. Récupérer la liste : fly secrets list -a yukpo-fly-backend | grep YUKPO_OFFICIAL
       (la valeur n'est pas affichée — la récupérer depuis ta source de vérité)
    2. psql $DATABASE_URL -c "UPDATE users SET is_yukpo_official_librairie = TRUE WHERE id IN (<csv>);"
    3. fly secrets unset YUKPO_OFFICIAL_LIBRAIRIE_USER_IDS -a yukpo-fly-backend
EOF
else
  echo "  ✅ YUKPO_OFFICIAL_LIBRAIRIE_USER_IDS n'est pas définie — flag DB est l'unique source."
fi
echo

# ============================================================================
# 6. Mode strict WS (après push frontend patché)
# ============================================================================
echo "[6/6] Mode strict WS"
echo "  Le frontend doit envoyer ?token=<jwt> à chaque connexion WS."
echo "  - Confirmer que le frontend en prod (Netlify) est sur la version patchée"
echo "  - Tester une connexion WS depuis le browser : pas de 401"
echo
read -r -p "Frontend patché et déployé ? Activer WS_REQUIRE_AUTH ? [y/N] " ok
if [ "${ok,,}" = "y" ]; then
  fly secrets set WS_REQUIRE_AUTH=true -a "$APP"
  echo "  ✅ Mode strict activé. Les connexions WS sans token seront refusées."
else
  echo "  ⚠️  Mode strict NON activé. Les WS sans token passent encore (warning log)."
  echo "      Après patch + déploiement frontend, relancer :"
  echo "      fly secrets set WS_REQUIRE_AUTH=true -a $APP"
fi

echo
echo "=== Terminé ==="
