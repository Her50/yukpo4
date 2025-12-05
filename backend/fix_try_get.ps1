# Script pour remplacer try_get par get dans tous les fichiers Rust
$files = Get-ChildItem -Path "src" -Filter "*.rs" -Recurse

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $original = $content
    
    # Pattern 1: row.try_get("column")? -> row.get::<Type, _>("column")
    $content = $content -replace '(\w+)\.try_get\("([^"]+)")\?', '$1.get::<$2, _>("$2")'
    
    # Pattern 2: row.try_get("column").unwrap_or(default) -> row.get::<Option<Type>, _>("column").unwrap_or(default)
    $content = $content -replace '(\w+)\.try_get\("([^"]+)"\)\.unwrap_or\(([^)]+)\)', '$1.get::<Option<_>, _>("$2").unwrap_or($3)'
    
    # Pattern 3: row.try_get("column").unwrap_or_default() -> row.get::<Option<Type>, _>("column").unwrap_or_default()
    $content = $content -replace '(\w+)\.try_get\("([^"]+)"\)\.unwrap_or_default\(\)', '$1.get::<Option<_>, _>("$2").unwrap_or_default()'
    
    # Pattern 4: row.try_get("column").unwrap_or_else(|_| ...) -> row.get::<Option<Type>, _>("column").unwrap_or_else(|_| ...)
    $content = $content -replace '(\w+)\.try_get\("([^"]+)"\)\.unwrap_or_else\(', '$1.get::<Option<_>, _>("$2").unwrap_or_else('
    
    # Pattern 5: row.try_get("column").ok() -> row.get::<Option<Type>, _>("column")
    $content = $content -replace '(\w+)\.try_get\("([^"]+)"\)\.ok\(\)', '$1.get::<Option<_>, _>("$2")'
    
    # Pattern 6: row.try_get::<Type, _>("column") -> row.get::<Type, _>("column")
    $content = $content -replace '(\w+)\.try_get::<([^>]+),\s*_>\("([^"]+)"\)', '$1.get::<$2, _>("$3")'
    
    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "Fixed: $($file.FullName)"
    }
}

Write-Host "Done!"

