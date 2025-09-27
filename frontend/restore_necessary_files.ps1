# Script pour restaurer tous les fichiers nécessaires pour la compilation

Write-Host "Restauration des fichiers nécessaires..."

# Fichiers nécessaires identifiés dans les imports
$necessaryFiles = @(
    "ApiDashboardPage.tsx",
    "SingleServicePage.tsx", 
    "CataloguePage.tsx",
    "TranslateTestPanel.tsx",
    "PaiementPlanPage.tsx",
    "LandingPage.tsx",
    "VoicePanel.tsx",
    "MonEspace.tsx",
    "PaiementProPage.tsx",
    "MatchPage.tsx",
    "StartPage.tsx",
    "VideoIntelligencePage.tsx",
    "PlansPage.tsx",
    "PrestataireDashboard.tsx"
)

$restoredCount = 0
$notFoundCount = 0

foreach ($file in $necessaryFiles) {
    $sourcePath = "archived_unused_files/pages/$file"
    $destPath = "src/pages/$file"
    
    if (Test-Path $sourcePath) {
        Move-Item -Path $sourcePath -Destination $destPath -Force
        Write-Host "Restauré: $file"
        $restoredCount++
    } else {
        Write-Host "Non trouvé: $file"
        $notFoundCount++
    }
}

Write-Host "Restauration terminée!"
Write-Host "Fichiers restaurés: $restoredCount"
Write-Host "Fichiers non trouvés: $notFoundCount"

