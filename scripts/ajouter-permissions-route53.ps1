# Script pour ajouter les permissions Route 53 à l'utilisateur IAM
# Date: 2026-02-14
# Objectif: Préparer Route 53 pour quand le Load Balancer sera activé

param(
    [string]$UserName = "github-actions-yukpo",
    [string]$PolicyName = "Route53DNSManagement"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AJOUT PERMISSIONS ROUTE 53 IAM" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que l'utilisateur existe
Write-Host "[1/3] Verification de l'utilisateur IAM..." -ForegroundColor Yellow
try {
    $user = aws iam get-user --user-name $UserName --output json 2>&1 | ConvertFrom-Json
    Write-Host "  [OK] Utilisateur trouve: $($user.User.UserName)" -ForegroundColor Green
    Write-Host "  [OK] ARN: $($user.User.Arn)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "  [ERREUR] Utilisateur non trouve: $UserName" -ForegroundColor Red
    Write-Host "  [INFO] Verifiez le nom de l'utilisateur" -ForegroundColor Yellow
    exit 1
}

# Vérifier si la politique existe déjà
Write-Host "[2/3] Verification des politiques existantes..." -ForegroundColor Yellow
try {
    $policies = aws iam list-user-policies --user-name $UserName --output json 2>&1 | ConvertFrom-Json
    $attachedPolicies = aws iam list-attached-user-policies --user-name $UserName --output json 2>&1 | ConvertFrom-Json
    
    $hasRoute53 = $false
    
    # Vérifier les politiques inline
    if ($policies.PolicyNames -contains $PolicyName) {
        Write-Host "  [INFO] Politique inline Route 53 deja existante: $PolicyName" -ForegroundColor Yellow
        $hasRoute53 = $true
    }
    
    # Vérifier les politiques attachées
    $route53Managed = $attachedPolicies.AttachedPolicies | Where-Object { $_.PolicyName -like "*Route53*" -or $_.PolicyName -like "*route53*" }
    if ($route53Managed) {
        Write-Host "  [INFO] Politique Route 53 deja attachee: $($route53Managed.PolicyName)" -ForegroundColor Yellow
        $hasRoute53 = $true
    }
    
    if (-not $hasRoute53) {
        Write-Host "  [INFO] Aucune politique Route 53 trouvee" -ForegroundColor Gray
    }
    Write-Host ""
} catch {
    Write-Host "  [ATTENTION] Impossible de verifier les politiques: $_" -ForegroundColor Yellow
    Write-Host ""
}

# Créer la politique inline
Write-Host "[3/3] Ajout de la politique Route 53..." -ForegroundColor Yellow

$policyDocument = @{
    Version = "2012-10-17"
    Statement = @(
        @{
            Effect = "Allow"
            Action = @(
                "route53:ListHostedZones",
                "route53:GetHostedZone",
                "route53:ListResourceRecordSets",
                "route53:ChangeResourceRecordSets",
                "route53:GetChange",
                "route53:ListTagsForResource",
                "route53:ChangeTagsForResource"
            )
            Resource = "*"
        }
    )
} | ConvertTo-Json -Depth 10 -Compress

$policyFile = "route53-policy-temp.json"
# Écrire sans BOM UTF-8
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($policyFile, $policyDocument, $utf8NoBom)

try {
    # Vérifier si la politique existe déjà
    try {
        $existingPolicy = aws iam get-user-policy --user-name $UserName --policy-name $PolicyName --output json 2>&1 | ConvertFrom-Json
        Write-Host "  [INFO] Politique existante trouvee, mise a jour..." -ForegroundColor Yellow
        
        # Supprimer l'ancienne
        aws iam delete-user-policy --user-name $UserName --policy-name $PolicyName 2>&1 | Out-Null
    } catch {
        # La politique n'existe pas, on continue
    }
    
    # Créer/Mettre à jour la politique
    $result = aws iam put-user-policy `
        --user-name $UserName `
        --policy-name $PolicyName `
        --policy-document file://$policyFile `
        --output json 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Politique Route 53 ajoutee avec succes!" -ForegroundColor Green
        Write-Host "    Nom: $PolicyName" -ForegroundColor Gray
        Write-Host "    Utilisateur: $UserName" -ForegroundColor Gray
        Write-Host ""
        Write-Host "  [INFO] Permissions ajoutees:" -ForegroundColor Cyan
        Write-Host "    - route53:ListHostedZones" -ForegroundColor White
        Write-Host "    - route53:GetHostedZone" -ForegroundColor White
        Write-Host "    - route53:ListResourceRecordSets" -ForegroundColor White
        Write-Host "    - route53:ChangeResourceRecordSets" -ForegroundColor White
        Write-Host "    - route53:GetChange" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "  [ERREUR] Echec de l'ajout de la politique:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  [ERREUR] Erreur lors de l'ajout: $_" -ForegroundColor Red
    exit 1
} finally {
    # Nettoyer le fichier temporaire
    if (Test-Path $policyFile) {
        Remove-Item $policyFile -Force
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TERMINE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[INFO] Route 53 est maintenant pret a etre utilise" -ForegroundColor Cyan
Write-Host "[INFO] Testez avec: powershell -ExecutionPolicy Bypass -File scripts\verifier-route53-dns.ps1" -ForegroundColor Yellow
Write-Host ""

