#!/usr/bin/env bash
# ============================================================================
# Installe les git hooks Yukpo (pre-commit anti-secrets).
#
# Usage : bash scripts/git-hooks/install.sh
#
# À exécuter une fois après chaque clone du repo. CI peut le faire automa-
# tiquement via un script de bootstrap si besoin.
# ============================================================================
set -e

cd "$(dirname "$0")/../.."

HOOKS_SRC="scripts/git-hooks"
HOOKS_DST=".git/hooks"

if [ ! -d "$HOOKS_DST" ]; then
  echo "❌ Pas dans un repo git (.git/hooks introuvable)."
  exit 1
fi

# Liste des hooks à installer
HOOKS=("pre-commit")

for hook in "${HOOKS[@]}"; do
  src="$HOOKS_SRC/$hook"
  dst="$HOOKS_DST/$hook"

  if [ ! -f "$src" ]; then
    echo "⚠️  $src introuvable, skip."
    continue
  fi

  # Si un hook existe déjà, le backup
  if [ -e "$dst" ] && [ ! -L "$dst" ]; then
    backup="$dst.backup-$(date +%Y%m%d-%H%M%S)"
    mv "$dst" "$backup"
    echo "📦 Hook existant déplacé vers $backup"
  fi

  # Sur Windows (Git Bash), symlinks peuvent ne pas marcher → fallback copy
  if ln -sf "../../$src" "$dst" 2>/dev/null; then
    chmod +x "$src"
    echo "✅ Hook $hook installé via symlink → $src"
  else
    cp "$src" "$dst"
    chmod +x "$dst"
    echo "✅ Hook $hook installé via copie (symlink échoué — Windows ?)"
    echo "   ⚠️  Si tu modifies $src, relance ce script pour mettre à jour."
  fi
done

echo ""
echo "🔒 Pre-commit hook actif. Test rapide :"
echo "   echo 'AIzaTestKey1234567890123456789012345' > /tmp/test.txt"
echo "   git add /tmp/test.txt && git commit -m test    # → doit être bloqué"
