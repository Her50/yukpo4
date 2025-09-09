# Script pour supprimer la duplication dans ResultatBesoin.tsx
$content = Get-Content "src/pages/ResultatBesoin.tsx" -Raw

# Trouver où commence la duplication (ligne avec les imports dupliqués)
$lines = $content -split "`r?`n"
$fixedLines = @()
$foundDuplication = $false

for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    
    # Détecter le début de la duplication (imports après le premier export)
    if (!$foundDuplication -and $line -match "import { useState, useEffect } from 'react';" -and $i -gt 100) {
        $foundDuplication = $true
        Write-Host "Duplication détectée à la ligne $($i + 1)"
        break
    }
    
    $fixedLines += $line
}

# Ajouter l'export par défaut à la fin
$fixedLines += ""
$fixedLines += "export default ResultatBesoin;"

# Sauvegarder le fichier corrigé
$fixedContent = $fixedLines -join "`n"
$fixedContent | Out-File "src/pages/ResultatBesoin.tsx" -Encoding UTF8

Write-Host "✅ Duplication supprimée avec succès!"
Write-Host "Fichier réduit de $($lines.Length) à $($fixedLines.Length) lignes" 