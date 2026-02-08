# 🔑 Comment retrouver vos identifiants EAS/Expo

## 🔍 Méthodes pour retrouver vos identifiants

### 1️⃣ **Vérifier si vous êtes déjà connecté**

```powershell
cd mobile
eas whoami
```

Si vous voyez un nom d'utilisateur ou email, vous êtes déjà connecté !

---

### 2️⃣ **Retrouver votre compte Expo**

D'après votre configuration, votre compte Expo est probablement :
- **Username** : `hernandezlele`
- **Email** : L'email associé à ce compte

#### Option A : Aller sur le site Expo

1. Allez sur https://expo.dev
2. Cliquez sur "Sign In" (Connexion)
3. Cliquez sur "Forgot password?" (Mot de passe oublié)
4. Entrez votre email ou username : `hernandezlele`
5. Vous recevrez un email pour réinitialiser le mot de passe

#### Option B : Vérifier vos emails

Recherchez dans vos emails :
- Expéditeur : `noreply@expo.dev` ou `support@expo.dev`
- Sujet : "Welcome to Expo" ou "Expo account"
- Cela vous donnera l'email utilisé pour créer le compte

---

### 3️⃣ **Vérifier dans la configuration du projet**

Votre projet a un **Project ID** configuré :
- **Project ID** : `944bbf0d-5541-4e56-ba75-87ffc4c5e51f`
- **Owner** : `hernandezlele`

Cela confirme que votre username Expo est : **`hernandezlele`**

---

### 4️⃣ **Récupérer le mot de passe**

Si vous avez oublié votre mot de passe :

1. Allez sur https://expo.dev/login
2. Cliquez sur "Forgot password?"
3. Entrez votre username : `hernandezlele`
   - OU votre email si vous le connaissez
4. Vous recevrez un email pour réinitialiser le mot de passe

---

### 5️⃣ **Créer un nouveau compte (si nécessaire)**

Si vous ne retrouvez pas votre compte :

1. Allez sur https://expo.dev/signup
2. Créez un nouveau compte
3. Connectez-vous avec : `eas login`
4. Mettez à jour le `owner` dans `app.config.js` si nécessaire

---

## 📋 Informations de votre projet

D'après votre configuration actuelle :

- **Username Expo** : `hernandezlele`
- **Project ID** : `944bbf0d-5541-4e56-ba75-87ffc4c5e51f`
- **App Name** : Yukpo
- **Package** : `com.yukpomnang.mobile`

---

## 🔐 Connexion à EAS

Une fois que vous avez vos identifiants :

```powershell
cd mobile
eas login
```

Entrez :
- **Email ou Username** : `hernandezlele`
- **Mot de passe** : Votre mot de passe Expo

---

## ✅ Vérification après connexion

Après vous être connecté, vérifiez :

```powershell
eas whoami
```

Vous devriez voir votre username ou email.

---

## 🆘 Si vous ne retrouvez pas votre compte

1. **Contactez le support Expo** : https://expo.dev/support
2. **Vérifiez vos autres emails** : Peut-être avez-vous utilisé un autre email
3. **Vérifiez avec votre équipe** : Si c'est un compte partagé

---

## 📝 Résumé rapide

**Votre username Expo est probablement : `hernandezlele`**

Pour récupérer le mot de passe :
1. Allez sur https://expo.dev/login
2. Cliquez sur "Forgot password?"
3. Entrez `hernandezlele`
4. Suivez les instructions dans l'email

Ensuite, connectez-vous avec :
```powershell
eas login
```



