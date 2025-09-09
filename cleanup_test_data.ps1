# Script PowerShell pour nettoyer les données de test de recherche d'images
# Ce script supprime les services et médias créés pendant les tests

param(
    [string]$DatabaseUrl = "postgresql://username:password@localhost:5432/yukpo_db",
    [string]$BackendUrl = "http://localhost:3000",
    [switch]$Force,
    [switch]$DryRun
)

Write-Host "🧹 Nettoyage des données de test de recherche d'images" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan

# Vérifier que psql est disponible
try {
    $psqlVersion = & psql --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ psql disponible: $psqlVersion" -ForegroundColor Green
    } else {
        throw "psql non disponible"
    }
} catch {
    Write-Host "❌ psql non disponible. Veuillez installer PostgreSQL ou ajouter psql au PATH" -ForegroundColor Red
    exit 1
}

# Vérifier la connexion à la base de données
Write-Host "🔍 Test de connexion à la base de données..." -ForegroundColor Cyan
try {
    $testConnection = & psql -h localhost -U postgres -d yukpo_db -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Connexion à la base de données réussie" -ForegroundColor Green
    } else {
        Write-Host "❌ Impossible de se connecter à la base de données" -ForegroundColor Red
        Write-Host "💡 Vérifiez les paramètres de connexion et que PostgreSQL est démarré" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Erreur de connexion à la base de données: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Identifier les services de test
Write-Host "🔍 Identification des services de test..." -ForegroundColor Cyan
try {
    $testServices = & psql -h localhost -U postgres -d yukpo_db -c "SELECT id, data->>'titre_service' as titre FROM services WHERE data->>'titre_service' LIKE '%Service de test%' OR data->>'titre_service' LIKE '%Blazer élégant%';" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        $serviceLines = $testServices -split "`n" | Where-Object { $_ -match "^\s*\d+\s*\|\s*" }
        
        if ($serviceLines) {
            Write-Host "📋 Services de test identifiés:" -ForegroundColor Yellow
            foreach ($line in $serviceLines) {
                if ($line -match "^\s*(\d+)\s*\|\s*(.+)$") {
                    $serviceId = $matches[1].Trim()
                    $titre = $matches[2].Trim()
                    Write-Host "  - ID: $serviceId, Titre: $titre" -ForegroundColor Gray
                }
            }
        } else {
            Write-Host "ℹ️ Aucun service de test identifié" -ForegroundColor Green
            exit 0
        }
    } else {
        Write-Host "❌ Erreur lors de l'identification des services de test" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur lors de l'identification des services: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Identifier les médias associés
Write-Host "🔍 Identification des médias de test..." -ForegroundColor Cyan
try {
    $testMedia = & psql -h localhost -U postgres -d yukpo_db -c "SELECT m.id, m.service_id, m.path, m.type FROM media m JOIN services s ON m.service_id = s.id WHERE s.data->>'titre_service' LIKE '%Service de test%' OR s.data->>'titre_service' LIKE '%Blazer élégant%';" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        $mediaLines = $testMedia -split "`n" | Where-Object { $_ -match "^\s*\d+\s*\|\s*" }
        
        if ($mediaLines) {
            Write-Host "📷 Médias de test identifiés:" -ForegroundColor Yellow
            foreach ($line in $mediaLines) {
                if ($line -match "^\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.+)$") {
                    $mediaId = $matches[1].Trim()
                    $serviceId = $matches[2].Trim()
                    $path = $matches[3].Trim()
                    $type = $matches[4].Trim()
                    Write-Host "  - ID: $mediaId, Service: $serviceId, Type: $type, Path: $path" -ForegroundColor Gray
                }
            }
        } else {
            Write-Host "ℹ️ Aucun média de test identifié" -ForegroundColor Green
        }
    } else {
        Write-Host "❌ Erreur lors de l'identification des médias de test" -ForegroundColor Red
    }
} catch {
    Write-Host "⚠️ Impossible d'identifier les médias de test: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Demander confirmation
if (-not $Force) {
    Write-Host "`n⚠️ ATTENTION: Cette opération va supprimer définitivement:" -ForegroundColor Yellow
    Write-Host "  - Les services de test identifiés" -ForegroundColor Red
    Write-Host "  - Les médias associés" -ForegroundColor Red
    Write-Host "  - Les fichiers physiques sur le disque" -ForegroundColor Red
    
    $confirmation = Read-Host "Voulez-vous continuer? (oui/non)"
    if ($confirmation -ne "oui") {
        Write-Host "❌ Nettoyage annulé par l'utilisateur" -ForegroundColor Red
        exit 0
    }
}

# Mode simulation
if ($DryRun) {
    Write-Host "`n🔍 MODE SIMULATION - Aucune suppression ne sera effectuée" -ForegroundColor Cyan
    Write-Host "=" * 60 -ForegroundColor Cyan
    
    Write-Host "📋 Actions qui seraient effectuées:" -ForegroundColor Yellow
    
    # Simuler la suppression des médias
    if ($mediaLines) {
        Write-Host "🗑️ Suppression des médias de test:" -ForegroundColor Red
        foreach ($line in $mediaLines) {
            if ($line -match "^\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.+)$") {
                $mediaId = $matches[1].Trim()
                $path = $matches[3].Trim()
                Write-Host "  - Supprimer média ID: $mediaId, Path: $path" -ForegroundColor Gray
            }
        }
    }
    
    # Simuler la suppression des services
    if ($serviceLines) {
        Write-Host "🗑️ Suppression des services de test:" -ForegroundColor Red
        foreach ($line in $serviceLines) {
            if ($line -match "^\s*(\d+)\s*\|\s*(.+)$") {
                $serviceId = $matches[1].Trim()
                $titre = $matches[2].Trim()
                Write-Host "  - Supprimer service ID: $serviceId, Titre: $titre" -ForegroundColor Gray
            }
        }
    }
    
    Write-Host "`n🎯 Simulation terminée - Aucune donnée n'a été supprimée" -ForegroundColor Green
    exit 0
}

# Suppression effective
Write-Host "`n🗑️ Suppression des données de test..." -ForegroundColor Red
Write-Host "=" * 60 -ForegroundColor Cyan

# Supprimer les médias de test
if ($mediaLines) {
    Write-Host "🗑️ Suppression des médias de test..." -ForegroundColor Cyan
    
    foreach ($line in $mediaLines) {
        if ($line -match "^\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.+)$") {
            $mediaId = $matches[1].Trim()
            $path = $matches[3].Trim()
            
            try {
                # Supprimer le fichier physique
                if (Test-Path $path) {
                    Remove-Item $path -Force
                    Write-Host "  ✅ Fichier supprimé: $path" -ForegroundColor Green
                } else {
                    Write-Host "  ⚠️ Fichier non trouvé: $path" -ForegroundColor Yellow
                }
                
                # Supprimer l'enregistrement de la base
                $deleteResult = & psql -h localhost -U postgres -d yukpo_db -c "DELETE FROM media WHERE id = $mediaId;" 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "  ✅ Média supprimé de la base: ID $mediaId" -ForegroundColor Green
                } else {
                    Write-Host "  ❌ Erreur suppression base: $deleteResult" -ForegroundColor Red
                }
                
            } catch {
                Write-Host "  ❌ Erreur lors de la suppression du média $mediaId: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
}

# Supprimer les services de test
if ($serviceLines) {
    Write-Host "🗑️ Suppression des services de test..." -ForegroundColor Cyan
    
    foreach ($line in $serviceLines) {
        if ($line -match "^\s*(\d+)\s*\|\s*(.+)$") {
            $serviceId = $matches[1].Trim()
            $titre = $matches[2].Trim()
            
            try {
                $deleteResult = & psql -h localhost -U postgres -d yukpo_db -c "DELETE FROM services WHERE id = $serviceId;" 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "  ✅ Service supprimé: ID $serviceId, Titre: $titre" -ForegroundColor Green
                } else {
                    Write-Host "  ❌ Erreur suppression service: $deleteResult" -ForegroundColor Red
                }
                
            } catch {
                Write-Host "  ❌ Erreur lors de la suppression du service $serviceId: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
}

# Vérification post-nettoyage
Write-Host "`n🔍 Vérification post-nettoyage..." -ForegroundColor Cyan
try {
    $remainingTestServices = & psql -h localhost -U postgres -d yukpo_db -c "SELECT COUNT(*) FROM services WHERE data->>'titre_service' LIKE '%Service de test%' OR data->>'titre_service' LIKE '%Blazer élégant%';" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        $count = ($remainingTestServices -split "`n" | Where-Object { $_ -match "^\s*\d+\s*$" } | Select-Object -First 1).Trim()
        if ($count -eq "0") {
            Write-Host "✅ Tous les services de test ont été supprimés" -ForegroundColor Green
        } else {
            Write-Host "⚠️ $count service(s) de test restent dans la base" -ForegroundColor Yellow
        }
    }
    
    $remainingTestMedia = & psql -h localhost -U postgres -d yukpo_db -c "SELECT COUNT(*) FROM media m JOIN services s ON m.service_id = s.id WHERE s.data->>'titre_service' LIKE '%Service de test%' OR s.data->>'titre_service' LIKE '%Blazer élégant%';" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        $count = ($remainingTestMedia -split "`n" | Where-Object { $_ -match "^\s*\d+\s*$" } | Select-Object -First 1).Trim()
        if ($count -eq "0") {
            Write-Host "✅ Tous les médias de test ont été supprimés" -ForegroundColor Green
        } else {
            Write-Host "⚠️ $count média(x) de test restent dans la base" -ForegroundColor Yellow
        }
    }
    
} catch {
    Write-Host "⚠️ Impossible de vérifier l'état post-nettoyage: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Nettoyage des fichiers temporaires
Write-Host "`n🧹 Nettoyage des fichiers temporaires..." -ForegroundColor Cyan
$tempFiles = @("temp_test_image.jpg", "temp_test.jpg")
foreach ($file in $tempFiles) {
    if (Test-Path $file) {
        Remove-Item $file -Force
        Write-Host "  ✅ Fichier temporaire supprimé: $file" -ForegroundColor Green
    }
}

Write-Host "`n" + "=" * 60 -ForegroundColor Cyan
Write-Host "🎉 Nettoyage des données de test terminé!" -ForegroundColor Green
Write-Host "`n🔧 Prochaines étapes:" -ForegroundColor Yellow
Write-Host "1. Vérifiez que la base de données est propre" -ForegroundColor Cyan
Write-Host "2. Relancez les tests si nécessaire: python test_image_search.py" -ForegroundColor Cyan
Write-Host "3. Vérifiez les logs du backend pour d'éventuelles erreurs" -ForegroundColor Cyan

Write-Host "`n" + "=" * 60 -ForegroundColor Cyan 