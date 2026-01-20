# 🧹 Script de Nettoyage des Fichiers Volumineux Inutiles
# Supprime les fichiers > 50MB qui ne sont pas nécessaires au projet

$ErrorActionPreference = "Stop"

Write-Host "🧹 Nettoyage des fichiers volumineux inutiles..." -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

$totalFreed = 0
$filesDeleted = 0

# Fonction pour supprimer un fichier avec confirmation
function Remove-LargeFile {
    param(
        [string]$FilePath,
        [string]$Description
    )
    
    if (Test-Path $FilePath) {
        $size = (Get-Item $FilePath).Length / 1MB
        $sizeRounded = [math]::Round($size, 2)
        
        Write-Host "[?] Supprimer: $FilePath" -ForegroundColor Yellow
        Write-Host "    Taille: $sizeRounded MB - $Description" -ForegroundColor Gray
        
        try {
            Remove-Item $FilePath -Force -ErrorAction Stop
            $script:totalFreed += $size
            $script:filesDeleted++
            Write-Host "    ✅ Supprimé avec succès" -ForegroundColor Green
            return $true
        } catch {
            Write-Host "    ❌ Erreur: $_" -ForegroundColor Red
            return $false
        }
    } else {
        Write-Host "[✓] Déjà supprimé: $FilePath" -ForegroundColor Gray
        return $false
    }
}

Write-Host "🔍 Recherche des fichiers volumineux..." -ForegroundColor Cyan
Write-Host ""

# ============================================
# CRITIQUE: backend/NONE (899.64 MB)
# ============================================
Write-Host "📦 Fichier CRITIQUE: backend/NONE" -ForegroundColor Red
Remove-LargeFile -FilePath "backend\NONE" -Description "Fichier orphelin sans utilité identifiée"
Write-Host ""

# ============================================
# Backups Frontend (obsolètes)
# ============================================
Write-Host "📦 Backups Frontend obsolètes" -ForegroundColor Yellow
$backups = @(
    @{Path="frontend\src\src.zip"; Desc="Backup source (mai 2025)"},
    @{Path="frontend\src\src1.zip"; Desc="Backup source (mai 2025)"},
    @{Path="frontend\src\srcfrontend3.zip"; Desc="Backup source (mai 2025)"},
    @{Path="frontend\src\srcfrontend4.zip"; Desc="Backup source (mai 2025)"},
    @{Path="frontend\src\components.zip"; Desc="Backup components (mai 2025)"},
    @{Path="frontend\src\pages.zip"; Desc="Backup pages (mai 2025)"},
    @{Path="frontend\src\componens.zip"; Desc="Backup components (typo)"}
)

foreach ($backup in $backups) {
    Remove-LargeFile -FilePath $backup.Path -Description $backup.Desc
}
Write-Host ""

# ============================================
# Archives LiveKit
# ============================================
Write-Host "📦 Archives LiveKit" -ForegroundColor Yellow

# livekit-ingress.tar.gz (vide)
Remove-LargeFile -FilePath "livekit-ingress.tar.gz" -Description "Archive vide (0 MB)"

# livekit.tar.gz (à vérifier avant suppression)
if (Test-Path "livekit.tar.gz") {
    $size = (Get-Item "livekit.tar.gz").Length / 1MB
    Write-Host "[?] Fichier trouvé: livekit.tar.gz ($([math]::Round($size, 2)) MB)" -ForegroundColor Yellow
    Write-Host "    ⚠️  Vérifiez manuellement si ce fichier est nécessaire" -ForegroundColor Yellow
    Write-Host "    Utilisez: tar -tzf livekit.tar.gz | head -20" -ForegroundColor Gray
    Write-Host "    Pour supprimer, décommentez la ligne suivante dans le script" -ForegroundColor Gray
    # Remove-LargeFile -FilePath "livekit.tar.gz" -Description "Archive LiveKit (vérifier utilité)"
}
Write-Host ""

# ============================================
# Résumé
# ============================================
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "📊 RÉSUMÉ" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Fichiers supprimés: $filesDeleted" -ForegroundColor Green
Write-Host "Espace récupéré: $([math]::Round($totalFreed, 2)) MB" -ForegroundColor Green
Write-Host ""

# ============================================
# Fichiers CONSERVÉS (nécessaires)
# ============================================
Write-Host "✅ FICHIERS CONSERVÉS (nécessaires):" -ForegroundColor Cyan
Write-Host "   - backend/blender/blender-4.0.0-linux-x64.tar.xz (264.68 MB)" -ForegroundColor Gray
Write-Host "     → Nécessaire pour builds Docker production" -ForegroundColor Gray
Write-Host ""

# ============================================
# Vérification finale
# ============================================
Write-Host "🔍 Vérification des fichiers volumineux restants..." -ForegroundColor Cyan
$remaining = Get-ChildItem -Path . -Recurse -File -ErrorAction SilentlyContinue | 
    Where-Object { 
        $_.Length -gt 50MB -and 
        $_.FullName -notmatch 'node_modules|\.git|target\\debug|target\\release' 
    } | 
    Select-Object FullName, @{Name="Size(MB)";Expression={[math]::Round($_.Length/1MB,2)}}

if ($remaining.Count -gt 0) {
    Write-Host ""
    Write-Host "📋 Fichiers volumineux restants (>50MB):" -ForegroundColor Yellow
    $remaining | ForEach-Object {
        Write-Host "   - $($_.FullName): $($_.SizeMB) MB" -ForegroundColor Gray
    }
} else {
    Write-Host "   ✅ Aucun fichier volumineux inutile restant" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ Nettoyage terminé!" -ForegroundColor Green


