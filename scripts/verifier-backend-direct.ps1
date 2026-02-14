# Verification de l'acces direct au backend ECS
param(
    [string]$Region = "eu-west-1",
    [string]$ClusterName = "yukpo-cluster",
    [string]$ServiceName = "yukpo-backend-service"
)

Write-Host "Verification de l'acces direct au backend ECS..." -ForegroundColor Cyan
Write-Host ""

# Recuperer l'IP publique de la tache ECS
Write-Host "[1] Recuperation de l'IP publique de la tache ECS..." -ForegroundColor Yellow
try {
    $taskArn = aws ecs list-tasks --cluster $ClusterName --service-name $ServiceName --region $Region --desired-status RUNNING --query 'taskArns[0]' --output text
    
    if ($taskArn) {
        Write-Host "  [OK] Tache trouvee: $taskArn" -ForegroundColor Green
        
        # Recuperer les details de la tache
        $taskDetails = aws ecs describe-tasks --cluster $ClusterName --tasks $taskArn --region $Region --query 'tasks[0]' --output json | ConvertFrom-Json
        
        # Recuperer l'ENI ID
        $eniId = $taskDetails.attachments[0].details | Where-Object { $_.name -eq "networkInterfaceId" } | Select-Object -ExpandProperty value
        
        if ($eniId) {
            Write-Host "  [OK] ENI ID: $eniId" -ForegroundColor Green
            
            # Recuperer l'IP publique depuis l'ENI
            $eniDetails = aws ec2 describe-network-interfaces --network-interface-ids $eniId --region $Region --query 'NetworkInterfaces[0]' --output json | ConvertFrom-Json
            
            if ($eniDetails.Association.PublicIp) {
                $publicIp = $eniDetails.Association.PublicIp
                Write-Host "  [OK] IP Publique: $publicIp" -ForegroundColor Green
                
                # Tester la connectivite
                Write-Host ""
                Write-Host "[2] Test de connectivite vers ${publicIp}:8080..." -ForegroundColor Yellow
                try {
                    $healthUrl = "http://${publicIp}:8080/health"
                    Write-Host "  [INFO] URL testee: $healthUrl" -ForegroundColor Gray
                    $response = Invoke-WebRequest -Uri $healthUrl -Method GET -TimeoutSec 10 -ErrorAction SilentlyContinue
                    if ($response.StatusCode -eq 200) {
                        Write-Host "  [OK] Backend accessible via IP publique!" -ForegroundColor Green
                        Write-Host "  [INFO] URL: http://$publicIp:8080" -ForegroundColor Gray
                        Write-Host "  [INFO] Code HTTP: $($response.StatusCode)" -ForegroundColor Gray
                        Write-Host ""
                        Write-Host "  [ACTION] Mettre a jour le DNS api.yukpomnang.com pour pointer vers cette IP" -ForegroundColor Yellow
                        Write-Host "  [INFO] Note: Cette IP peut changer a chaque redemarrage ECS" -ForegroundColor Gray
                        Write-Host "  [INFO] Solution recommandee: Activer le Load Balancer pour une URL stable" -ForegroundColor Gray
                    } else {
                        Write-Host "  [ATTENTION] Backend repond avec le code: $($response.StatusCode)" -ForegroundColor Yellow
                    }
                } catch {
                    Write-Host "  [ERREUR] Impossible de se connecter: $($_.Exception.Message)" -ForegroundColor Red
                    Write-Host "  [INFO] Verifier le Security Group autorise le trafic depuis Internet" -ForegroundColor Gray
                }
            } else {
                Write-Host "  [ATTENTION] Aucune IP publique trouvee" -ForegroundColor Yellow
                Write-Host "  [INFO] Le service ECS n'a peut-etre pas d'IP publique assignee" -ForegroundColor Gray
            }
        } else {
            Write-Host "  [ERREUR] Impossible de recuperer l'ENI ID" -ForegroundColor Red
        }
    } else {
        Write-Host "  [ERREUR] Aucune tache en cours d'execution" -ForegroundColor Red
    }
} catch {
    Write-Host "  [ERREUR] Erreur lors de la recuperation: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Verification terminee!" -ForegroundColor Cyan

