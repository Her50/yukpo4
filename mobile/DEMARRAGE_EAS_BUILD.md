# 🚀 Démarrage Rapide - EAS Build

## 📌 Configuration Terminée !

Votre application mobile Yukpomnang est maintenant configurée pour le build EAS. Voici les étapes pour lancer votre premier build.

## ⚡ Commandes Rapides

### 1️⃣ Vérifier la Configuration (OBLIGATOIRE)

```powershell
cd mobile
powershell -ExecutionPolicy Bypass -File ./verif-eas.ps1
```

Ce script va vérifier :
- ✅ Node.js et npm
- ✅ Expo CLI
- ✅ EAS CLI (et l'installer si nécessaire)
- ✅ Tous les fichiers requis
- ✅ Votre connexion Expo
- ✅ Les dépendances

### 2️⃣ Installer EAS CLI (si pas déjà fait)

```bash
npm install -g eas-cli
```

### 3️⃣ Se Connecter à Expo

```bash
eas login
```

**Compte à utiliser** : `hernandezlele`

### 4️⃣ Installer les Dépendances (si nécessaire)

```bash
cd mobile
npm install
```

### 5️⃣ Lancer le Build !

```bash
# Option 1 : Via npm script
npm run build:preview

# Option 2 : Directement avec npx
npx eas build --platform android --profile preview
```

## 📊 Que va-t-il se passer ?

1. **Upload** (~2-5 min) : Votre code sera uploadé sur les serveurs Expo
2. **Installation** (~3-5 min) : Les dépendances seront installées
3. **Compilation** (~5-10 min) : Android compilera votre app
4. **Génération** (~2-3 min) : L'APK sera créé
5. **Téléchargement** : Un lien vous sera fourni pour télécharger l'APK

**Total : ~15-25 minutes** ⏱️

## 🔗 Suivre le Build

Pendant le build, vous recevrez un lien comme :
```
https://expo.dev/accounts/hernandezlele/projects/yukpomnang-mobile-new/builds/xxxxx
```

Vous pouvez suivre la progression en temps réel sur ce lien.

## 📱 Après le Build

Une fois terminé :

1. **Téléchargez l'APK** depuis le lien fourni
2. **Transférez sur votre Android** (USB, email, cloud, etc.)
3. **Installez l'APK** (autorisez les sources inconnues si demandé)
4. **Testez l'application**

## 🛠️ Commandes Utiles

```bash
# Voir tous vos builds
eas build:list

# Annuler un build en cours
eas build:cancel

# Build avec plus de logs (pour debug)
npx eas build --platform android --profile preview --verbose

# Nettoyer et réinstaller
npm run clean:deep
npm install
```

## ❌ Problèmes Courants

### "EAS CLI n'est pas installé"
```bash
npm install -g eas-cli
```

### "Not logged in"
```bash
eas logout
eas login
```

### "node_modules manquant"
```bash
npm install
```

### "Build failed - Gradle error"
Regardez les logs du build sur le site Expo. Le script `eas-build-post-install.sh` devrait corriger automatiquement les problèmes Metro.

## 📋 Checklist Avant Build

- [ ] Node.js 18+ installé
- [ ] EAS CLI installé (`eas --version`)
- [ ] Connecté avec `eas login`
- [ ] `node_modules` installé
- [ ] Internet stable
- [ ] Script de vérification exécuté et OK

## 🎯 Commande Finale

Si tout est OK :

```bash
cd mobile
npx eas build --platform android --profile preview
```

Puis attendez et suivez les instructions !

## 📚 Documentation Complète

Pour plus de détails, consultez :
- **GUIDE_EAS_BUILD.md** : Guide complet
- **VERIFICATION_AVANT_BUILD.md** : Checklist détaillée
- **verif-eas.ps1** : Script de vérification automatique

## 💡 Conseils

1. Le **premier build prend plus de temps** (~20-25 min)
2. Les builds suivants sont **plus rapides** grâce au cache
3. Utilisez le **profil `preview`** pour des APK de test
4. Utilisez le **profil `production`** pour le Play Store (génère un AAB)
5. Le build se fait sur les **serveurs Expo** (pas besoin d'Android Studio local)

## 🆘 Besoin d'Aide ?

1. Exécutez le script de vérification : `./verif-eas.ps1`
2. Consultez les logs du build sur Expo
3. Vérifiez https://docs.expo.dev/build/
4. Statut des services Expo : https://status.expo.dev/

---

✨ **Bonne chance avec votre premier build EAS !** ✨


