# Script PowerShell pour corriger les erreurs TypeScript critiques

Write-Host "🔧 Correction des erreurs TypeScript critiques..." -ForegroundColor Cyan
Write-Host ""

# 1. Supprimer AppMinimal.tsx (fichier de test)
if (Test-Path "AppMinimal.tsx") {
    Remove-Item "AppMinimal.tsx" -Force
    Write-Host "✅ Suppression de AppMinimal.tsx" -ForegroundColor Green
}

# 2. Créer un fichier de types manquants
$typesContent = @"
// Types manquants pour corriger les erreurs TypeScript
declare module '@/hooks/useUserPlan' {
  export const useUserPlan: () => {
    plan: string;
    loading: boolean;
  };
}
"@

Set-Content -Path "src/types/missing.d.ts" -Value $typesContent -Force
Write-Host "✅ Création de src/types/missing.d.ts" -ForegroundColor Green

# 3. Corriger les fichiers avec des typos
$filesToFix = @(
    @{
        Path    = "src/components/AvatarMenuModal.tsx"
        Find    = "Viewider"
        Replace = "View"
    },
    @{
        Path    = "src/components/CaptchaChallenge.tsx"
        Find    = "Textrops"
        Replace = "Text"
    }
)

foreach ($fix in $filesToFix) {
    if (Test-Path $fix.Path) {
        $content = Get-Content $fix.Path -Raw
        $newContent = $content -replace $fix.Find, $fix.Replace
        if ($content -ne $newContent) {
            Set-Content -Path $fix.Path -Value $newContent -NoNewline
            Write-Host "✅ Correction de $($fix.Path): $($fix.Find) → $($fix.Replace)" -ForegroundColor Green
        }
    }
}

Write-Host ""
Write-Host "📊 Corrections terminées!" -ForegroundColor Green
Write-Host "💡 Lancez 'npx tsc --noEmit' pour vérifier" -ForegroundColor Yellow

# Script PowerShell pour corriger les erreurs TypeScript critiques

Write-Host "🔧 Correction des erreurs TypeScript critiques..." -ForegroundColor Cyan
Write-Host ""

# 1. Supprimer AppMinimal.tsx (fichier de test)
if (Test-Path "AppMinimal.tsx") {
    Remove-Item "AppMinimal.tsx" -Force
    Write-Host "✅ Suppression de AppMinimal.tsx" -ForegroundColor Green
}

# 2. Créer un fichier de types manquants
$typesContent = @"
// Types manquants pour corriger les erreurs TypeScript
declare module '@/hooks/useUserPlan' {
  export const useUserPlan: () => {
    plan: string;
    loading: boolean;
  };
}
"@

Set-Content -Path "src/types/missing.d.ts" -Value $typesContent -Force
Write-Host "✅ Création de src/types/missing.d.ts" -ForegroundColor Green

# 3. Corriger les fichiers avec des typos
$filesToFix = @(
    @{
        Path    = "src/components/AvatarMenuModal.tsx"
        Find    = "Viewider"
        Replace = "View"
    },
    @{
        Path    = "src/components/CaptchaChallenge.tsx"
        Find    = "Textrops"
        Replace = "Text"
    }
)

foreach ($fix in $filesToFix) {
    if (Test-Path $fix.Path) {
        $content = Get-Content $fix.Path -Raw
        $newContent = $content -replace $fix.Find, $fix.Replace
        if ($content -ne $newContent) {
            Set-Content -Path $fix.Path -Value $newContent -NoNewline
            Write-Host "✅ Correction de $($fix.Path): $($fix.Find) → $($fix.Replace)" -ForegroundColor Green
        }
    }
}

Write-Host ""
Write-Host "📊 Corrections terminées!" -ForegroundColor Green
Write-Host "💡 Lancez 'npx tsc --noEmit' pour vérifier" -ForegroundColor Yellow

