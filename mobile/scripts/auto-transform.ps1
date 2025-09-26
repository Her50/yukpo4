# Script PowerShell pour transformation automatique Frontend → Mobile
# ⚠️ IMPORTANT : Ce script NE MODIFIE JAMAIS le frontend
# Il lit seulement les fichiers frontend pour générer les versions mobiles

param(
    [switch]$Force,
    [string]$Target = "all"
)

$FrontendPath = Join-Path $PSScriptRoot "../../frontend/src"
$MobilePath = Join-Path $PSScriptRoot "../src"

Write-Host "🔄 Script de transformation automatique Frontend → Mobile" -ForegroundColor Cyan
Write-Host "📖 Lecture du frontend : $FrontendPath" -ForegroundColor Yellow
Write-Host "📱 Génération mobile : $MobilePath" -ForegroundColor Yellow

# Vérifier que le frontend existe
if (-not (Test-Path $FrontendPath)) {
    Write-Host "❌ Dossier frontend non trouvé : $FrontendPath" -ForegroundColor Red
    exit 1
}

# Fonction pour transformer un fichier
function Transform-File {
    param(
        [string]$FilePath,
        [string]$Content
    )
    
    $FileName = Split-Path $FilePath -Leaf
    Write-Host "🔄 Transformation de : $FileName" -ForegroundColor Green
    
    $TransformedContent = $Content
    
    # Mappings de composants
    $Mappings = @{
        'useNavigate' = 'useNavigation'
        'navigate('   = 'navigation.navigate('
        'className='  = 'style='
        'div'         = 'View'
        'button'      = 'TouchableOpacity'
        'input'       = 'TextInput'
        'img'         = 'Image'
        'span'        = 'Text'
        'p'           = 'Text'
        'h1'          = 'Text'
        'h2'          = 'Text'
        'h3'          = 'Text'
    }
    
    # Appliquer les mappings
    foreach ($Web in $Mappings.Keys) {
        $Native = $Mappings[$Web]
        $TransformedContent = $TransformedContent -replace [regex]::Escape($Web), $Native
    }
    
    # Transformer les routes
    $RouteMappings = @{
        "'/'"                             = "'Home'"
        "'/login'"                        = "'Login'"
        "'/register'"                     = "'Register'"
        "'/dashboard'"                    = "'Dashboard'"
        "'/dashboard-prestataire'"        = "'DashboardPrestataire'"
        "'/services-interagis'"           = "'ServicesInteragis'"
        "'/mon-solde'"                    = "'SoldeDetail'"
        "'/recharge-tokens'"              = "'RechargeTokens'"
        "'/formulaire-yukpo-intelligent'" = "'FormulaireYukpoIntelligent'"
        "'/recherche-besoin'"             = "'RechercheBesoin'"
        "'/resultat-besoin'"              = "'ResultatBesoin'"
        "'/mon-compte'"                   = "'Settings'"
    }
    
    foreach ($WebRoute in $RouteMappings.Keys) {
        $MobileScreen = $RouteMappings[$WebRoute]
        $TransformedContent = $TransformedContent -replace [regex]::Escape($WebRoute), $MobileScreen
    }
    
    # Transformer les imports
    $TransformedContent = $TransformedContent -replace 'from "react-router-dom"', 'from "@react-navigation/native"'
    $TransformedContent = $TransformedContent -replace 'from "framer-motion"', '// Animation React Native'
    $TransformedContent = $TransformedContent -replace 'from "react-toastify"', 'import { Alert } from "react-native"'
    
    # Transformer les hooks
    $TransformedContent = $TransformedContent -replace 'const \{ user \} = useUser\(\);', 'const { user } = useAuth();'
    $TransformedContent = $TransformedContent -replace 'const navigate = useNavigate\(\);', 'const navigation = useNavigation();'
    
    # Transformer les toasts
    $TransformedContent = $TransformedContent -replace 'toast\.error\(([^)]+)\);', 'Alert.alert("Erreur", $1);'
    $TransformedContent = $TransformedContent -replace 'toast\.success\(([^)]+)\);', 'Alert.alert("Succès", $1);'
    $TransformedContent = $TransformedContent -replace 'toast\.info\(([^)]+)\);', 'Alert.alert("Information", $1);'
    
    return $TransformedContent
}

