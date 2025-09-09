# fix-project.ps1
Get-ChildItem -Path . -Filter *.tsx -Recurse | ForEach-Object {
    $file = $_
    $content = Get-Content $file.FullName -Raw

    # Corrige les balises JSX mal fermées comme </React>
    $content = $content -replace '</React>', ''

    # Corrige les doublons de 'import from'
    $content = $content -replace "from\s+'react'\s+from\s+'react'", "from 'react'"

    # Corrige les balises HTML/JSX incorrectes comme </string>, </Record>, etc.
    $content = $content -replace '</[A-Z][a-zA-Z]+>', ''

    # Corrige les erreurs courantes de commentaire JSX mal fermés
    $content = $content -replace '(\{\/\*[^*]*\*\/)?\}', '}'

    # Réécrit le fichier uniquement si le contenu a été modifié
    if ($content -ne (Get-Content $file.FullName -Raw)) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        Write-Host "Fichier corrigé : $($file.Name)"
    }
}
