# Script de configuration de Java pour Yukpomnang Mobile

Write-Host "====================================" -ForegroundColor Cyan
Write-Host " Configuration de Java/JDK" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Chercher des installations JDK communes
$jdkPaths = @(
    "$env:ProgramFiles\Android\Android Studio\jbr",
    "$env:ProgramFiles\Java\jdk-17",
    "$env:ProgramFiles\Java\jdk-11",
    "$env:ProgramFiles\Java\jdk17",
    "$env:ProgramFiles\Java\jdk11",
    "$env:ProgramFiles\Microsoft\jdk-17.0.9.8-hotspot",
    "$env:ProgramFiles\Microsoft\jdk-11.0.21.9-hotspot",
    "$env:ProgramFiles\Eclipse Adoptium\jdk-17",
    "$env:ProgramFiles\Eclipse Adoptium\jdk-11"
)

Write-Host "Recherche d installations JDK..." -ForegroundColor Yellow
$foundJdk = $null

foreach ($path in $jdkPaths)
{
    if (Test-Path $path)
    {
        $javaExe = Join-Path $path "bin\java.exe"
        if (Test-Path $javaExe)
        {
            Write-Host "  OK JDK trouve: $path" -ForegroundColor Green
            $foundJdk = $path
            break
        }
    }
}

if ($null -eq $foundJdk)
{
    Write-Host ""
    Write-Host "====================================" -ForegroundColor Red
    Write-Host " Aucun JDK trouve!" -ForegroundColor Red
    Write-Host "====================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Vous devez installer un JDK pour compiler Android." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options recommandees:" -ForegroundColor Cyan
    Write-Host "  1. Installer Android Studio (inclut un JDK)" -ForegroundColor White
    Write-Host "     https://developer.android.com/studio" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. Installer Microsoft Build of OpenJDK 17" -ForegroundColor White
    Write-Host "     https://learn.microsoft.com/java/openjdk/download" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  3. Installer Eclipse Temurin JDK 17" -ForegroundColor White
    Write-Host "     https://adoptium.net/" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Apres installation, relancez ce script." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Configurer JAVA_HOME pour la session actuelle
Write-Host ""
Write-Host "Configuration de JAVA_HOME..." -ForegroundColor Yellow
$env:JAVA_HOME = $foundJdk
Write-Host "  JAVA_HOME = $foundJdk" -ForegroundColor Green

# Ajouter au PATH
$env:PATH = "$foundJdk\bin;$env:PATH"
Write-Host "  Java ajoute au PATH" -ForegroundColor Green

# Verifier la version Java
Write-Host ""
Write-Host "Verification de Java..." -ForegroundColor Yellow
& "$foundJdk\bin\java.exe" -version

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host " Java configure pour cette session" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT:" -ForegroundColor Yellow
Write-Host "  Cette configuration est temporaire (session actuelle uniquement)." -ForegroundColor White
Write-Host ""
Write-Host "Pour rendre la configuration permanente:" -ForegroundColor Cyan
Write-Host "  1. Ouvrir 'Variables d environnement systeme'" -ForegroundColor White
Write-Host "  2. Ajouter une nouvelle variable systeme:" -ForegroundColor White
Write-Host "     Nom: JAVA_HOME" -ForegroundColor White
Write-Host "     Valeur: $foundJdk" -ForegroundColor White
Write-Host "  3. Ajouter au PATH: %JAVA_HOME%\bin" -ForegroundColor White
Write-Host ""
Write-Host "Vous pouvez maintenant lancer le build avec:" -ForegroundColor Cyan
Write-Host "  .\gradlew.bat assembleDebug" -ForegroundColor White
Write-Host ""

