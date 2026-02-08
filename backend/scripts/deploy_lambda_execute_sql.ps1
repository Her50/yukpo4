# Script pour deployer et executer la fonction Lambda qui execute le script SQL

param(
    [string]$Region = "us-east-1",
    [string]$FunctionName = "yukpomnang-execute-sql-fix",
    [string]$DatabaseUrl = "postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/yukpomnang?sslmode=require"
)

Write-Host "Deploiement de la fonction Lambda pour executer le script SQL" -ForegroundColor Cyan
Write-Host ""

# Verifier que le fichier Lambda existe
$lambdaFile = "backend/scripts/lambda_execute_sql.py"
if (-not (Test-Path $lambdaFile)) {
    Write-Host "ERREUR: Fichier Lambda non trouve: $lambdaFile" -ForegroundColor Red
    exit 1
}

Write-Host "Fichier Lambda trouve: $lambdaFile" -ForegroundColor Green

# Creer un package ZIP pour la Lambda
Write-Host "Creation du package Lambda..." -ForegroundColor Yellow
$zipFile = "lambda_execute_sql.zip"

# Installer psycopg2-binary dans un dossier temporaire
$tempDir = [System.IO.Path]::GetTempPath() + [System.Guid]::NewGuid().ToString()
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
    # Copier le fichier Lambda
    Copy-Item $lambdaFile "$tempDir/lambda_function.py"
    
    # Installer psycopg2-binary
    Write-Host "Installation de psycopg2-binary..." -ForegroundColor Yellow
    pip install psycopg2-binary -t $tempDir --quiet
    
    # Creer le ZIP
    Write-Host "Creation du package ZIP..." -ForegroundColor Yellow
    Compress-Archive -Path "$tempDir/*" -DestinationPath $zipFile -Force
    
    Write-Host "Package ZIP cree: $zipFile" -ForegroundColor Green
} finally {
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

# Recuperer les informations du VPC et des subnets
Write-Host "Recuperation des informations du VPC..." -ForegroundColor Yellow
$vpcId = aws ec2 describe-vpcs --region $Region --filters "Name=tag:Name,Values=*yukpomnang*" --query 'Vpcs[0].VpcId' --output text 2>&1

if (-not $vpcId -or $vpcId -match "error" -or $vpcId -eq "None") {
    Write-Host "Recherche du VPC par defaut..." -ForegroundColor Yellow
    $vpcId = aws ec2 describe-vpcs --region $Region --filters "Name=isDefault,Values=true" --query 'Vpcs[0].VpcId' --output text 2>&1
}

$subnets = aws ec2 describe-subnets --region $Region --filters "Name=vpc-id,Values=$vpcId" --query 'Subnets[0:2].SubnetId' --output text 2>&1
$subnetList = $subnets -split '\s+' | Where-Object { $_ -ne "" }

$securityGroup = aws ec2 describe-security-groups --region $Region --filters "Name=vpc-id,Values=$vpcId" "Name=group-name,Values=*default*" --query 'SecurityGroups[0].GroupId' --output text 2>&1

Write-Host "VPC: $vpcId" -ForegroundColor Gray
Write-Host "Subnets: $($subnetList -join ', ')" -ForegroundColor Gray
Write-Host "Security Group: $securityGroup" -ForegroundColor Gray
Write-Host ""

# Verifier si la fonction Lambda existe deja
Write-Host "Verification de l'existence de la fonction Lambda..." -ForegroundColor Yellow
$existingFunction = aws lambda get-function --function-name $FunctionName --region $Region 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Fonction Lambda existe deja, mise a jour..." -ForegroundColor Yellow
    aws lambda update-function-code `
        --function-name $FunctionName `
        --zip-file "fileb://$zipFile" `
        --region $Region `
        | Out-Null
    
    aws lambda update-function-configuration `
        --function-name $FunctionName `
        --environment "Variables={DATABASE_URL=$DatabaseUrl}" `
        --vpc-config "SubnetIds=$($subnetList -join ','),SecurityGroupIds=$securityGroup" `
        --timeout 300 `
        --memory-size 512 `
        --region $Region `
        | Out-Null
} else {
    Write-Host "Creation de la fonction Lambda..." -ForegroundColor Yellow
    
    # Creer un role IAM pour la Lambda
    $roleName = "yukpomnang-lambda-sql-execution-role"
    $trustPolicy = @{
        Version = "2012-10-17"
        Statement = @(
            @{
                Effect = "Allow"
                Principal = @{
                    Service = "lambda.amazonaws.com"
                }
                Action = "sts:AssumeRole"
            }
        )
    } | ConvertTo-Json -Compress
    
    $trustPolicyFile = [System.IO.Path]::GetTempFileName() -replace '\.tmp$','.json'
    [System.IO.File]::WriteAllText($trustPolicyFile, $trustPolicy)
    
    try {
        # Verifier si le role existe deja
        $existingRole = aws iam get-role --role-name $roleName 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            # Creer le role
            Write-Host "Creation du role IAM..." -ForegroundColor Yellow
            aws iam create-role `
                --role-name $roleName `
                --assume-role-policy-document "file://$trustPolicyFile" `
                2>&1 | Out-Null
            
            # Attacher les politiques necessaires
            aws iam attach-role-policy `
                --role-name $roleName `
                --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole" `
                2>&1 | Out-Null
            
            Write-Host "Attente de la propagation du role..." -ForegroundColor Yellow
            Start-Sleep -Seconds 10
        } else {
            Write-Host "Role IAM existe deja" -ForegroundColor Green
        }
        
        $roleArn = aws iam get-role --role-name $roleName --query 'Role.Arn' --output text
        
        # Creer la fonction Lambda
        aws lambda create-function `
            --function-name $FunctionName `
            --runtime python3.11 `
            --role $roleArn `
            --handler lambda_function.lambda_handler `
            --zip-file "fileb://$zipFile" `
            --timeout 300 `
            --memory-size 512 `
            --environment "Variables={DATABASE_URL=$DatabaseUrl}" `
            --vpc-config "SubnetIds=$($subnetList -join ','),SecurityGroupIds=$securityGroup" `
            --region $Region `
            | Out-Null
    } finally {
        Remove-Item $trustPolicyFile -ErrorAction SilentlyContinue
    }
}

Write-Host "✅ Fonction Lambda deployee!" -ForegroundColor Green
Write-Host ""

# Executer la fonction Lambda
Write-Host "Execution de la fonction Lambda..." -ForegroundColor Cyan
$invocationResult = aws lambda invoke `
    --function-name $FunctionName `
    --region $Region `
    --payload '{}' `
    --cli-binary-format raw-in-base64-out `
    response.json `
    2>&1

if ($LASTEXITCODE -eq 0) {
    $response = Get-Content response.json | ConvertFrom-Json
    Remove-Item response.json -ErrorAction SilentlyContinue
    
    Write-Host "✅ Fonction Lambda executee avec succes!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Resultat:" -ForegroundColor Cyan
    Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor Gray
} else {
    Write-Host "❌ Erreur lors de l'execution de la fonction Lambda:" -ForegroundColor Red
    Write-Host $invocationResult -ForegroundColor Red
}

# Nettoyer
Remove-Item $zipFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ Script termine!" -ForegroundColor Green

