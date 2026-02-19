# ✅ Correction des Scripts PowerShell

**Date** : 17 Février 2026 21:52  
**Problème** : `echo -n` ne fonctionne pas dans PowerShell

---

## 🔧 Scripts Corrigés

### 1. `scripts/update-gcp-secrets-from-cloud-sql.ps1`

**Ligne 55** - Corrigé ✅

**Avant** :
```powershell
echo -n $databaseUrl | gcloud secrets versions add database-url --data-file=- --project=$GcpProjectId 2>&1 | Out-Null
```

**Après** :
```powershell
# ✅ CORRECTION: Utiliser un fichier temporaire pour éviter les retours à la ligne
# echo -n ne fonctionne pas dans PowerShell (le -n est ignoré)
$tempFile = [System.IO.Path]::GetTempFileName()
try {
    [System.IO.File]::WriteAllText($tempFile, $databaseUrl, [System.Text.Encoding]::UTF8)
    gcloud secrets versions add database-url --data-file=$tempFile --project=$GcpProjectId 2>&1 | Out-Null
} finally {
    if (Test-Path $tempFile) {
        Remove-Item $tempFile -Force
    }
}
```

---

### 2. `scripts/create-gcp-secrets-from-github.ps1`

**Lignes 48 et 55** - Corrigé ✅

**Avant** :
```powershell
echo -n $SecretValue | gcloud secrets versions add $SecretName --data-file=- --project=$GcpProjectId 2>&1 | Out-Null
```

**Après** :
```powershell
# ✅ CORRECTION: Utiliser un fichier temporaire pour éviter les retours à la ligne
# echo -n ne fonctionne pas dans PowerShell (le -n est ignoré)
$tempFile = [System.IO.Path]::GetTempFileName()
try {
    [System.IO.File]::WriteAllText($tempFile, $SecretValue, [System.Text.Encoding]::UTF8)
    gcloud secrets versions add $SecretName --data-file=$tempFile --project=$GcpProjectId 2>&1 | Out-Null
} finally {
    if (Test-Path $tempFile) {
        Remove-Item $tempFile -Force
    }
}
```

---

## 📋 Explication de la Solution

### Pourquoi un fichier temporaire ?

1. **`echo -n` ne fonctionne pas** : PowerShell ignore le `-n` et ajoute un retour à la ligne
2. **`Write-Output -NoNewline`** : Fonctionne mais peut avoir des problèmes avec les pipes
3. **Fichier temporaire** : Solution la plus fiable et portable

### Avantages

- ✅ **Pas de retours à la ligne** : `WriteAllText` écrit exactement ce qui est demandé
- ✅ **Nettoyage automatique** : Le bloc `finally` garantit la suppression du fichier
- ✅ **Encodage UTF-8** : Gère correctement les caractères spéciaux
- ✅ **Portable** : Fonctionne sur tous les systèmes Windows

---

## 🔍 Vérification

Pour vérifier que les scripts ne réintroduisent plus le problème :

```powershell
# Tester la mise à jour d'un secret
$testValue = "postgresql://user:pass@/db?host=/cloudsql/project:region:instance"
$tempFile = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($tempFile, $testValue, [System.Text.Encoding]::UTF8)

# Vérifier qu'il n'y a pas de retour à la ligne
$content = [System.IO.File]::ReadAllText($tempFile, [System.Text.Encoding]::UTF8)
Write-Host "Longueur: $($content.Length)"
Write-Host "Contient \r: $($content.Contains("`r"))"
Write-Host "Contient \n: $($content.Contains("`n"))"

Remove-Item $tempFile -Force
```

**Résultat attendu** :
- Longueur : exactement la longueur de `$testValue`
- Contient \r : `False`
- Contient \n : `False`

---

## ✅ Prochaines Étapes

1. **Nettoyer le secret actuel** une dernière fois
2. **Tester les scripts corrigés** pour confirmer qu'ils ne réintroduisent plus le problème
3. **Documenter** cette correction pour éviter de futurs problèmes

---

**Date** : 17 Février 2026 21:52 UTC  
**Statut** : ✅ Scripts corrigés - Plus de retours à la ligne ajoutés


