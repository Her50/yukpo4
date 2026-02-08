# Script de comparaison des versions et test de build
# Compare le commit de référence avec HEAD et teste les builds

$REFERENCE_COMMIT = "a9b9a4acc64e7f35add72d7057e2d92943be7866"
$REPO_PATH = "C:\Users\23767\yukpomnang2"
$ANDROID_PATH = "$REPO_PATH\mobile\android"

Write-Host "=== COMPARAISON DES VERSIONS ===" -ForegroundColor Cyan

# Fonction pour extraire les versions d'un fichier
function Get-VersionsFromFile {
    param($FilePath, $Commit = "HEAD")
    
    if ($Commit -eq "HEAD") {
        $content = Get-Content $FilePath -Raw
    } else {
        $content = git show "$Commit:$FilePath" 2>$null
    }
    
    if ($null -eq $content) { return @{} }
    
    $versions = @{}
    
    # Extraire les versions
    if ($content -match 'kotlinVersion.*?([\d.]+)') { $versions['kotlinVersion'] = $matches[1] }
    if ($content -match 'compileSdkVersion.*?(\d+)') { $versions['compileSdkVersion'] = $matches[1] }
    if ($content -match 'targetSdkVersion.*?(\d+)') { $versions['targetSdkVersion'] = $matches[1] }
    if ($content -match 'minSdkVersion.*?(\d+)') { $versions['minSdkVersion'] = $matches[1] }
    if ($content -match 'buildToolsVersion.*?([\d.]+)') { $versions['buildToolsVersion'] = $matches[1] }
    if ($content -match 'gradle:([\d.]+)') { $versions['gradlePlugin'] = $matches[1] }
    if ($content -match 'gradle-([\d.]+)-all') { $versions['gradleVersion'] = $matches[1] }
    if ($content -match 'ndkVersion.*?"([^"]+)"') { $versions['ndkVersion'] = $matches[1] }
    
    return $versions
}

Write-Host "`n1. Comparaison build.gradle" -ForegroundColor Yellow
$refBuild = Get-VersionsFromFile "mobile/android/build.gradle" $REFERENCE_COMMIT
$currentBuild = Get-VersionsFromFile "mobile/android/build.gradle" "HEAD"

Write-Host "`nCommit de référence ($REFERENCE_COMMIT):" -ForegroundColor Green
$refBuild.GetEnumerator() | Sort-Object Name | ForEach-Object { Write-Host "  $($_.Key): $($_.Value)" }

Write-Host "`nVersion actuelle (HEAD):" -ForegroundColor Green
$currentBuild.GetEnumerator() | Sort-Object Name | ForEach-Object { Write-Host "  $($_.Key): $($_.Value)" }

Write-Host "`n2. Comparaison gradle.properties" -ForegroundColor Yellow
$refProps = Get-VersionsFromFile "mobile/android/gradle.properties" $REFERENCE_COMMIT
$currentProps = Get-VersionsFromFile "mobile/android/gradle.properties" "HEAD"

Write-Host "`nCommit de référence:" -ForegroundColor Green
$refProps.GetEnumerator() | Sort-Object Name | ForEach-Object { Write-Host "  $($_.Key): $($_.Value)" }

Write-Host "`nVersion actuelle:" -ForegroundColor Green
$currentProps.GetEnumerator() | Sort-Object Name | ForEach-Object { Write-Host "  $($_.Key): $($_.Value)" }

Write-Host "`n3. Comparaison gradle-wrapper.properties" -ForegroundColor Yellow
$refWrapper = Get-VersionsFromFile "mobile/android/gradle/wrapper/gradle-wrapper.properties" $REFERENCE_COMMIT
$currentWrapper = Get-VersionsFromFile "mobile/android/gradle/wrapper/gradle-wrapper.properties" "HEAD"

Write-Host "`nCommit de référence:" -ForegroundColor Green
$refWrapper.GetEnumerator() | Sort-Object Name | ForEach-Object { Write-Host "  $($_.Key): $($_.Value)" }

