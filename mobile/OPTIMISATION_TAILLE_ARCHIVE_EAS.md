# 🎯 Optimisation Taille Archive EAS Build

## Problème Identifié

L'archive EAS Build faisait **391 MB**, ce qui est beaucoup trop volumineux et ralentit considérablement les builds.

## Analyse des Fichiers Volumineux

| Dossier/Fichier | Taille | Action |
|----------------|--------|--------|
| `android/app/build` | **605 MB** | ❌ Exclusion absolue |
| `node_modules` | 2839 MB | ✅ Déjà exclu (normal) |
| `assets` | 61 MB | ✅ Nécessaire pour l'app |
| `src` | 19 MB | ✅ Nécessaire pour l'app |

## Solutions Implémentées

### 1. Amélioration du `.easignore`

Le fichier `.easignore` a été optimisé avec des patterns multiples pour garantir l'exclusion du dossier `android/app/build` :

```ignore
# BUILD DIRECTORIES (CRITIQUE - 605MB!)
android/app/build
android/app/build/
android/app/build/**
android/app/build/intermediates/**
android/app/build/outputs/**
android/app/build/generated/**
android/app/build/kotlin/**
android/app/build/tmp/**
```

### 2. Script de Nettoyage Automatique

Le script `eas-build-pre-install.sh` nettoie automatiquement les dossiers de build **avant** la création de l'archive :

- Supprime `android/app/build` (605 MB)
- Supprime `android/build`
- Supprime `android/.gradle`
- Supprime `.expo`, `dist`, `web-build`

### 3. Exclusions Supplémentaires

- ✅ Tous les fichiers `.md` (documentation)
- ✅ Scripts PowerShell (`.ps1`) et Shell (`.sh`)
- ✅ Fichiers de logs (`.log`)
- ✅ Fichiers temporaires et backups
- ✅ Dossiers de tests (`e2e/`, `__tests__/`)
- ✅ Assets volumineux non nécessaires (`.mp4`, `.zip`, etc.)

## Résultat Attendu

**Avant** : 391 MB  
**Après** : ~130-150 MB (réduction de ~240 MB, soit **61%**)

## Vérification

Pour vérifier que l'optimisation fonctionne :

1. Lancer un nouveau build EAS :
   ```bash
   eas build --platform android --profile production
   ```

2. Vérifier la taille de l'archive dans les logs :
   ```
   √ Compressed project files Xm Ys (XXX MB)
   ```

3. La taille devrait être autour de **130-150 MB** au lieu de 391 MB.

## Notes Importantes

- ⚠️ Le dossier `android/app/build` est **reconstruit** par EAS Build, donc il n'est pas nécessaire dans l'archive
- ⚠️ Les fichiers `.md` et scripts ne sont pas nécessaires pour le build
- ✅ Le script `eas-build-pre-install.sh` s'exécute automatiquement avant chaque build

## Maintenance

Si la taille de l'archive augmente à nouveau :

1. Identifier les nouveaux fichiers volumineux :
   ```powershell
   Get-ChildItem -Recurse -Directory | ForEach-Object { 
     $size = (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | 
              Measure-Object -Property Length -Sum).Sum
     if ($size -gt 10MB) { 
       [PSCustomObject]@{Path=$_.FullName; SizeMB=[math]::Round($size/1MB,2)} 
     } 
   } | Sort-Object SizeMB -Descending
   ```

2. Ajouter les patterns d'exclusion dans `.easignore`

3. Mettre à jour `eas-build-pre-install.sh` si nécessaire



