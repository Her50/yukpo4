$files = Get-ChildItem -Path "mobile\src\screens" -Recurse -Filter "*.tsx"
foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    $count = ([regex]::Matches($content, 'Alert\.alert\(')).Count
    if ($count -ge 5 -and $count -le 7) {
        Write-Host "$count`t$($f.FullName)"
    }
}