# Fonction pour transformer une page en screen
function Transform-PageToScreen {
    param(
        [string]$PagePath
    )
    
    $PageName = [System.IO.Path]::GetFileNameWithoutExtension($PagePath)
    $ScreenName = $PageName -replace 'Page', 'Screen'
    
    Write-Host "📱 Transformation de $PageName → $ScreenName" -ForegroundColor Cyan
    
    try {
        $Content = Get-Content $PagePath -Raw -Encoding UTF8
        $TransformedContent = Transform-File $PagePath $Content
        
        # Créer le dossier screens s'il n'existe pas
        $ScreensDir = Join-Path $MobilePath "screens"
        if (-not (Test-Path $ScreensDir)) {
            New-Item -ItemType Directory -Path $ScreensDir -Force | Out-Null
        }
        
        # Sauvegarder le fichier transformé
        $OutputPath = Join-Path $ScreensDir "$ScreenName.tsx"
        Set-Content -Path $OutputPath -Value $TransformedContent -Encoding UTF8
        
        Write-Host "✅ $ScreenName créé avec succès" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Erreur transformation $PageName : $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Fonction pour transformer un composant
function Transform-ComponentToMobile {
    param(
        [string]$ComponentPath
    )
    
    $ComponentName = [System.IO.Path]::GetFileNameWithoutExtension($ComponentPath)
    
    Write-Host "🧩 Transformation du composant $ComponentName" -ForegroundColor Cyan
    
    try {
        $Content = Get-Content $ComponentPath -Raw -Encoding UTF8
        $TransformedContent = Transform-File $ComponentPath $Content
        
        # Créer le dossier components s'il n'existe pas
        $ComponentsDir = Join-Path $MobilePath "components"
        if (-not (Test-Path $ComponentsDir)) {
            New-Item -ItemType Directory -Path $ComponentsDir -Force | Out-Null
        }
        
        # Sauvegarder le fichier transformé
        $OutputPath = Join-Path $ComponentsDir "$ComponentName.tsx"
        Set-Content -Path $OutputPath -Value $TransformedContent -Encoding UTF8
        
        Write-Host "✅ Composant $ComponentName créé avec succès" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Erreur transformation composant $ComponentName : $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Fonction principale
function Main {
    Write-Host "🚀 Démarrage de la transformation automatique..." -ForegroundColor Green
    
    # Analyser la structure
    Write-Host "🔍 Analyse de la structure du frontend..." -ForegroundColor Yellow
    
    $PagesPath = Join-Path $FrontendPath "pages"
    $ComponentsPath = Join-Path $FrontendPath "components"
    
    if (Test-Path $PagesPath) {
        $Pages = Get-ChildItem $PagesPath -Filter "*.tsx" | Select-Object -ExpandProperty Name
        Write-Host "📄 Pages trouvées : $($Pages -join ', ')" -ForegroundColor Yellow
    }
    
    if (Test-Path $ComponentsPath) {
        $Components = Get-ChildItem $ComponentsPath -Filter "*.tsx" | Select-Object -ExpandProperty Name
        Write-Host "🧩 Composants trouvés : $($Components -join ', ')" -ForegroundColor Yellow
    }
    
    # Transformer les pages
    if (Test-Path $PagesPath) {
        $Pages = Get-ChildItem $PagesPath -Filter "*.tsx"
        Write-Host "`n📄 Transformation de $($Pages.Count) pages..." -ForegroundColor Cyan
        
        $SuccessCount = 0
        foreach ($Page in $Pages) {
            if (Transform-PageToScreen $Page.FullName) {
                $SuccessCount++
            }
        }
        
        Write-Host "✅ $SuccessCount/$($Pages.Count) pages transformées avec succès" -ForegroundColor Green
    }
    
    # Transformer les composants
    if (Test-Path $ComponentsPath) {
        $Components = Get-ChildItem $ComponentsPath -Filter "*.tsx"
        Write-Host "`n🧩 Transformation de $($Components.Count) composants..." -ForegroundColor Cyan
        
        $SuccessCount = 0
        foreach ($Component in $Components) {
            if (Transform-ComponentToMobile $Component.FullName) {
                $SuccessCount++
            }
        }
        
        Write-Host "✅ $SuccessCount/$($Components.Count) composants transformés avec succès" -ForegroundColor Green
    }
    
    Write-Host "`n🎉 Transformation automatique terminée !" -ForegroundColor Green
    Write-Host "📝 Les fichiers mobiles ont été générés dans le dossier mobile/src/" -ForegroundColor Yellow
    Write-Host "⚠️  Rappel : Le script NE MODIFIE JAMAIS le frontend, il lit seulement pour générer le mobile" -ForegroundColor Magenta
}

# Exécuter la fonction principale
Main


