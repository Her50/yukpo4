# 🔧 Instructions : Mise à Jour Google OAuth pour GCP

**Date** : 2026-02-14  
**Migration** : AWS → GCP Cloud Run

---

## 🎯 OBJECTIF

Mettre à jour les URLs OAuth dans Google Cloud Console pour pointer vers le nouveau backend GCP au lieu d'AWS.

---

## 📋 ÉTAPE 1 : Mettre à Jour les URLs dans Google Cloud Console

### URLs Actuelles (AWS - À Remplacer)

**Authorized Redirect URIs** :
- ❌ `https://api.yukpomnang.com/api/social/youtube/callback`
- ❌ `https://api.yukpomnang.com/api/auth/google/callback`

**Authorized JavaScript Origins** :
- ❌ `https://api.yukpomnang.com`

---

### URLs Nouvelles (GCP - À Configurer)

**Authorized Redirect URIs** :
- ✅ `https://yukpo-backend-yukpo-project.a.run.app/api/social/youtube/callback`
- ✅ `https://yukpo-backend-yukpo-project.a.run.app/api/auth/google/callback`

**Authorized JavaScript Origins** :
- ✅ `https://yukpo-backend-yukpo-project.a.run.app`

---

## 🔧 ÉTAPE 2 : Modifications dans Google Cloud Console

### 1. Ouvrir le Client OAuth

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez le projet : **yukpomnang**
3. Menu : **APIs & Services** → **Credentials**
4. Cliquez sur le Client ID : **738929393617-kasdknm9nb9mjoeo0qr0o9cb87pl9dv0.apps.googleusercontent.com**

---

### 2. Modifier les Authorized Redirect URIs

**Dans la section "URI de redirection autorisés"** :

1. **Supprimez** les anciennes URLs :
   - ❌ `https://api.yukpomnang.com/api/social/youtube/callback`
   - ❌ `https://api.yukpomnang.com/api/auth/google/callback`

2. **Ajoutez** les nouvelles URLs :
   - ✅ `https://yukpo-backend-yukpo-project.a.run.app/api/social/youtube/callback`
   - ✅ `https://yukpo-backend-yukpo-project.a.run.app/api/auth/google/callback`

**Comment faire** :
- Cliquez sur le bouton **"+ Ajouter un URI"**
- Collez chaque nouvelle URL
- Répétez pour la deuxième URL

---

### 3. Modifier les Authorized JavaScript Origins

**Dans la section "Origines JavaScript autorisées"** :

1. **Supprimez** l'ancienne origine :
   - ❌ `https://api.yukpomnang.com`

2. **Ajoutez** la nouvelle origine :
   - ✅ `https://yukpo-backend-yukpo-project.a.run.app`

**Comment faire** :
- Remplacez l'URL existante dans le champ "URI 1 *"
- Ou supprimez l'ancienne et ajoutez la nouvelle avec **"+ Ajouter un URI"**

---

### 4. Enregistrer les Modifications

1. Cliquez sur le bouton **"Enregistrer"** (en bas de la page)
2. ⚠️ **Note** : L'application des paramètres peut prendre de 5 minutes à quelques heures

---

## 📋 ÉTAPE 3 : Valeurs pour les Variables d'Environnement

### Client ID Web (Actuel)

**Variable** : `EXPO_PUBLIC_GOOGLE_CLIENT_ID`  
**Valeur** :
```
738929393617-kasdknm9nb9mjoeo0qr0o9cb87pl9dv0.apps.googleusercontent.com
```

**À ajouter dans** :
- `mobile/production (7).json`
- `mobile/eas.json` (section `production.env`)
- GitHub Secrets (si utilisé)

---

### Client IDs iOS/Android (Optionnels)

**Si vous avez des Client IDs spécifiques iOS/Android** :

#### iOS Client ID

**Variable** : `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`  
**Valeur** : `[À RÉCUPÉRER DEPUIS GOOGLE CLOUD CONSOLE]`

**Comment obtenir** :
1. Google Cloud Console → APIs & Services → Credentials
2. Créez un nouveau Client ID pour **iOS**
3. Copiez le Client ID généré

---

#### Android Client ID

**Variable** : `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`  
**Valeur** : `[À RÉCUPÉRER DEPUIS GOOGLE CLOUD CONSOLE]`

**Comment obtenir** :
1. Google Cloud Console → APIs & Services → Credentials
2. Créez un nouveau Client ID pour **Android**
3. Copiez le Client ID généré

**Note** : Si non défini, l'app utilisera `EXPO_PUBLIC_GOOGLE_CLIENT_ID` par défaut.

---

## 📊 RÉSUMÉ DES MODIFICATIONS

### URLs à Modifier dans Google Cloud Console

| Type | Ancienne URL (AWS) | Nouvelle URL (GCP) |
|------|-------------------|-------------------|
| **Redirect URI 1** | `https://api.yukpomnang.com/api/social/youtube/callback` | `https://yukpo-backend-yukpo-project.a.run.app/api/social/youtube/callback` |
| **Redirect URI 2** | `https://api.yukpomnang.com/api/auth/google/callback` | `https://yukpo-backend-yukpo-project.a.run.app/api/auth/google/callback` |
| **JavaScript Origin** | `https://api.yukpomnang.com` | `https://yukpo-backend-yukpo-project.a.run.app` |

---

### Variables d'Environnement

#### Variable Obligatoire

```json
{
  "EXPO_PUBLIC_GOOGLE_CLIENT_ID": "738929393617-kasdknm9nb9mjoeo0qr0o9cb87pl9dv0.apps.googleusercontent.com"
}
```

#### Variables Optionnelles (si Client IDs spécifiques)

```json
{
  "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID": "[CLIENT_ID_IOS]",
  "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "[CLIENT_ID_ANDROID]"
}
```

---

## ✅ CHECKLIST

### Google Cloud Console

- [ ] Ouvrir le Client OAuth dans Google Cloud Console
- [ ] Supprimer les anciennes Redirect URIs (AWS)
- [ ] Ajouter les nouvelles Redirect URIs (GCP)
- [ ] Supprimer l'ancienne JavaScript Origin (AWS)
- [ ] Ajouter la nouvelle JavaScript Origin (GCP)
- [ ] Enregistrer les modifications
- [ ] Attendre la propagation (5 minutes à quelques heures)

### Variables d'Environnement

- [ ] Ajouter `EXPO_PUBLIC_GOOGLE_CLIENT_ID` dans `mobile/production (7).json`
- [ ] Vérifier `EXPO_PUBLIC_GOOGLE_CLIENT_ID` dans `mobile/eas.json`
- [ ] (Optionnel) Créer Client ID iOS et ajouter `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- [ ] (Optionnel) Créer Client ID Android et ajouter `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`

---

## ⚠️ NOTES IMPORTANTES

1. **Propagation** : Les modifications dans Google Cloud Console peuvent prendre de 5 minutes à quelques heures pour être appliquées.

2. **Test** : Après les modifications, testez l'authentification Google OAuth pour vérifier que tout fonctionne.

3. **Backend** : Assurez-vous que le backend GCP (`https://yukpo-backend-yukpo-project.a.run.app`) est déployé et accessible.

4. **Sécurité** : Ne commitez jamais les Client IDs dans le repository. Utilisez des variables d'environnement ou GitHub Secrets.

---

**Date** : 2026-02-14  
**Statut** : ⏳ **EN ATTENTE DE MODIFICATIONS DANS GOOGLE CLOUD CONSOLE**


