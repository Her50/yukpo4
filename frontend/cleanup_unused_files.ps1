# Script pour identifier et archiver les fichiers non utilisés dans le frontend

# Fichiers réellement utilisés dans App.tsx
$usedFiles = @(
    "AboutPage.tsx",
    "ConfirmationPage.tsx", 
    "ContactPage.tsx",
    "CreationService.tsx",
    "CreationSmartService.tsx",
    "FormulaireServiceModerne.tsx",
    "FormulaireYukpoIntelligent.tsx",
    "HomePage.tsx",
    "LoginPage.tsx",
    "PageNotFound.tsx",
    "RegisterPage.tsx",
    "RechargeTokensPage.tsx",
    "ResultatBesoin.tsx",
    "ServicesPage.tsx",
    "ServiceView.tsx",
    "SoldeDetailPage.tsx",
    "TestResultatBesoin.tsx",
    "UserSettingsPage.tsx",
    "VideoCall.tsx",
    "YukpoIaHub.tsx",
    "ChatDialog.tsx",
    "Dashboard.tsx",
    "DashboardPrestataire.tsx",
    "ServicesInteragisPage.tsx"
)

# Dossiers utilisés
$usedFolders = @(
    "dashboard",
    "admin",
    "dev",
    "docs",
    "landing",
    "legal",
    "plans",
    "prestataire",
    "public"
)

Write-Host "Début du nettoyage des fichiers non utilisés..."

# Créer le dossier d'archivage
$archiveDir = "archived_unused_files/pages"
if (!(Test-Path $archiveDir)) {
    New-Item -ItemType Directory -Path $archiveDir -Force
}

# Obtenir tous les fichiers .tsx dans le dossier pages
$allFiles = Get-ChildItem -Path "src/pages" -Filter "*.tsx" -Recurse | Where-Object { $_.Directory.Name -eq "pages" -or $_.Directory.Parent.Name -eq "pages" }

$movedCount = 0
$keptCount = 0

foreach ($file in $allFiles) {
    $fileName = $file.Name
    $relativePath = $file.FullName.Replace((Get-Location).Path + "\src\pages\", "")
    
    # Vérifier si le fichier est dans un dossier utilisé
    $inUsedFolder = $false
    foreach ($folder in $usedFolders) {
        if ($relativePath.StartsWith($folder + "\")) {
            $inUsedFolder = $true
            break
        }
    }
    
    # Vérifier si le fichier est utilisé
    $isUsed = $usedFiles -contains $fileName -or $inUsedFolder
    
    if (!$isUsed) {
        # Créer le dossier de destination si nécessaire
        $destDir = Join-Path $archiveDir (Split-Path $relativePath -Parent)
        if (!(Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force
        }
        
        # Déplacer le fichier
        $destPath = Join-Path $archiveDir $relativePath
        Move-Item -Path $file.FullName -Destination $destPath -Force
        Write-Host "Déplacé: $relativePath"
        $movedCount++
    } else {
        Write-Host "Conservé: $relativePath"
        $keptCount++
    }
}

Write-Host "Nettoyage terminé!"
Write-Host "Fichiers déplacés: $movedCount"
Write-Host "Fichiers conservés: $keptCount"



