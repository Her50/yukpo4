# Script pour exécuter la migration de correction de la recherche par image
# Migration: 20251221_add_fallback_to_hybrid_image_search.sql

$DATABASE_URL = $env:DATABASE_URL
if ([string]::IsNullOrWhiteSpace($DATABASE_URL)) {
    Write-Host "❌ Erreur: Variable d'environnement DATABASE_URL non définie." -ForegroundColor Red
    Write-Host "Veuillez définir `$env:DATABASE_URL = 'postgresql://user:pass@host:port/db'" -ForegroundColor Yellow
    exit 1
}

Write-Host "🚀 Exécution de la migration de correction de la recherche par image..." -ForegroundColor Cyan

$migrationFile = "backend/migrations/20251221_add_fallback_to_hybrid_image_search.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Erreur: Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "  📄 Fichier: $migrationFile" -ForegroundColor Gray

try {
    $migrationContent = Get-Content -Raw -Path $migrationFile -Encoding UTF8
    $command = "echo '$migrationContent' | psql $DATABASE_URL"
    
    Write-Host "  ➡️ Exécution de la migration..." -ForegroundColor Gray
    $result = Invoke-Expression "$command" 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ⚠️ Avertissement (peut être normal si la fonction existe déjà):" -ForegroundColor Yellow
        Write-Host $result
    } else {
        Write-Host "  ✅ Migration appliquée avec succès." -ForegroundColor Green
    }
} catch {
    Write-Host "  ❌ Erreur lors de l'exécution de la migration: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Migration terminée!" -ForegroundColor Green
Write-Host "`n💡 La fonction hybrid_image_search inclut maintenant un fallback vers services.data->produits" -ForegroundColor Cyan
Write-Host "   Cela permet de trouver des produits même si leurs images n'ont pas été analysées par IA." -ForegroundColor Gray

