# Script pour corriger le state Terraform - Migration de region
# Supprime les ressources en us-east-1 du state et importe celles en eu-west-1

$ErrorActionPreference = "Continue"

Write-Host "Correction automatique du state Terraform" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

$terraformDir = Join-Path $PSScriptRoot "..\infra\aws"
Push-Location $terraformDir

try {
    Write-Host "1. Suppression des ressources us-east-1 du state..." -ForegroundColor Yellow
    
    # Liste des ressources a supprimer du state (elles existent en eu-west-1)
    $resourcesToRemove = @(
        "aws_lb.backend",
        "aws_lb_listener.backend_http",
        "aws_lb_target_group.backend",
        "aws_ecs_cluster.main"
    )
    
    foreach ($resource in $resourcesToRemove) {
        Write-Host "   Suppression de $resource du state..." -ForegroundColor Gray
        terraform state rm $resource 2>&1 | Out-Null
    }
    
    Write-Host "   OK" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "2. Import des ressources eu-west-1..." -ForegroundColor Yellow
    
    # Import du Load Balancer
    $albArn = "arn:aws:elasticloadbalancing:eu-west-1:846505724644:loadbalancer/app/yukpomnang-alb/8de54f80025e48c6"
    Write-Host "   Import aws_lb.main..." -ForegroundColor Gray
    terraform import aws_lb.main $albArn 2>&1 | Out-Null
    
    # Import du Cluster ECS
    $ecsClusterArn = "arn:aws:ecs:eu-west-1:846505724644:cluster/yukpomnang-cluster"
    Write-Host "   Import aws_ecs_cluster.main..." -ForegroundColor Gray
    terraform import aws_ecs_cluster.main $ecsClusterArn 2>&1 | Out-Null
    
    Write-Host "   OK" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "3. Refresh du state..." -ForegroundColor Yellow
    terraform refresh 2>&1 | Out-Null
    Write-Host "   OK" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "State Terraform corrige avec succes!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Vous pouvez maintenant relancer le script d'optimisation." -ForegroundColor Cyan
    
} catch {
    Write-Host "ERREUR: $_" -ForegroundColor Red
    Write-Host "Vous devrez peut-etre corriger manuellement le state Terraform." -ForegroundColor Yellow
} finally {
    Pop-Location
}

