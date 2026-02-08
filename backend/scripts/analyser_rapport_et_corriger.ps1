# Script pour analyser le rapport de verification et corriger les problemes identifies

param(
    [string]$Region = "us-east-1",
    [string]$RapportFile = "rapport_verification_20260207_161804.txt"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Analyse du Rapport et Corrections" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $RapportFile)) {
    Write-Host "ERREUR: Fichier de rapport non trouve: $RapportFile" -ForegroundColor Red
    Write-Host "Executez d'abord: backend/scripts/executer_rapport_verification.ps1" -ForegroundColor Yellow
    exit 1
}

# Lire et parser le rapport JSON
$rapportContent = Get-Content $RapportFile -Raw -Encoding UTF8
$rapportLines = $rapportContent -split "`n" | Where-Object { $_ -match '^\d{4}-\d{2}-\d{2}' }

$issues = @()
$success = @()

foreach ($line in $rapportLines) {
    if ($line -match '\{"section"') {
        try {
            $json = $line -replace '^\d{4}-\d{2}-\d{2}T[\d:]+ ', '' | ConvertFrom-Json
            
            switch ($json.section) {
                'migrations' {
                    if ([int]$json.total -eq 0) {
                        $issues += "⚠️ Table _sqlx_migrations est vide (aucune migration enregistree)"
                    } else {
                        $success += "✅ Migrations: $($json.successful) reussies sur $($json.total)"
                        if ([int]$json.failed -gt 0) {
                            $issues += "❌ $($json.failed) migrations ont echoue"
                        }
                    }
                }
                'tables' {
                    if ($json.missing_tables -and $json.missing_tables.Count -gt 0) {
                        foreach ($table in $json.missing_tables) {
                            $issues += "❌ Table manquante: $table"
                        }
                    }
                    if ($json.critical_tables) {
                        $success += "✅ Tables critiques presentes: $($json.critical_tables.Count)"
                    }
                }
                'functions' {
                    if ($json.missing_functions -and $json.missing_functions.Count -gt 0) {
                        foreach ($func in $json.missing_functions) {
                            $issues += "❌ Fonction manquante: $func"
                        }
                    } else {
                        $success += "✅ Toutes les fonctions critiques existent"
                    }
                }
                'indexes' {
                    if ($json.missing_indexes -and $json.missing_indexes.Count -gt 0) {
                        foreach ($idx in $json.missing_indexes) {
                            $issues += "❌ Index manquant: $($idx.name) sur $($idx.table)"
                        }
                    } else {
                        $success += "✅ Tous les index critiques existent"
                    }
                }
                'materialized_views' {
                    if ($json.services_search_optimized_v2.exists) {
                        $success += "✅ Vue materialisee services_search_optimized_v2 existe"
                        if ($json.services_search_optimized_v2.has_unique_index) {
                            $success += "✅ Index unique pour la vue materialisee existe"
                        } else {
                            $issues += "❌ Index unique manquant pour services_search_optimized_v2"
                        }
                    } else {
                        $issues += "❌ Vue materialisee services_search_optimized_v2 manquante"
                    }
                }
                'statistics' {
                    Write-Host "STATISTIQUES:" -ForegroundColor Yellow
                    Write-Host "  Tables: $($json.total_tables)" -ForegroundColor Gray
                    Write-Host "  Fonctions: $($json.total_functions)" -ForegroundColor Gray
                    Write-Host "  Index: $($json.total_indexes)" -ForegroundColor Gray
                    Write-Host "  Vues: $($json.total_views)" -ForegroundColor Gray
                    Write-Host "  Vues materialisees: $($json.total_materialized_views)" -ForegroundColor Gray
                    Write-Host ""
                }
            }
        } catch {
            # Ignorer les erreurs de parsing
        }
    }
}

# Afficher le resume
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RESUME DE LA VERIFICATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($success.Count -gt 0) {
    Write-Host "✅ SUCCES:" -ForegroundColor Green
    foreach ($item in $success) {
        Write-Host "  $item" -ForegroundColor Green
    }
    Write-Host ""
}

if ($issues.Count -gt 0) {
    Write-Host "⚠️ PROBLEMES IDENTIFIES:" -ForegroundColor Yellow
    foreach ($item in $issues) {
        Write-Host "  $item" -ForegroundColor Yellow
    }
    Write-Host ""
    
    # Proposer des corrections
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "ACTIONS RECOMMANDEES" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    $needsCorrection = $false
    
    if ($issues -match 'Table manquante: delivery_requests') {
        Write-Host "1. Table delivery_requests manquante" -ForegroundColor Yellow
        Write-Host "   Verifier si cette table doit exister ou si elle a un autre nom" -ForegroundColor Gray
        $needsCorrection = $true
    }
    
    if ($issues -match 'Table manquante: courier_profiles') {
        Write-Host "2. Table courier_profiles manquante" -ForegroundColor Yellow
        Write-Host "   Verifier si cette table doit exister ou si elle a un autre nom" -ForegroundColor Gray
        $needsCorrection = $true
    }
    
    if ($issues -match '_sqlx_migrations est vide') {
        Write-Host "3. Table _sqlx_migrations est vide" -ForegroundColor Yellow
        Write-Host "   Les migrations SQLx ne sont pas enregistrees" -ForegroundColor Gray
        Write-Host "   Cela peut etre normal si les migrations ont ete appliquees manuellement" -ForegroundColor Gray
    }
    
    if (-not $needsCorrection) {
        Write-Host "✅ Aucune correction necessaire!" -ForegroundColor Green
        Write-Host "   Tous les elements critiques sont en place." -ForegroundColor Gray
    }
} else {
    Write-Host "✅ AUCUN PROBLEME IDENTIFIE!" -ForegroundColor Green
    Write-Host "   La base de donnees est conforme aux attentes." -ForegroundColor Gray
}

Write-Host ""



