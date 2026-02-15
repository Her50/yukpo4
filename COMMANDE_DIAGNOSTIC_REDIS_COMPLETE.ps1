# Diagnostic complet Redis
Write-Host "Diagnostic Redis ElastiCache" -ForegroundColor Cyan
Write-Host ""

$replicationGroupId = "yukpo-redis"
$region = "eu-west-1"

# 1. Informations de base
Write-Host "1. Informations de base:" -ForegroundColor Yellow
$basicInfo = aws elasticache describe-replication-groups --replication-group-id $replicationGroupId --region $region --query 'ReplicationGroups[0].{Status:Status,Description:Description,AutomaticFailover:AutomaticFailover.Status}' --output json | ConvertFrom-Json
$basicInfo | Format-List
Write-Host ""

# 2. Endpoints
Write-Host "2. Endpoints:" -ForegroundColor Yellow
$primaryEndpoint = aws elasticache describe-replication-groups --replication-group-id $replicationGroupId --region $region --query 'ReplicationGroups[0].PrimaryEndpoint.Address' --output text
$readerEndpoint = aws elasticache describe-replication-groups --replication-group-id $replicationGroupId --region $region --query 'ReplicationGroups[0].ReaderEndpoints[0].Address' --output text

Write-Host "Primary Endpoint: $primaryEndpoint" -ForegroundColor $(if ($primaryEndpoint -and $primaryEndpoint -ne "None") { "Green" } else { "Red" })
Write-Host "Reader Endpoint: $readerEndpoint" -ForegroundColor $(if ($readerEndpoint -and $readerEndpoint -ne "None") { "Green" } else { "Yellow" })
Write-Host ""

# 3. Node Groups
Write-Host "3. Node Groups:" -ForegroundColor Yellow
$nodeGroups = aws elasticache describe-replication-groups --replication-group-id $replicationGroupId --region $region --query 'ReplicationGroups[0].NodeGroups[*].{NodeGroupId:NodeGroupId,Status:Status,PrimaryEndpoint:PrimaryEndpoint.Address}' --output json | ConvertFrom-Json
$nodeGroups | Format-Table
Write-Host ""

# 4. Member Clusters
Write-Host "4. Member Clusters:" -ForegroundColor Yellow
$memberClusters = aws elasticache describe-replication-groups --replication-group-id $replicationGroupId --region $region --query 'ReplicationGroups[0].MemberClusters' --output text

if ($memberClusters) {
    foreach ($clusterId in $memberClusters.Split("`t")) {
        if ($clusterId) {
            Write-Host "Cluster: $clusterId" -ForegroundColor Gray
            $clusterInfo = aws elasticache describe-cache-clusters --cache-cluster-id $clusterId --region $region --show-cache-node-info --query 'CacheClusters[0].{Status:CacheClusterStatus,Engine:Engine,Endpoint:ConfigurationEndpoint.Address,Nodes:CacheNodes[*].Endpoint.Address}' --output json | ConvertFrom-Json
            
            Write-Host "  Status: $($clusterInfo.Status)" -ForegroundColor Gray
            if ($clusterInfo.Endpoint) {
                Write-Host "  Configuration Endpoint: $($clusterInfo.Endpoint)" -ForegroundColor Green
            }
            if ($clusterInfo.Nodes) {
                Write-Host "  Node Endpoints:" -ForegroundColor Gray
                foreach ($node in $clusterInfo.Nodes) {
                    Write-Host "    - $node" -ForegroundColor Gray
                }
            }
            Write-Host ""
        }
    }
} else {
    Write-Host "Aucun cluster membre trouvé" -ForegroundColor Red
}

# 5. Résumé et recommandation
Write-Host "5. Résumé:" -ForegroundColor Yellow
if ($primaryEndpoint -and $primaryEndpoint -ne "None") {
    Write-Host "✅ Endpoint disponible: $primaryEndpoint" -ForegroundColor Green
    Write-Host "REDIS_URL à utiliser: redis://$primaryEndpoint:6379/0" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  Endpoint primaire non disponible" -ForegroundColor Yellow
    
    # Essayer de trouver un endpoint via les node groups
    if ($nodeGroups) {
        foreach ($ng in $nodeGroups) {
            if ($ng.PrimaryEndpoint -and $ng.PrimaryEndpoint -ne "None") {
                Write-Host "✅ Endpoint trouvé via Node Group: $($ng.PrimaryEndpoint)" -ForegroundColor Green
                Write-Host "REDIS_URL à utiliser: redis://$($ng.PrimaryEndpoint):6379/0" -ForegroundColor Cyan
                break
            }
        }
    }
    
    if (-not ($nodeGroups | Where-Object { $_.PrimaryEndpoint -and $_.PrimaryEndpoint -ne "None" })) {
        Write-Host "❌ Aucun endpoint disponible" -ForegroundColor Red
        Write-Host "Le cluster est peut-être en cours de création ou de modification." -ForegroundColor Yellow
        Write-Host "Vérifiez dans la console AWS: ElastiCache > Replication groups > yukpo-redis" -ForegroundColor Cyan
    }
}


