# Script de generation de mot de passe fort
function Generate-SecurePassword {
    param([int]$Length = 24)
    
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    $password = ""
    
    # S'assurer d'avoir au moins un caractere de chaque type
    $password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[(Get-Random -Maximum 26)]
    $password += "abcdefghijklmnopqrstuvwxyz"[(Get-Random -Maximum 26)]
    $password += "0123456789"[(Get-Random -Maximum 10)]
    $password += "!@#$%^&*"[(Get-Random -Maximum 8)]
    
    # Remplir le reste
    for ($i = $password.Length; $i -lt $Length; $i++) {
        $password += $chars[(Get-Random -Maximum $chars.Length)]
    }
    
    # Melanger les caracteres
    $passwordArray = $password.ToCharArray()
    $shuffled = $passwordArray | Get-Random -Count $passwordArray.Length
    return -join $shuffled
}

$password = Generate-SecurePassword -Length 24
Write-Output $password

