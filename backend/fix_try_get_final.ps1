# Script final pour remplacer try_get par get
$rustFiles = Get-ChildItem -Path "src" -Filter "*.rs" -Recurse

$replacements = 0
foreach ($file in $rustFiles) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if ($null -eq $content) { continue }
    
    $original = $content
    
    # Pattern 1: .try_get::<Type, _>("col") -> .get::<Type, _>("col")
    $content = [regex]::Replace($content, '\.try_get::<([^>]+),\s*_>\("([^"]+)"\)', '.get::<$1, _>("$2")')
    
    # Pattern 2: .try_get("col").unwrap_or(...) -> .get::<Option<_>, _>("col").unwrap_or(...)
    $content = [regex]::Replace($content, '\.try_get\("([^"]+)"\)\.unwrap_or\(', '.get::<Option<_>, _>("$1").unwrap_or(')
    
    # Pattern 3: .try_get("col").unwrap_or_default() -> .get::<Option<_>, _>("col").unwrap_or_default()
    $content = [regex]::Replace($content, '\.try_get\("([^"]+)"\)\.unwrap_or_default\(\)', '.get::<Option<_>, _>("$1").unwrap_or_default()')
    
    # Pattern 4: .try_get("col").unwrap_or_else(...) -> .get::<Option<_>, _>("col").unwrap_or_else(...)
    $content = [regex]::Replace($content, '\.try_get\("([^"]+)"\)\.unwrap_or_else\(', '.get::<Option<_>, _>("$1").unwrap_or_else(')
    
    # Pattern 5: .try_get("col").ok() -> .get::<Option<_>, _>("col")
    $content = [regex]::Replace($content, '\.try_get\("([^"]+)"\)\.ok\(\)', '.get::<Option<_>, _>("$1")')
    
    # Pattern 6: .try_get("col")? -> .get::<_, _>("col")
    # Note: Le ? doit être échappé différemment - on le fait manuellement pour éviter les erreurs de regex
    # $content = [regex]::Replace($content, '\.try_get\("([^"]+)")\?', '.get::<_, _>("$1")')
    
    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $replacements++
        Write-Host "Fixed: $($file.Name)"
    }
}

Write-Host "`nTotal files modified: $replacements"

