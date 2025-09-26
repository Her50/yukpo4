# Script simple de transformation Frontend -> Mobile
param(
    [switch]$Force
)

$FrontendPath = Join-Path $PSScriptRoot "../../frontend/src"
$MobilePath = Join-Path $PSScriptRoot "../src"

Write-Host "Transformation Frontend vers Mobile" -ForegroundColor Cyan
Write-Host "Frontend: $FrontendPath" -ForegroundColor Yellow
Write-Host "Mobile: $MobilePath" -ForegroundColor Yellow

# Verifier que le frontend existe
if (-not (Test-Path $FrontendPath)) {
    Write-Host "ERREUR: Dossier frontend non trouve" -ForegroundColor Red
    exit 1
}

# Analyser la structure
Write-Host "Analyse de la structure..." -ForegroundColor Yellow

$PagesPath = Join-Path $FrontendPath "pages"
$ComponentsPath = Join-Path $FrontendPath "components"

if (Test-Path $PagesPath) {
    $Pages = Get-ChildItem $PagesPath -Filter "*.tsx"
    Write-Host "Pages trouvees: $($Pages.Count)" -ForegroundColor Green
}

if (Test-Path $ComponentsPath) {
    $Components = Get-ChildItem $ComponentsPath -Filter "*.tsx"
    Write-Host "Composants trouves: $($Components.Count)" -ForegroundColor Green
}

# Fonction de transformation simple
function Transform-File {
    param([string]$Content)
    
    $TransformedContent = $Content
    
    # Mappings de base
    $TransformedContent = $TransformedContent -replace 'useNavigate', 'useNavigation'
    $TransformedContent = $TransformedContent -replace 'navigate\(', 'navigation.navigate('
    $TransformedContent = $TransformedContent -replace 'className=', 'style='
    $TransformedContent = $TransformedContent -replace '<div', '<View'
    $TransformedContent = $TransformedContent -replace '</div>', '</View>'
    $TransformedContent = $TransformedContent -replace '<button', '<TouchableOpacity'
    $TransformedContent = $TransformedContent -replace '</button>', '</TouchableOpacity>'
    $TransformedContent = $TransformedContent -replace '<input', '<TextInput'
    $TransformedContent = $TransformedContent -replace '</input>', '</TextInput>'
    $TransformedContent = $TransformedContent -replace '<span', '<Text'
    $TransformedContent = $TransformedContent -replace '</span>', '</Text>'
    $TransformedContent = $TransformedContent -replace '<p>', '<Text>'
    $TransformedContent = $TransformedContent -replace '</p>', '</Text>'
    
    # Routes
    $TransformedContent = $TransformedContent -replace "'/'", "'Home'"
    $TransformedContent = $TransformedContent -replace "'/login'", "'Login'"
    $TransformedContent = $TransformedContent -replace "'/register'", "'Register'"
    $TransformedContent = $TransformedContent -replace "'/dashboard'", "'Dashboard'"
    
    # Imports
    $TransformedContent = $TransformedContent -replace 'from "react-router-dom"', 'from "@react-navigation/native"'
    $TransformedContent = $TransformedContent -replace 'from "framer-motion"', '// Animation React Native'
    
    # Hooks
    $TransformedContent = $TransformedContent -replace 'const \{ user \} = useUser\(\);', 'const { user } = useAuth();'
    $TransformedContent = $TransformedContent -replace 'const navigate = useNavigate\(\);', 'const navigation = useNavigation();'
    
    return $TransformedContent
}

# Transformer les pages
if (Test-Path $PagesPath) {
    $Pages = Get-ChildItem $PagesPath -Filter "*.tsx"
    Write-Host "Transformation de $($Pages.Count) pages..." -ForegroundColor Cyan
    
    $ScreensDir = Join-Path $MobilePath "screens"
    if (-not (Test-Path $ScreensDir)) {
        New-Item -ItemType Directory -Path $ScreensDir -Force | Out-Null
    }
    
    $SuccessCount = 0
    foreach ($Page in $Pages) {
        try {
            $PageName = [System.IO.Path]::GetFileNameWithoutExtension($Page.Name)
            $ScreenName = $PageName -replace 'Page', 'Screen'
            
            Write-Host "Transformation: $PageName -> $ScreenName" -ForegroundColor Green
            
            $Content = Get-Content $Page.FullName -Raw -Encoding UTF8
            $TransformedContent = Transform-File $Content
            
            $OutputPath = Join-Path $ScreensDir "$ScreenName.tsx"
            Set-Content -Path $OutputPath -Value $TransformedContent -Encoding UTF8
            
            $SuccessCount++
        }
        catch {
            Write-Host "Erreur transformation $($Page.Name): $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    Write-Host "Pages transformees: $SuccessCount/$($Pages.Count)" -ForegroundColor Green
}

# Transformer les composants
if (Test-Path $ComponentsPath) {
    $Components = Get-ChildItem $ComponentsPath -Filter "*.tsx"
    Write-Host "Transformation de $($Components.Count) composants..." -ForegroundColor Cyan
    
    $ComponentsDir = Join-Path $MobilePath "components"
    if (-not (Test-Path $ComponentsDir)) {
        New-Item -ItemType Directory -Path $ComponentsDir -Force | Out-Null
    }
    
    $SuccessCount = 0
    foreach ($Component in $Components) {
        try {
            $ComponentName = [System.IO.Path]::GetFileNameWithoutExtension($Component.Name)
            
            Write-Host "Transformation composant: $ComponentName" -ForegroundColor Green
            
            $Content = Get-Content $Component.FullName -Raw -Encoding UTF8
            $TransformedContent = Transform-File $Content
            
            $OutputPath = Join-Path $ComponentsDir "$ComponentName.tsx"
            Set-Content -Path $OutputPath -Value $TransformedContent -Encoding UTF8
            
            $SuccessCount++
        }
        catch {
            Write-Host "Erreur transformation composant $($Component.Name): $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    Write-Host "Composants transformes: $SuccessCount/$($Components.Count)" -ForegroundColor Green
}

Write-Host "Transformation terminee!" -ForegroundColor Green
Write-Host "Fichiers generes dans: $MobilePath" -ForegroundColor Yellow


