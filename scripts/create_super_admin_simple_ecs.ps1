# Script simple pour creer le compte SUPER SUPER ADMIN via ECS Task
# Utilise directement le SQL via sqlx dans le conteneur Rust
# Usage: .\scripts\create_super_admin_simple_ecs.ps1

$REGION = "us-east-1"
$CLUSTER = "yukpomnang-cluster"
$TASK_DEFINITION = "yukpomnang-backend:4"
$CONTAINER_NAME = "backend"
$SUBNETS = "subnet-0d1d2b813746c5f87,subnet-0c6ca723d83535ef5"
$SECURITY_GROUPS = "sg-0f9210abfa33d52d4"

Write-Host "[ADMIN] Creation du compte SUPER SUPER ADMIN via ECS" -ForegroundColor Green
Write-Host ""

# SQL direct pour creer/mettre a jour le super admin
$sqlCommand = @"
INSERT INTO users (email, password_hash, role, nom_complet, tokens_balance, token_price_user, token_price_provider, commission_pct, preferred_lang, is_provider, created_at, updated_at)
VALUES ('admin@yukpo.dev', '$2b$12$yi.th1fxm9Xrz6A.PjP9wuWyDrueHMZZBReIH7i7X.efPhGNV1Pii', 'super_admin', 'Super Super Admin', 1000000, 1.0, 1.0, 0.0, 'fr', false, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'super_admin', nom_complet = EXCLUDED.nom_complet, updated_at = NOW();
SELECT id, email, role, nom_complet FROM users WHERE email = 'admin@yukpo.dev';
"@

# Encoder en base64
$sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($sqlCommand))

# Creer la commande qui execute le SQL via Rust (en utilisant sqlx directement)
# On va utiliser un script inline qui execute le SQL
$rustScript = @"
use sqlx::postgres::PgPoolOptions;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = env::var("DATABASE_URL")?;
    let pool = PgPoolOptions::new().max_connections(5).connect(&database_url).await?;
    
    sqlx::query(r#"
        INSERT INTO users (email, password_hash, role, nom_complet, tokens_balance, token_price_user, token_price_provider, commission_pct, preferred_lang, is_provider, created_at, updated_at)
        VALUES ('admin@yukpo.dev', '$2b$12$yi.th1fxm9Xrz6A.PjP9wuWyDrueHMZZBReIH7i7X.efPhGNV1Pii', 'super_admin', 'Super Super Admin', 1000000, 1.0, 1.0, 0.0, 'fr', false, NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'super_admin', nom_complet = EXCLUDED.nom_complet, updated_at = NOW();
    "#).execute(&pool).await?;
    
    let result = sqlx::query("SELECT id, email, role, nom_complet FROM users WHERE email = 'admin@yukpo.dev'")
        .fetch_one(&pool).await?;
    
    println!("[OK] Super admin cree/mis a jour:");
    println!("  ID: {}", result.get::<i32, _>("id"));
    println!("  Email: {}", result.get::<String, _>("email"));
    println!("  Role: {}", result.get::<String, _>("role"));
    println!("  Nom: {}", result.get::<Option<String>, _>("nom_complet").unwrap_or_default());
    
    Ok(())
}
"@

# La solution la plus simple: utiliser le binaire create_admin_user qui existe deja
# mais il faut s'assurer qu'il est dans l'image Docker
# Essayons avec cargo run --bin create_admin_user

$overrides = @{
    containerOverrides = @(
        @{
            name = $CONTAINER_NAME
            command = @(
                "sh", "-c", "cargo run --bin create_admin_user || /app/backend create_admin_user || echo 'Binary not found, trying alternative method'"
            )
        }
    )
}

$overridesJson = $overrides | ConvertTo-Json -Depth 10 -Compress
$tempFile = [System.IO.Path]::GetTempFileName() + ".json"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($tempFile, $overridesJson, $utf8NoBom)

Write-Host "[RUN] Execution de la task ECS..." -ForegroundColor Green

$subnetsList = $SUBNETS -split ','
$securityGroupsList = $SECURITY_GROUPS -split ','
$networkConfig = 'awsvpcConfiguration={subnets=[' + ($subnetsList -join ',') + '],securityGroups=[' + ($securityGroupsList -join ',') + '],assignPublicIp=ENABLED}'

$taskResult = aws ecs run-task `
    --region $REGION `
    --cluster $CLUSTER `
    --task-definition $TASK_DEFINITION `
    --launch-type FARGATE `
    --network-configuration $networkConfig `
    --overrides file://$tempFile `
    --query 'tasks[0].taskArn' `
    --output text 2>&1

Remove-Item $tempFile -Force -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    $taskArn = $taskResult.Trim()
    Write-Host "[OK] Task creee: $taskArn" -ForegroundColor Green
    Write-Host "[INFO] Verifiez les logs avec:" -ForegroundColor Cyan
    Write-Host "   aws logs tail /ecs/yukpomnang-backend --region $REGION --follow" -ForegroundColor White
} else {
    Write-Host "[ERROR] Erreur: $taskResult" -ForegroundColor Red
}

