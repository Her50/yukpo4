$file = "src\screens\HomeScreen.tsx"
$fullPath = Join-Path $PSScriptRoot $file

Write-Host "Checking file: $fullPath"

# Read file as bytes
$bytes = [System.IO.File]::ReadAllBytes($fullPath)

# Check for BOM
$hasBOM = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)

Write-Host "BOM detected: $hasBOM"

if ($hasBOM) {
    # Read content without BOM
    $content = [System.IO.File]::ReadAllText($fullPath, [System.Text.Encoding]::UTF8)
    
    # Write back without BOM
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($fullPath, $content, $utf8NoBom)
    
    Write-Host "BOM removed successfully"
} else {
    Write-Host "No BOM found, file is clean"
}

