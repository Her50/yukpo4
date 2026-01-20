# 🔧 Correction du problème DNS Docker Desktop

## 🚨 Problème

Erreur lors du build Docker :
```
lookup registry-1.docker.io: no such host
```

Cela indique que Docker Desktop ne peut pas résoudre les noms de domaine depuis les conteneurs.

## ✅ Solution : Configurer les DNS dans Docker Desktop

### Méthode 1 : Via l'interface Docker Desktop (Recommandé)

1. **Ouvrir Docker Desktop**
   - Cliquez sur l'icône Docker dans la barre des tâches
   - Cliquez sur l'icône ⚙️ (Settings) en haut à droite

2. **Accéder aux paramètres Docker Engine**
   - Dans le menu de gauche, cliquez sur **"Docker Engine"**

3. **Ajouter les serveurs DNS**
   - Dans la zone de texte JSON, ajoutez/modifiez la section `dns` :
   ```json
   {
     "dns": ["8.8.8.8", "1.1.1.1", "8.8.4.4"]
   }
   ```

4. **Appliquer les changements**
   - Cliquez sur **"Apply & Restart"**
   - Attendez que Docker Desktop redémarre

### Méthode 2 : Via le fichier daemon.json (Avancé)

1. **Localiser le fichier de configuration**
   - Ouvrir : `%USERPROFILE%\.docker\daemon.json`
   - Ou créer le fichier s'il n'existe pas

2. **Ajouter la configuration DNS**
   ```json
   {
     "dns": ["8.8.8.8", "1.1.1.1", "8.8.4.4"]
   }
   ```

3. **Redémarrer Docker Desktop**
   - Quitter complètement Docker Desktop
   - Relancer Docker Desktop

## 🔍 Vérification

Après configuration, tester la résolution DNS :

```powershell
# Tester depuis PowerShell (doit fonctionner)
Test-NetConnection -ComputerName registry-1.docker.io -Port 443

# Tester depuis un conteneur Docker
docker run --rm alpine nslookup registry-1.docker.io
```

## 📝 Serveurs DNS recommandés

- **Google DNS** : `8.8.8.8`, `8.8.4.4`
- **Cloudflare DNS** : `1.1.1.1`, `1.0.0.1`
- **OpenDNS** : `208.67.222.222`, `208.67.220.220`

## 🚀 Après correction

Relancer le build :
```powershell
.\scripts\build-backend-docker.ps1 -Test
```

## ⚠️ Problèmes persistants

Si le problème persiste après configuration DNS :

1. **Vérifier la connexion Internet**
   ```powershell
   Test-NetConnection -ComputerName google.com -Port 80
   ```

2. **Vérifier les paramètres de proxy**
   - Docker Desktop > Settings > Resources > Proxies
   - Si vous utilisez un proxy, configurez-le correctement

3. **Redémarrer complètement Docker Desktop**
   - Quitter Docker Desktop
   - Attendre 10 secondes
   - Relancer Docker Desktop

4. **Vérifier les paramètres réseau Windows**
   - Paramètres > Réseau et Internet > Modifier les options de la carte
   - Vérifier que la carte réseau est active

5. **Réinitialiser Docker Desktop** (dernier recours)
   - Docker Desktop > Troubleshoot > Reset to factory defaults
   - ⚠️ Cela supprimera toutes les images et conteneurs locaux





