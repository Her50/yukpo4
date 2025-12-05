# Script pour remplacer try_get par get
$rustFiles = Get-ChildItem -Path "src" -Filter "*.rs" -Recurse

$replacements = 0
foreach ($file in $rustFiles) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if ($null -eq $content) { continue }
    
    $original = $content
    $modified = $false
    
    # Pattern 1: .try_get("col")? -> .get::<Type, _>("col")
    # On va d'abord remplacer les cas simples avec ? (échapper le ?)
    $content = $content -replace '\.try_get\("([^"]+)")\?', '.get::<$1, _>("$1")'
    
    # Pattern 2: .try_get("col").unwrap_or(...) -> .get::<Option<Type>, _>("col").unwrap_or(...)
    $content = $content -replace '\.try_get\("([^"]+)"\)\.unwrap_or\(', '.get::<Option<_>, _>("$1").unwrap_or('
    
    # Pattern 3: .try_get("col").unwrap_or_default() -> .get::<Option<Type>, _>("col").unwrap_or_default()
    $content = $content -replace '\.try_get\("([^"]+)"\)\.unwrap_or_default\(\)', '.get::<Option<_>, _>("$1").unwrap_or_default()'
    
    # Pattern 4: .try_get("col").unwrap_or_else(...) -> .get::<Option<Type>, _>("col").unwrap_or_else(...)
    $content = $content -replace '\.try_get\("([^"]+)"\)\.unwrap_or_else\(', '.get::<Option<_>, _>("$1").unwrap_or_else('
    
    # Pattern 5: .try_get("col").ok() -> .get::<Option<Type>, _>("col")
    $content = $content -replace '\.try_get\("([^"]+)"\)\.ok\(\)', '.get::<Option<_>, _>("$1")'
    
    # Pattern 6: .try_get::<Type, _>("col") -> .get::<Type, _>("col")
    $content = $content -replace '\.try_get::<([^>]+),\s*_>\("([^"]+)"\)', '.get::<$1, _>("$2")'
    
    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $replacements++
        Write-Host "Fixed: $($file.Name) ($replacements files)"
    }
}

Write-Host "`nTotal files modified: $replacements"

