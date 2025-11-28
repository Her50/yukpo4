# Solutions : Docker Desktop ne démarre pas

## Problème : "We're redirecting you to the desktop app"

Ce message apparaît généralement quand :
1. Docker Desktop n'est pas complètement installé
2. Docker Desktop est installé mais ne démarre pas
3. Problème de redirection entre le navigateur et l'application

---

## Solution 1 : Vérifier l'installation

### Étape 1 : Diagnostic automatique
```powershell
.\scripts\diagnostic_docker.ps1
```

Ce script vérifie :
- ✅ Si Docker Desktop est installé
- ✅ Si Docker Desktop est en cours d'exécution
- ✅ Si WSL2 est installé (requis)
- ✅ Si les services Windows sont actifs
- ✅ Si docker.exe est accessible

### Étape 2 : Vérifier manuellement

1. **Vérifier l'installation :**
   - Ouvrir le **menu Démarrer**
   - Rechercher **"Docker Desktop"**
   - Si trouvé → Docker est installé
   - Si non trouvé → Docker n'est pas installé

2. **Vérifier les fichiers :**
   - `C:\Program Files\Docker\Docker\Docker Desktop.exe`
   - `C:\Users\VotreNom\AppData\Local\Programs\Docker\Docker\Docker Desktop.exe`

---

## Solution 2 : Démarrer Docker Desktop manuellement

### Méthode 1 : Menu Démarrer
1. Ouvrir le **menu Démarrer** (Windows)
2. Rechercher **"Docker Desktop"**
3. **Clic droit** sur "Docker Desktop"
4. Sélectionner **"Exécuter en tant qu'administrateur"**

### Méthode 2 : Fichier exécutable
1. Ouvrir l'**Explorateur de fichiers**
2. Aller à : `C:\Program Files\Docker\Docker\`
3. **Clic droit** sur `Docker Desktop.exe`
4. Sélectionner **"Exécuter en tant qu'administrateur"**

### Méthode 3 : Script PowerShell
```powershell
.\scripts\start_docker.ps1
```

---

## Solution 3 : Vérifier WSL2 (Windows Subsystem for Linux)

Docker Desktop nécessite WSL2 sur Windows.

### Vérifier WSL
```powershell
wsl --version
```

### Installer WSL2 (si manquant)
1. Ouvrir **PowerShell en tant qu'administrateur**
2. Exécuter :
   ```powershell
   wsl --install
   ```
3. **Redémarrer l'ordinateur**

### Mettre à jour WSL2
```powershell
wsl --update
```

---

## Solution 4 : Réparer Docker Desktop

### Option 1 : Réinstallation rapide
1. **Désinstaller** Docker Desktop (ne pas supprimer les données)
2. **Télécharger** la dernière version : https://www.docker.com/products/docker-desktop
3. **Réinstaller** Docker Desktop
4. **Redémarrer** l'ordinateur

### Option 2 : Réparation via Windows
1. Ouvrir **Paramètres Windows**
2. Aller à **Applications** > **Applications et fonctionnalités**
3. Rechercher **"Docker Desktop"**
4. Cliquer sur **"Options avancées"** > **"Réparer"**

---

## Solution 5 : Vérifier les services Windows

### Vérifier les services Docker
```powershell
# Ouvrir PowerShell en tant qu'administrateur
Get-Service | Where-Object {$_.Name -like "*docker*"}
```

### Démarrer les services manuellement
```powershell
# En tant qu'administrateur
Start-Service com.docker.service
```

---

## Solution 6 : Problèmes de permissions

### Exécuter en tant qu'administrateur
1. **Clic droit** sur PowerShell
2. Sélectionner **"Exécuter en tant qu'administrateur"**
3. Exécuter :
   ```powershell
   .\scripts\start_docker.ps1
   ```

### Vérifier les permissions de fichier
1. Aller à : `C:\Program Files\Docker\Docker\`
2. **Clic droit** sur le dossier `Docker`
3. **Propriétés** > **Sécurité**
4. Vérifier que votre utilisateur a les permissions **Lecture et exécution**

---

## Solution 7 : Problèmes d'antivirus/firewall

### Désactiver temporairement l'antivirus
1. Ouvrir votre **antivirus**
2. Désactiver temporairement la **protection en temps réel**
3. Essayer de démarrer Docker Desktop
4. Réactiver l'antivirus

### Ajouter Docker aux exceptions
1. Ouvrir votre **antivirus**
2. Aller aux **exceptions/exclusions**
3. Ajouter :
   - `C:\Program Files\Docker\`
   - `C:\Users\VotreNom\AppData\Local\Programs\Docker\`

---

## Solution 8 : Nettoyer et réinstaller

### Nettoyer complètement Docker
```powershell
# En tant qu'administrateur
# 1. Arrêter tous les conteneurs
docker stop $(docker ps -aq)

# 2. Supprimer tous les conteneurs
docker rm $(docker ps -aq)

# 3. Désinstaller Docker Desktop
# Via Paramètres Windows > Applications
```

### Réinstaller proprement
1. **Désinstaller** Docker Desktop
2. **Supprimer** les dossiers restants :
   - `C:\Program Files\Docker\`
   - `C:\Users\VotreNom\AppData\Local\Docker\`
   - `C:\Users\VotreNom\AppData\Roaming\Docker\`
3. **Redémarrer** l'ordinateur
4. **Télécharger** et **installer** Docker Desktop
5. **Redémarrer** l'ordinateur

---

## Solution 9 : Vérifier les logs

### Logs Docker Desktop
1. Ouvrir **Event Viewer** (Observateur d'événements)
2. Aller à **Windows Logs** > **Application**
3. Filtrer par **Source : Docker**

### Logs dans les fichiers
- `C:\Users\VotreNom\AppData\Local\Docker\log.txt`
- `C:\Users\VotreNom\AppData\Roaming\Docker\log.txt`

---

## Solution 10 : Redémarrer complètement

### Redémarrage complet
1. **Fermer** toutes les applications
2. **Redémarrer** l'ordinateur
3. **Attendre** que Windows soit complètement chargé
4. **Démarrer** Docker Desktop
5. **Attendre** 30-60 secondes

---

## Vérification finale

Une fois Docker Desktop démarré, vérifiez :

```powershell
# Ouvrir un NOUVEAU PowerShell
docker --version
# Devrait afficher : Docker version 24.x.x

docker ps
# Devrait afficher la liste des conteneurs (peut être vide)
```

---

## Ordre de priorité des solutions

1. ✅ **Solution 1** : Diagnostic automatique
2. ✅ **Solution 2** : Démarrer manuellement en tant qu'administrateur
3. ✅ **Solution 3** : Vérifier/installer WSL2
4. ✅ **Solution 10** : Redémarrer l'ordinateur
5. ✅ **Solution 4** : Réparer Docker Desktop
6. ✅ **Solution 8** : Nettoyer et réinstaller

---

## Support supplémentaire

- **Documentation Docker** : https://docs.docker.com/desktop/troubleshoot/
- **Forum Docker** : https://forums.docker.com/
- **GitHub Issues** : https://github.com/docker/for-win/issues

---

**Date de création :** 2025-11-28

