# 📱 Distribution de l'APK via QR Code

## 🎯 Méthode 1 : Serveur Local (RAPIDE - GRATUIT)

### Option A : Script PowerShell
```powershell
cd mobile
.\servir-apk-qr.ps1
```

### Option B : Script Python
```powershell
cd mobile
pip install qrcode[pil]
python servir-apk-qr.py
```

**Avantages** :
- ✅ Gratuit
- ✅ Instantané
- ✅ Pas de limite de téléchargements
- ✅ Contrôle total

**Inconvénients** :
- ⚠️ Téléphone et PC doivent être sur le MÊME WIFI
- ⚠️ Le serveur doit rester actif pendant le téléchargement

---

## 🌐 Méthode 2 : Services Cloud

### Option A : Diawi (Recommandé pour partage externe)

1. Allez sur https://www.diawi.com/
2. Uploadez votre APK : `mobile\android\app\build\outputs\apk\debug\app-debug.apk`
3. Diawi génère un lien et un QR code
4. **Gratuit** pour usage basique

### Option B : Firebase App Distribution

1. Allez sur https://console.firebase.google.com/
2. Créez un projet
3. Allez dans "App Distribution"
4. Uploadez l'APK
5. Firebase génère un lien de téléchargement

**Avantages** :
- ✅ Accessible de n'importe où
- ✅ Pas besoin de serveur local
- ✅ Statistiques de téléchargement
- ✅ Gestion des versions

**Inconvénients** :
- ⚠️ Nécessite un compte
- ⚠️ Upload peut être lent

### Option C : GitHub Releases

1. Créez un nouveau Release sur GitHub
2. Uploadez l'APK comme asset
3. Générez un QR code avec l'URL du release

---

## 🔧 Méthode 3 : QR Code Manuel

### Étape 1 : Héberger l'APK

**Option 1 : Google Drive**
1. Uploadez l'APK sur Google Drive
2. Clic droit → Obtenir le lien → Partager
3. Rendez-le accessible à "Tous ceux qui ont le lien"

**Option 2 : Dropbox**
1. Uploadez l'APK
2. Créez un lien de partage

### Étape 2 : Générer le QR Code

**En ligne** :
- https://www.qr-code-generator.com/
- https://www.qrcode-monkey.com/

**Via PowerShell** :
```powershell
# Installer le module
Install-Module -Name QRCodeGenerator

# Générer le QR code
$url = "https://votre-lien-apk.com/app-debug.apk"
New-QRCodeURI -URI $url -OutPath "qrcode.png"
```

**Via Python** :
```python
import qrcode

url = "https://votre-lien-apk.com/app-debug.apk"
qr = qrcode.QRCode()
qr.add_data(url)
qr.print_ascii()
# OU sauvegarder en image
qr.make_image().save("qrcode.png")
```

---

## 📲 Installation sur Android

Une fois le QR code scanné :

1. **Scanner le QR code** avec l'appareil photo ou une app QR
2. **Télécharger l'APK**
3. **Autoriser les sources inconnues** :
   - Paramètres → Sécurité → Sources inconnues → Activer
   - OU lors de l'installation, Android demandera l'autorisation
4. **Installer l'APK**

---

## 🚀 Utilisation Rapide

### 1. Démarrer le serveur local
```powershell
cd C:\Users\23767\yukpomnang2\mobile
.\servir-apk-qr.ps1
```

### 2. Scanner le QR code affiché

### 3. Télécharger et installer

---

## 🔐 Sécurité

### APK Debug (actuel)
- ⚠️ Non signé avec votre clé de production
- ⚠️ Permissions de débogage activées
- ✅ Parfait pour tests internes
- ❌ NE PAS distribuer publiquement

### Pour distribution publique
Générez un **APK Release** signé :
```powershell
cd mobile
.\BUILD-APK-RELEASE.bat
```

---

## 📊 Comparaison des méthodes

| Méthode | Vitesse | Gratuit | Facilité | Portée |
|---------|---------|---------|----------|--------|
| Serveur Local | ⚡⚡⚡ | ✅ | ⭐⭐⭐ | Même réseau |
| Diawi | ⚡⚡ | ✅ | ⭐⭐⭐⭐ | Mondiale |
| Firebase | ⚡ | ✅ | ⭐⭐⭐ | Mondiale |
| Google Drive | ⚡⚡ | ✅ | ⭐⭐⭐⭐⭐ | Mondiale |

---

## 🆘 Dépannage

### "Installation bloquée"
- Activez "Sources inconnues" dans les paramètres Android

### "Fichier corrompu"
- Re-téléchargez l'APK
- Vérifiez la taille du fichier

### "App non compatible"
- Vérifiez que c'est un appareil Android (pas iOS)
- Vérifiez la version Android minimum (API 24 / Android 7.0)

### QR code ne s'affiche pas
```powershell
# Installer les dépendances
npm install -g qrcode-terminal
# OU
pip install qrcode[pil]
```

---

## 💡 Conseil Pro

Pour un partage professionnel, utilisez **Firebase App Distribution** :
- Notifications aux testeurs
- Gestion des versions
- Statistiques d'utilisation
- Notes de version
- Groupes de testeurs