Write-Host "`nVersion actuelle:" -ForegroundColor Green
$currentWrapper.GetEnumerator() | Sort-Object Name | ForEach-Object { Write-Host "  $($_.Key): $($_.Value)" }

Write-Host "`n4. Comparaison package.json (versions clés)" -ForegroundColor Yellow
$refPackage = git show "$REFERENCE_COMMIT:mobile/package.json" 2>$null
$currentPackage = Get-Content "$REPO_PATH\mobile\package.json" -Raw

if ($refPackage) {
    if ($refPackage -match '"react-native":\s*"([^"]+)"') {
        Write-Host "`nReact Native (référence): $($matches[1])" -ForegroundColor Green
    }
    if ($refPackage -match '"expo":\s*"([^"]+)"') {
        Write-Host "Expo (référence): $($matches[1])" -ForegroundColor Green
    }
    if ($refPackage -match '"react":\s*"([^"]+)"') {
        Write-Host "React (référence): $($matches[1])" -ForegroundColor Green
    }
}

if ($currentPackage) {
    if ($currentPackage -match '"react-native":\s*"([^"]+)"') {
        Write-Host "React Native (actuel): $($matches[1])" -ForegroundColor Green
    }
    if ($currentPackage -match '"expo":\s*"([^"]+)"') {
        Write-Host "Expo (actuel): $($matches[1])" -ForegroundColor Green
    }
    if ($currentPackage -match '"react":\s*"([^"]+)"') {
        Write-Host "React (actuel): $($matches[1])" -ForegroundColor Green
    }
}

Write-Host "`n=== TEST DES BUILDS ===" -ForegroundColor Cyan

# Sauvegarder l'état actuel
$currentBranch = git rev-parse --abbrev-ref HEAD
$currentCommit = git rev-parse HEAD

Write-Host "`nÉtat actuel sauvegardé:" -ForegroundColor Yellow
Write-Host "  Branche: $currentBranch"
Write-Host "  Commit: $currentCommit"

# Test du build actuel
Write-Host "`n1. Test du build actuel (HEAD)..." -ForegroundColor Yellow
Set-Location $ANDROID_PATH

Write-Host "`nExécution: .\gradlew clean --no-daemon" -ForegroundColor Gray
$buildCurrent = .\gradlew clean --no-daemon 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Clean réussi" -ForegroundColor Green
} else {
    Write-Host "✗ Clean échoué" -ForegroundColor Red
    Write-Host $buildCurrent -ForegroundColor Red
}

# Test du build de référence (checkout temporaire)
Write-Host "`n2. Test du build de référence ($REFERENCE_COMMIT)..." -ForegroundColor Yellow
Set-Location $REPO_PATH

# Créer une branche temporaire pour le test
$tempBranch = "temp-build-test-$REFERENCE_COMMIT"
git stash
git checkout -b $tempBranch $REFERENCE_COMMIT 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Set-Location $ANDROID_PATH
    Write-Host "`nExécution: .\gradlew clean --no-daemon" -ForegroundColor Gray
    $buildRef = .\gradlew clean --no-daemon 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Clean réussi pour le commit de référence" -ForegroundColor Green
    } else {
        Write-Host "✗ Clean échoué pour le commit de référence" -ForegroundColor Red
        Write-Host $buildRef -ForegroundColor Red
    }
    
    # Restaurer l'état original
    Set-Location $REPO_PATH
    git checkout $currentBranch 2>&1 | Out-Null
    git branch -D $tempBranch 2>&1 | Out-Null
    git stash pop 2>&1 | Out-Null
} else {
    Write-Host "✗ Impossible de checkout le commit de référence" -ForegroundColor Red
    Set-Location $REPO_PATH
    git checkout $currentBranch 2>&1 | Out-Null
    git stash pop 2>&1 | Out-Null
}

Write-Host "`n=== COMPARAISON TERMINÉE ===" -ForegroundColor Cyan



