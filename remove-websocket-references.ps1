# Script pour supprimer toutes les références WebSocket de ResultatBesoin.tsx
Write-Host "🧹 Nettoyage des références WebSocket..." -ForegroundColor Cyan

$filePath = "frontend/src/pages/ResultatBesoin.tsx"
$content = Get-Content $filePath -Raw

# Liste des patterns à supprimer
$patterns = @(
    # Variables et états WebSocket
    'const \{ isConnected: wsConnected, checkUserStatus, userStatus \} = usePrestataireStatus\(',
    'const \{ isConnected: notificationsConnected, notifications \} = useNotificationsWebSocket\(',
    'const \[wsMetrics, setWsMetrics\] = useState\(',
    'const \[wsTypingStatus, setWsTypingStatus\] = useState\(false\);',
    'const \[typingUsers, setTypingUsers\] = useState<Set<number>>\(new Set\(\)\);',
    
    # Fonctions WebSocket
    'const handleTypingIndicator = \(serviceId: number, isTyping: boolean\) => \{[\s\S]*?\};',
    'const updateWsMetrics = \(type: \'sent\' \| \'received\' \| \'ping\', value\?\: number\) => \{[\s\S]*?\};',
    
    # Imports WebSocket
    'import \{ usePrestataireStatus, useNotificationsWebSocket \} from \'@/hooks/useWebSocket\';',
    
    # Conditions WebSocket
    'if \(wsConnected\) \{[\s\S]*?\}',
    'if \(notificationsConnected\) \{[\s\S]*?\}',
    '\{wsConnected \? \([\s\S]*?\) : \([\s\S]*?\)\}',
    '\{notificationsConnected \? \([\s\S]*?\) : \([\s\S]*?\)\}',
    
    # Props WebSocket
    'wsConnected=\{wsConnected\}',
    'notificationsConnected=\{notificationsConnected\}',
    
    # Métriques WebSocket
    'wsMetrics\.messagesSent',
    'wsMetrics\.messagesReceived',
    'wsMetrics\.latency',
    
    # Variables individuelles
    'wsConnected',
    'notificationsConnected',
    'wsMetrics',
    'typingUsers',
    'setTypingUsers',
    'setWsMetrics',
    'checkUserStatus',
    'userStatus',
    'handleTypingIndicator',
    'updateWsMetrics'
)

Write-Host "Suppression des patterns WebSocket..." -ForegroundColor Yellow

foreach ($pattern in $patterns) {
    $oldContent = $content
    $content = $content -replace $pattern, ''
    
    if ($content -ne $oldContent) {
        Write-Host "✅ Pattern supprimé: $pattern" -ForegroundColor Green
    }
}

# Nettoyer les lignes vides multiples
$content = $content -replace '\n\s*\n\s*\n', "`n`n"

# Sauvegarder le fichier
$content | Out-File -FilePath $filePath -Encoding UTF8

Write-Host "`n🎉 Nettoyage terminé !" -ForegroundColor Green
Write-Host "Fichier sauvegardé: $filePath" -ForegroundColor Cyan 