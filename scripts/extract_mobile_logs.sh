#!/bin/bash
# Script pour extraire uniquement les logs mobiles des logs backend
# Usage: ./extract_mobile_logs.sh [fichier_log] [output_file]

INPUT_FILE="${1:-/dev/stdin}"
OUTPUT_FILE="${2:-mobile_logs.txt}"

# Extraire les logs mobiles (préfixe 📱[MOBILE])
if [ "$INPUT_FILE" = "/dev/stdin" ]; then
    # Lire depuis stdin (pipe)
    grep -E "📱\[MOBILE|MobileLog|MobileLogs" > "$OUTPUT_FILE"
else
    # Lire depuis fichier
    grep -E "📱\[MOBILE|MobileLog|MobileLogs" "$INPUT_FILE" > "$OUTPUT_FILE"
fi

echo "✅ Logs mobiles extraits dans: $OUTPUT_FILE"
echo "📊 Nombre de lignes: $(wc -l < "$OUTPUT_FILE")"

