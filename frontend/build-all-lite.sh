#!/bin/bash
# Build les 3 apps lite autonomes (bourse, pharmacie, restaurant)
set -e

cd "$(dirname "$0")"

echo "── Build Bourse du Livre ──"
npx vite build --config vite.bourse.config.ts

echo "── Build Pharmacie ──"
npx vite build --config vite.pharmacie.config.ts

echo "── Build Restaurant ──"
npx vite build --config vite.restaurant.config.ts

echo ""
echo "✅ 3 apps builds prêtes :"
echo "   - dist-bourse/"
echo "   - dist-pharmacie/"
echo "   - dist-restaurant/"
