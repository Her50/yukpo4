# 📊 Analyse : Fichiers Archivés > 50Mo

## 🔍 Résultats de l'Analyse

### ❌ **Fichiers > 50MB Identifiés**

| Fichier | Taille | Type | Dernière Modification | Utilité |
|---------|--------|------|----------------------|---------|
| `backend/NONE` | **899.64 MB** | Fichier binaire (sans extension) | 17/01/2026 04:14 | ❌ **À SUPPRIMER** (fichier orphelin) |
| `backend/blender/blender-4.0.0-linux-x64.tar.xz` | **264.68 MB** | Archive Blender | 15/01/2026 20:30 | ✅ **NÉCESSAIRE** (production Docker) |
| `livekit.tar.gz` | **14.95 MB** | Archive LiveKit | 13/11/2025 20:33 | ⚠️ **À VÉRIFIER** |
| `livekit-ingress.tar.gz` | **0 MB** | Archive vide | 13/11/2025 23:01 | ❌ **À SUPPRIMER** (vide) |
| `frontend/src/src.zip` | **9.93 MB** | Backup source | 10/05/2025 20:20 | ❌ **À SUPPRIMER** (backup obsolète) |
| `frontend/src/srcfrontend4.zip` | **4.83 MB** | Backup source | 14/05/2025 04:30 | ❌ **À SUPPRIMER** (backup obsolète) |
| `frontend/src/src1.zip` | **4.96 MB** | Backup source | 10/05/2025 18:04 | ❌ **À SUPPRIMER** (backup obsolète) |
| `frontend/src/srcfrontend3.zip` | **4.82 MB** | Backup source | 13/05/2025 15:58 | ❌ **À SUPPRIMER** (backup obsolète) |

---

## 🚨 **CRITIQUE : backend/NONE (899.64 MB)**

### Analyse
- **Taille** : 899.64 MB
- **Type** : Fichier binaire sans extension
- **Signature** : Commence par "Micro" (77 105 99 114 111 en hex)
- **Statut** : ❌ **FICHIER ORPHELIN / ERREUR**

### Cause Probable
Ce fichier semble être :
1. Un fichier mal nommé lors d'un téléchargement ou d'une extraction
2. Un fichier temporaire qui n'a pas été nettoyé
3. Une erreur lors d'une opération (téléchargement Blender interrompu ?)

### Recommandation
**✅ SUPPRESSION IMMÉDIATE** - Ce fichier n'a aucune utilité identifiée et consomme ~900 MB d'espace disque.

---

## ✅ **UTILE : backend/blender/blender-4.0.0-linux-x64.tar.xz (264.68 MB)**

### Analyse
- **Taille** : 264.68 MB
- **Type** : Archive Blender Linux (compressée xz)
- **Utilisation** : Rendu 3D AR en production
- **Statut** : ✅ **NÉCESSAIRE**

### Utilité
- **Dockerfile** : Copié dans l'image Docker pour le rendu Blender
- **Production** : Utilisé pour le rendu vidéo 3D AR
- **Installation** : Décompressé dans `/opt/blender` dans le conteneur Docker

### Configuration
```dockerfile
# backend/Dockerfile (lignes 114-136)
COPY blender/ /tmp/blender/
RUN tar -xf blender-4.0.0-linux-x64.tar.xz -C /tmp
mv /tmp/blender-4.0.0-linux-x64 /opt/blender
```

### Recommandation
**✅ CONSERVER** - Fichier essentiel pour le build Docker en production.

**Note** : Pour réduire l'impact sur les builds locaux, ce fichier devrait être :
- Exclu de Git (via `.gitignore`)
- Téléchargé automatiquement lors du build Docker
- Ou téléchargé manuellement via `scripts/download-blender.ps1`

---

## ⚠️ **À VÉRIFIER : livekit.tar.gz (14.95 MB)**

### Analyse
- **Taille** : 14.95 MB
- **Type** : Archive LiveKit
- **Statut** : ⚠️ **À VÉRIFIER**

### Questions
1. Est-ce un backup de configuration LiveKit ?
2. Est-ce nécessaire pour le projet ?
3. Est-ce utilisé quelque part dans le code ?

### Recommandation
**🔍 VÉRIFIER** avant suppression :
```bash
# Vérifier le contenu
tar -tzf livekit.tar.gz | head -20

# Rechercher les références dans le code
grep -r "livekit.tar.gz" .
```

Si non utilisé → **SUPPRIMER**

---

## ❌ **À SUPPRIMER : Archives Backup Frontend**

### Fichiers Identifiés
1. `frontend/src/src.zip` - 9.93 MB
2. `frontend/src/srcfrontend4.zip` - 4.83 MB
3. `frontend/src/src1.zip` - 4.96 MB
4. `frontend/src/srcfrontend3.zip` - 4.82 MB
5. `frontend/src/components.zip` - 0.06 MB
6. `frontend/src/pages.zip` - 0.13 MB
7. `frontend/src/componens.zip` - (taille non vérifiée)

