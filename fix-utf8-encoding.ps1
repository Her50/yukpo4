# Script pour corriger l'encodage UTF-8 dans auth_controller.rs
Write-Host "🔧 Correction de l'encodage UTF-8..." -ForegroundColor Green

$filePath = "backend/src/controllers/auth_controller.rs"
$content = Get-Content $filePath -Raw -Encoding UTF8

# Remplacer les caractères mal encodés
$content = $content -replace "Email d.*j.* utilis.*:", "Email deja utilise:"
$content = $content -replace "Email d.*j.* utilis.*", "Email deja utilise"

# Sauvegarder avec l'encodage correct
$content | Out-File $filePath -Encoding UTF8 -NoNewline

Write-Host "✅ Encodage UTF-8 corrigé dans auth_controller.rs" -ForegroundColor Green
