# Script simple pour corriger l'encodage
$file = "backend/src/controllers/auth_controller.rs"
$content = Get-Content $file -Raw

# Remplacer les caractères problématiques
$content = $content -replace "dj", "deja"
$content = $content -replace "utilis", "utilise"
$content = $content -replace "dfaut", "defaut"
$content = $content -replace "Calculer le nom_complet", "Calculer le nom_complet"
$content = $content -replace " partir de", "a partir de"
$content = $content -replace "Crer l'avatar_url", "Creer l'avatar_url"
$content = $content -replace "Gnrer un JWT", "Generer un JWT"
$content = $content -replace "Retourne explicitement", "Retourne explicitement"
$content = $content -replace "inscrit avec succs", "inscrit avec succes"

# Sauvegarder
$content | Set-Content $file -Encoding UTF8

Write-Host "Encodage corrige!" -ForegroundColor Green
