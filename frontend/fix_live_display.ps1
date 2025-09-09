# Script pour corriger l'affichage "Live" corrompu
# Remplacement des caractères bizarres par le bon emoji

$content = Get-Content "src/pages/ResultatBesoin.tsx" -Raw

# Remplacer les caractères corrompus par le bon emoji
$content = $content -replace 'ðŸ" Live', '🔴 Live'

# Sauvegarder le fichier corrigé
$content | Out-File "src/pages/ResultatBesoin.tsx" -Encoding UTF8

Write-Host "✅ Affichage 'Live' corrigé avec le bon emoji!" 