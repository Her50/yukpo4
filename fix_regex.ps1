$content = Get-Content "src\pages\ResultatBesoin.tsx" -Raw

# Remplacer les regex mal encodées
$content = $content -replace '/Ã \s+\(\[A-Za-zÃ€-Ã¿\s\]\+\)/', '/à\s+([A-Za-z\s]+)/'
$content = $content -replace '/dans\s+\(\[A-Za-zÃ€-Ã¿\s\]\+\)/', '/dans\s+([A-Za-z\s]+)/'
$content = $content -replace '/sur\s+\(\[A-Za-zÃ€-Ã¿\s\]\+\)/', '/sur\s+([A-Za-z\s]+)/'
$content = $content -replace '/prÃ¨s\s+de\s+\(\[A-Za-zÃ€-Ã¿\s\]\+\)/', '/près\s+de\s+([A-Za-z\s]+)/'
$content = $content -replace '/zone\s+\(\[A-Za-zÃ€-Ã¿\s\]\+\)/', '/zone\s+([A-Za-z\s]+)/'
$content = $content -replace '/quartier\s+\(\[A-Za-zÃ€-Ã¿\s\]\+\)/', '/quartier\s+([A-Za-z\s]+)/'

# Sauvegarder le fichier corrigé
$content | Out-File "src\pages\ResultatBesoin.tsx" -Encoding UTF8

Write-Host "Fichier corrigé avec succès!" 