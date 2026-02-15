# 🛑 Désactivation Automatisation DNS Cloudflare

**Date**: 2026-02-15  
**Objectif**: Arrêter l'automatisation DNS Cloudflare qui récupère l'IP publique ECS

---

## 🔍 Scripts Identifiés

### Scripts d'Automatisation DNS

1. **`scripts/mettre-a-jour-dns-cloudflare-auto.ps1`**
   - Récupère l'IP publique ECS
   - Met à jour Cloudflare automatiquement
   - **Message** : "MISE A JOUR AUTOMATIQUE DNS CLOUDFLARE"

2. **`scripts/configurer-dns-cloudflare-automatique.ps1`**
   - Configuration automatique DNS Cloudflare

3. **`scripts/configurer-tout-automatiquement.ps1`**
   - Configuration complète incluant DNS Cloudflare

4. **`scripts/configurer-dns-et-verifier-cdn.ps1`**
   - Configuration DNS et vérification CDN

---

## ✅ Solutions pour Désactiver

### Option 1: Renommer les Scripts (Recommandé)

Renommer les scripts pour les désactiver sans les supprimer :

```powershell
# Renommer les scripts pour les désactiver
Rename-Item -Path "scripts\mettre-a-jour-dns-cloudflare-auto.ps1" -NewName "mettre-a-jour-dns-cloudflare-auto.ps1.disabled"
Rename-Item -Path "scripts\configurer-dns-cloudflare-automatique.ps1" -NewName "configurer-dns-cloudflare-automatique.ps1.disabled"
Rename-Item -Path "scripts\configurer-tout-automatiquement.ps1" -NewName "configurer-tout-automatiquement.ps1.disabled"
Rename-Item -Path "scripts\configurer-dns-et-verifier-cdn.ps1" -NewName "configurer-dns-et-verifier-cdn.ps1.disabled"
```

### Option 2: Ajouter un Guard au Début des Scripts

Ajouter une vérification au début de chaque script pour les désactiver :

```powershell
# Au début de chaque script, ajouter :
$AUTOMATION_ENABLED = $false  # Désactiver l'automatisation

if (-not $AUTOMATION_ENABLED) {
    Write-Host "[INFO] Automatisation DNS Cloudflare desactivee" -ForegroundColor Yellow
    exit 0
}
```

### Option 3: Supprimer les Scripts (Définitif)

Si vous ne voulez plus jamais utiliser ces scripts :

```powershell
# Supprimer les scripts
Remove-Item -Path "scripts\mettre-a-jour-dns-cloudflare-auto.ps1"
Remove-Item -Path "scripts\configurer-dns-cloudflare-automatique.ps1"
Remove-Item -Path "scripts\configurer-tout-automatiquement.ps1"
Remove-Item -Path "scripts\configurer-dns-et-verifier-cdn.ps1"
```

---

## 🔍 Vérifier les Appels Automatiques

### 1. Vérifier les Workflows GitHub Actions

```bash
# Chercher dans les workflows
grep -r "mettre-a-jour-dns\|configurer-dns\|cloudflare.*auto" .github/workflows/
```

### 2. Vérifier les Cron Jobs AWS

Si vous avez des EventBridge Rules ou CloudWatch Events :

```bash
# Lister les règles EventBridge
aws events list-rules --region eu-west-1

# Vérifier les targets
aws events list-targets-by-rule --rule-name <nom-regle> --region eu-west-1
```

### 3. Vérifier les Lambda Functions

Si vous avez des fonctions Lambda qui appellent ces scripts :

```bash
# Lister les fonctions Lambda
aws lambda list-functions --region eu-west-1

# Vérifier les triggers
aws lambda list-event-source-mappings --region eu-west-1
```

---

## 🚀 Script de Désactivation Automatique

Créer un script pour désactiver toutes les automatisations :

```powershell
# scripts/desactiver-automatisation-dns.ps1
Write-Host "Desactivation de l'automatisation DNS Cloudflare..." -ForegroundColor Yellow

# Liste des scripts à désactiver
$scripts = @(
    "scripts\mettre-a-jour-dns-cloudflare-auto.ps1",
    "scripts\configurer-dns-cloudflare-automatique.ps1",
    "scripts\configurer-tout-automatiquement.ps1",
    "scripts\configurer-dns-et-verifier-cdn.ps1"
)

foreach ($script in $scripts) {
    if (Test-Path $script) {
        # Option 1: Renommer
        $newName = $script + ".disabled"
        if (-not (Test-Path $newName)) {
            Rename-Item -Path $script -NewName $newName
            Write-Host "  [OK] Desactive: $script" -ForegroundColor Green
        } else {
            Write-Host "  [INFO] Deja desactive: $script" -ForegroundColor Gray
        }
    }
}

Write-Host ""
Write-Host "[OK] Automatisation DNS Cloudflare desactivee!" -ForegroundColor Green
```

---

## 📋 Checklist de Désactivation

- [ ] **Scripts renommés** : `.ps1.disabled`
- [ ] **Workflows GitHub Actions** : Vérifiés (aucun appel trouvé)
- [ ] **EventBridge Rules** : Vérifiées et supprimées si nécessaire
- [ ] **Lambda Functions** : Vérifiées et désactivées si nécessaire
- [ ] **CloudWatch Events** : Vérifiés et supprimés si nécessaire

---

**✅ Une fois désactivé, l'automatisation DNS Cloudflare ne s'exécutera plus automatiquement.**

