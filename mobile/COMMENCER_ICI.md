# 🚀 Commence Ici - Publication Testing

**Objectif** : Publier ton app avec des **liens partageables** pour que les testeurs installent directement depuis Play Store / TestFlight.

---

## ⚡ Démarrage Rapide (3 options)

### Option 1 : Script Interactif (RECOMMANDÉ) ⭐

Le script te guide étape par étape avec des pauses et des vérifications :

```powershell
cd mobile
powershell -ExecutionPolicy Bypass -File .\publish-testing-interactif.ps1
```

**Avantages** :
- ✅ Guide étape par étape
- ✅ Vérifications automatiques
- ✅ Pauses pour te laisser le temps
- ✅ Ouvre les bonnes pages au bon moment

---

### Option 2 : Menu Principal

Utilise le menu existant :

```cmd
cd mobile
BUILD-EAS.bat
```

Puis choisis l'option **8** → **1** (Mode interactif)

---

### Option 3 : Guide Complet

Lis le guide détaillé :

```powershell
cd mobile
start GUIDE_ETAPE_PAR_ETAPE.md
```

Ou ouvre directement : `mobile/GUIDE_ETAPE_PAR_ETAPE.md`

---

## 📋 Avant de Commencer

### ✅ Vérifications rapides

1. **Comptes nécessaires** :
   - ✅ Google Play Console : https://play.google.com/console/
   - ✅ Apple Developer : https://developer.apple.com/account/
   - ✅ App Store Connect : https://appstoreconnect.apple.com/

2. **Connexion EAS** :
   ```powershell
   cd mobile
   eas login
   ```
   (Compte : `hernandezlele`)

3. **Vérification complète** :
   ```powershell
   cd mobile
   powershell -ExecutionPolicy Bypass -File .\verif-eas.ps1
   ```

---

## 🎯 Processus en 3 Étapes

### 1️⃣ Créer les apps dans les consoles (1ère fois seulement)

- **Android** : Play Console → Créer une application
- **iOS** : App Store Connect → Nouvelle app

### 2️⃣ Build + Submit (automatique)

Le script lance :
- Build cloud Android (AAB) → Submit Play Console
- Build cloud iOS → Submit TestFlight

### 3️⃣ Obtenir les liens partageables

- **Android** : Play Console → Testing → Closed/Open testing → Opt-in link
- **iOS** : App Store Connect → TestFlight → Public Links

---

## 📚 Documentation

- **Guide étape par étape** : `GUIDE_ETAPE_PAR_ETAPE.md`
- **Guide Play Store** : `GUIDE_PUBLICATION_GOOGLE_PLAY.md`
- **Guide App Store** : `GUIDE_PUBLICATION_APP_STORE.md`

---

## 🆘 Besoin d'Aide ?

1. Lance le script interactif (Option 1) - il te guide automatiquement
2. Consulte `GUIDE_ETAPE_PAR_ETAPE.md` pour les détails
3. Vérifie les logs sur https://expo.dev si un build échoue

---

**Prêt ? Lance le script interactif ! 🚀**

```powershell
cd mobile
powershell -ExecutionPolicy Bypass -File .\publish-testing-interactif.ps1
```




