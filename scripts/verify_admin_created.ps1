# Script pour verifier si le compte admin a ete cree
$REGION = "us-east-1"
$CLUSTER = "yukpomnang-cluster"
$TASK_DEFINITION = "yukpomnang-backend:4"
$CONTAINER_NAME = "backend"
$SUBNETS = "subnet-0d1d2b813746c5f87,subnet-0c6ca723d83535ef5"
$SECURITY_GROUPS = "sg-0f9210abfa33d52d4"

$sql = "SELECT id, email, role, nom_complet FROM users WHERE email = 'admin@yukpo.dev';"
$sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($sql))
$command = "echo '$sqlBase64' | base64 -d | psql `$DATABASE_URL -t -A"

$overrides = @{
    containerOverrides = @(
        @{
            name = $CONTAINER_NAME
            command = @("sh", "-c", $command)
        }
    )
}

$overridesJson = $overrides | ConvertTo-Json -Depth 10 -Compress
$tempFile = [System.IO.Path]::GetTempFileName() + ".json"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($tempFile, $overridesJson, $utf8NoBom)

$subnetsList = $SUBNETS -split ','
$securityGroupsList = $SECURITY_GROUPS -split ','
$networkConfig = 'awsvpcConfiguration={subnets=[' + ($subnetsList -join ',') + '],securityGroups=[' + ($securityGroupsList -join ',') + '],assignPublicIp=ENABLED}'

$taskArn = aws ecs run-task --region $REGION --cluster $CLUSTER --task-definition $TASK_DEFINITION --launch-type FARGATE --network-configuration $networkConfig --overrides file://$tempFile --query 'tasks[0].taskArn' --output text 2>&1

Remove-Item $tempFile -Force

Write-Host "Task creee: $taskArn"
Write-Host "Attendez 30 secondes puis verifiez les logs avec:"
Write-Host "aws logs tail /ecs/yukpomnang-backend --region $REGION --follow"