### Analyse
- **Type** : Backups de code source
- **Date** : Mai 2025 (obsolètes)
- **Utilité** : Aucune (backups obsolètes)
- **Statut** : ❌ **À SUPPRIMER**

### Recommandation
**✅ SUPPRIMER TOUS** - Ces fichiers sont des backups obsolètes du code source. Le code actuel est dans Git.

---

## ❌ **À SUPPRIMER : livekit-ingress.tar.gz (0 MB)**

### Analyse
- **Taille** : 0 MB (fichier vide)
- **Type** : Archive vide
- **Statut** : ❌ **À SUPPRIMER**

### Recommandation
**✅ SUPPRIMER** - Fichier vide sans utilité.

---

## 📋 Plan d'Action Recommandé

### Priorité CRITIQUE (900 MB)

1. **Supprimer `backend/NONE`**
   ```powershell
   Remove-Item "backend\NONE" -Force
   ```
   **Gain** : ~900 MB

### Priorité HAUTE (25 MB)

2. **Supprimer les backups frontend**
   ```powershell
   Remove-Item "frontend\src\*.zip" -Force
   ```
   **Gain** : ~25 MB

3. **Supprimer livekit-ingress.tar.gz (vide)**
   ```powershell
   Remove-Item "livekit-ingress.tar.gz" -Force
   ```

### Priorité MOYENNE (15 MB)

4. **Vérifier et supprimer livekit.tar.gz si inutile**
   ```powershell
   # Vérifier d'abord
   # Si inutile:
   Remove-Item "livekit.tar.gz" -Force
   ```
   **Gain potentiel** : ~15 MB

### Optimisation Blender (Optionnel)

5. **Optimiser la gestion de Blender**
   - Ajouter `backend/blender/` à `.gitignore` (si pas déjà fait)
   - Documenter le téléchargement via script

---

## 💾 Espace Disque Récupérable

| Action | Espace Récupéré |
|--------|----------------|
| Supprimer `backend/NONE` | **~900 MB** |
| Supprimer backups frontend | **~25 MB** |
| Supprimer `livekit-ingress.tar.gz` | **0 MB** (vide) |
| Supprimer `livekit.tar.gz` (si inutile) | **~15 MB** |
| **TOTAL POTENTIEL** | **~940 MB** |

---

## ⚙️ Script de Nettoyage Automatique

```powershell
# Script de nettoyage des fichiers volumineux inutiles
Write-Host "🧹 Nettoyage des fichiers volumineux..." -ForegroundColor Cyan

# Supprimer backend/NONE
if (Test-Path "backend\NONE") {
    $size = (Get-Item "backend\NONE").Length / 1MB
    Remove-Item "backend\NONE" -Force
    Write-Host "✅ Supprimé backend\NONE ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
}

# Supprimer backups frontend
$backups = @(
    "frontend\src\src.zip",
    "frontend\src\src1.zip",
    "frontend\src\srcfrontend3.zip",
    "frontend\src\srcfrontend4.zip",
    "frontend\src\components.zip",
    "frontend\src\pages.zip",
    "frontend\src\componens.zip"
)

$totalBackupSize = 0
foreach ($backup in $backups) {
    if (Test-Path $backup) {
        $size = (Get-Item $backup).Length / 1MB
        $totalBackupSize += $size
        Remove-Item $backup -Force
        Write-Host "✅ Supprimé $backup ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
    }
}

# Supprimer livekit-ingress.tar.gz (vide)
if (Test-Path "livekit-ingress.tar.gz") {
    Remove-Item "livekit-ingress.tar.gz" -Force
    Write-Host "✅ Supprimé livekit-ingress.tar.gz (vide)" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ Nettoyage terminé!" -ForegroundColor Green
Write-Host "   Espace récupéré: ~$([math]::Round($totalBackupSize, 2)) MB (sans backend/NONE)" -ForegroundColor Cyan
```

---

## 📝 Notes Importantes

### Fichier Blender
- **NE PAS SUPPRIMER** `backend/blender/blender-4.0.0-linux-x64.tar.xz`
- Ce fichier est nécessaire pour les builds Docker en production
- Pour réduire l'impact :
  - L'exclure de Git (via `.gitignore`)
  - Le télécharger automatiquement dans le Dockerfile (recommandé)
  - Ou le télécharger manuellement avant le build

### Backups
- Les fichiers `.zip` dans `frontend/src/` sont des backups obsolètes
- Le code source actuel est dans Git, donc ces backups sont inutiles
- **Sécurité** : Assurez-vous que Git est à jour avant suppression

---

## ✅ Validation Post-Suppression

Après suppression, vérifier :
```powershell
# Vérifier l'espace libéré
Get-ChildItem -Path . -Recurse -File -ErrorAction SilentlyContinue | 
    Where-Object { $_.Length -gt 50MB } | 
    Select-Object FullName, @{Name="Size(MB)";Expression={[math]::Round($_.Length/1MB,2)}}
```

---

**Date d'analyse** : 17 Janvier 2026  
**Prochain nettoyage recommandé** : Mensuel


