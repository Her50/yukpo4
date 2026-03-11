# Distribution Test pour Yukpo Mobile

Guide complet pour partager votre application avec les testeurs.

## 🚀 Options de distribution

### Option 1: Test Interne Google Play (Recommandé)

**Avantages:**
- Installation via Play Store (officiel)
- Mises à jour automatiques
- Pas besoin d'activer "Sources inconnues"
- Tracking des installations

**Étapes:**
```bash
# Build et soumission automatique
./distribute-test.sh eas-submit
```

**Ou manuellement:**
```bash
# 1. Build APK
npx eas build --platform android --profile preview

# 2. Soumettre à Google Play
npx eas submit --platform android --profile preview
```

**Dans Google Play Console:**
1. Allez dans **Distribution → Tests internes**
2. Uploadez l'APK buildé
3. Ajoutez les emails des testeurs
4. Générez un lien d'invitation opt-in
5. Partagez le lien avec vos testeurs

---

### Option 2: Lien Direct APK (Plus rapide)

**Avantages:**
- Immédiat (pas de validation Google)
- Contrôle total
- Pas besoin de compte Google Play

**Inconvénients:**
- Les testeurs doivent activer "Sources inconnues"
- Mises à jour manuelles

**Étapes:**
```bash
# 1. Build l'APK
./distribute-test.sh build

# 2. Upload sur votre backend
./distribute-test.sh upload

# 3. Déployer le backend (avec les nouvelles routes)
./distribute-test.sh deploy

# 4. Afficher les liens
./distribute-test.sh link
```

**Liens générés:**
- Page de téléchargement: `https://yukpo-backend-376093909298.europe-west1.run.app/test-download`
- APK direct: `https://yukpo-backend-376093909298.europe-west1.run.app/downloads/yukpo-mobile-test.apk`

---

## 📱 Instructions pour les testeurs

### Via Google Play (Option 1)
1. Cliquez sur le lien d'invitation reçu par email
2. Acceptez l'invitation de test
3. Installez depuis le Play Store
4. L'application apparaîtra comme "Yukpo (test interne)"

### Via APK Direct (Option 2)
1. Cliquez sur le lien de téléchargement
2. Autorisez le téléchargement dans votre navigateur
3. Allez dans **Paramètres → Sécurité**
4. Activez **"Autoriser l'installation d'applications inconnues"**
5. Ouvrez le fichier APK téléchargé
6. Suivez les instructions d'installation

---

## 🔧 Configuration requise

- **Android 7.0+** (API 24)
- **2GB RAM** minimum
- **100MB** espace libre
- **Connexion internet** (pour l'authentification)

---

## 📊 Tracking des installations

### Google Play Console
- Tableau de bord des installations
- Statistiques d'utilisation
- Rapports de crash
- Feedback des utilisateurs

### Backend (Option 2)
Vous pouvez ajouter du tracking dans les routes de test:

```rust
// Dans test_routes.rs
pub async fn get_test_apk() -> impl IntoResponse {
    // Log du téléchargement
    log::info!("APK download requested from IP: {}", ip);
    
    // Compteur de téléchargements
    increment_download_counter().await;
    
    // ... reste du code
}
```

---

## ⚡ Workflow rapide

### Pour un test immédiat:
```bash
# Build + upload + liens (5 minutes)
./distribute-test.sh build
./distribute-test.sh upload  
./distribute-test.sh link
```

### Pour distribution professionnelle:
```bash
# Google Play (30 minutes validation)
./distribute-test.sh eas-submit
```

---

## 🛠️ Dépannage

### "APK non trouvé"
```bash
# Vérifiez que l'APK existe
find . -name "*.apk" -type f

# Upload manuel si nécessaire
gsutil cp votre-apk.apk gs://yukpo-project-yukpo-backend-media/uploads/yukpo-mobile-test.apk
```

### "Route 404"
```bash
# Redéployez le backend avec les nouvelles routes
./distribute-test.sh deploy
```

### "Sources inconnues"
Guidez les testeurs:
1. **Paramètres** → **Apps et notifications**
2. **Special app access** → **Install unknown apps**
3. Autorisez votre navigateur

---

## 📧 Template d'email pour les testeurs

```
Sujet: Test de l'application Yukpo Mobile

Bonjour,

Merci de tester notre application Yukpo Mobile!

📱 Lien d'installation:
[Lien Google Play ou APK direct]

🔧 Instructions:
1. Cliquez sur le lien ci-dessus
2. Suivez les instructions d'installation
3. Connectez-vous avec votre email de test

💡 Configuration requise:
- Android 7.0 ou plus récent
- 2GB RAM minimum
- 100MB espace libre

🐛 Pour nous faire remonter les bugs:
- Email: support@yukpomnang.com
- WhatsApp: +237 XXX XXX XXX

Merci pour votre aide!
L'équipe Yukpo
```

---

## 🔄 Mises à jour

### Google Play
- Uploadez la nouvelle version dans la console
- Les testeurs reçoivent une notification de mise à jour

### APK Direct
- Uploadez le nouvel APK sur le backend
- Partagez le nouveau lien
- Les testeurs doivent réinstaller manuellement

---

## 📈 Prochaines étapes

1. **Phase 1**: 10-20 testeurs internes
2. **Phase 2**: 50-100 testeurs bêta
3. **Phase 3**: Test fermé (1000+ testeurs)
4. **Production**: Lancement public

Chaque phase utilise des canaux de distribution différents pour contrôler la croissance.
