# 🔐 Mise à Jour OAuth - Google Cloud Console

## 📋 Résumé

Mise à jour des **Authorized redirect URIs** dans Google Cloud Console pour que l'OAuth fonctionne avec l'ALB AWS au lieu de Render.

---

## ✅ Statut Actuel

- ✅ **AWS SSM Parameter Store** : `YOUTUBE_REDIRECT_URI` déjà mis à jour
- ❌ **Google Cloud Console** : À mettre à jour (2 OAuth Clients)

---

## 🎯 URLs AWS ALB

**Base URL** :
```
https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com
```

**Redirect URIs à ajouter** :

1. **YouTube OAuth** :
   ```
   https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/social/youtube/callback
   ```

2. **Google OAuth (général)** :
   ```
   https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/auth/google/callback
   ```

---

## 📝 Étapes dans Google Cloud Console

### Lien Direct
👉 **https://console.cloud.google.com/apis/credentials**

### Étapes Détaillées

1. **Accéder à Google Cloud Console**
   - Aller sur : https://console.cloud.google.com/
   - Se connecter avec votre compte Google

2. **Sélectionner le Projet**
   - Sélectionner votre projet Google Cloud : **yukpomnang** (ou **yukpomnang-460203**)

3. **Accéder aux Credentials**
   - Menu latéral : **APIs & Services** → **Credentials**
   - Ou lien direct : https://console.cloud.google.com/apis/credentials

4. **Mettre à Jour YouTube OAuth Client**
   - Dans la section **"ID clients OAuth 2.0"**, chercher le client nommé **"Yukpomnang YouTube OAuth"**
   - **Client ID** : `738929393617-kasdknm9nb9mjoeo0qr0o9cb87pl9dv0.apps.googleusercontent.com`
   - Cliquer sur le nom **"Yukpomnang YouTube OAuth"** pour l'éditer
   - Dans la section **"URI de redirection autorisés"** (Authorized redirect URIs), vous verrez probablement :
     - Un URI existant qui se termine par `...elb.amazona` (tronqué)
   - **⚠️ IMPORTANT** : Remplacer ou ajouter l'URI complet suivant :
     ```
     https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/social/youtube/callback
     ```
   - ⚠️ **Note** : Assurez-vous que l'URI est **complet** avec le chemin `/api/social/youtube/callback` à la fin
   - ⚠️ **Optionnel** : Vous pouvez garder l'ancienne URL Render pour la transition, ou la supprimer
   - Cliquer sur **"Enregistrer"** (Save) en bas de la page

5. **Mettre à Jour Google OAuth Client (général)**
   - Dans la section **"ID clients OAuth 2.0"**, chercher le client nommé **"Yukpomnang Web Client"**
   - **⚠️ IMPORTANT** : Il y a plusieurs clients avec ce nom. Vous devez identifier le bon :
     - Chercher celui avec le **Type** : **"Application Web"** (pas "iOS" ni "Android")
     - **Client ID** : `738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com`
     - **Date de création** : 27 janv. 2026
   - Cliquer sur le nom **"Yukpomnang Web Client"** (celui de type "Application Web") pour l'éditer
   - Vous serez redirigé vers la page de configuration du client
   - Dans la section **"URI de redirection autorisés"** (Authorized redirect URIs), vous verrez :
     - Un champ **"URI 1 *"** avec peut-être une valeur existante
   - **Ajouter ou modifier** l'URI suivant :
     ```
     https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/auth/google/callback
     ```
   - Si vous avez plusieurs URIs, vous pouvez cliquer sur **"+ Ajouter un URI"** pour en ajouter un nouveau
   - ⚠️ **Optionnel** : Vous pouvez garder l'ancienne URL Render pour la transition, ou la supprimer
   - Cliquer sur **"Enregistrer"** (Save) en bas de la page
   - Une notification **"Client OAuth enregistré"** devrait apparaître

---

## 📸 Guide Visuel : Accéder à la Configuration

### Étape 1 : Page Credentials
1. Allez sur https://console.cloud.google.com/apis/credentials
2. Vous verrez 3 sections :
   - **Clés API** (API Keys)
   - **ID clients OAuth 2.0** (OAuth 2.0 Client IDs) ← **C'est ici**
   - **Comptes de service** (Service Accounts)

### Étape 2 : Identifier les Clients OAuth
Dans la section **"ID clients OAuth 2.0"**, vous verrez un tableau avec :
- **Nom** : Nom du client
- **Date de création** : Date de création
- **Type** : iOS, Android, ou Application Web
- **ID client** : L'ID complet (peut être tronqué dans le tableau)
- **Actions** : Icônes pour éditer, supprimer, etc.

### Étape 3 : Éditer un Client
- **Option 1** : Cliquer directement sur le **nom** du client dans le tableau
- **Option 2** : Cliquer sur l'icône **"Modifier"** (crayon) dans la colonne **"Actions"**
- Vous serez redirigé vers la page de configuration du client

### Étape 4 : Page de Configuration
Sur la page de configuration, vous verrez :
- **En haut** : Le titre "ID client pour Application Web" (ou autre type)
- **Section "URI de redirection autorisés"** : C'est ici que vous ajoutez/modifiez les URIs
- **Champs "URI 1 *"** : Champs pour entrer les URIs
- **Bouton "+ Ajouter un URI"** : Pour ajouter des URIs supplémentaires
- **Bouton "Enregistrer"** : En bas de la page pour sauvegarder

## 🔍 Comment Identifier les OAuth Clients

### YouTube OAuth Client
- **Nom** : **"Yukpomnang YouTube OAuth"**
- **Type** : "Application Web"
- **Client ID** : `738929393617-kasdknm9nb9mjoeo0qr0o9cb87pl9dv0.apps.googleusercontent.com`
- **Date de création** : 5 déc. 2025
- **Où le trouver** : Dans la liste des **"ID clients OAuth 2.0"** sur la page Credentials

### Google OAuth Client (général)
- **Nom** : **"Yukpomnang Web Client"**
- **Type** : **"Application Web"** (pas "Android" ni "iOS")
- **Client ID** : `738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com`
- **Date de création** : 27 janv. 2026
- **Où le trouver** : Dans la liste des **"ID clients OAuth 2.0"** sur la page Credentials
- **⚠️ ATTENTION** : Il y a plusieurs clients avec le nom "Yukpomnang Web Client" (iOS, Android, Web). Utilisez celui de type **"Application Web"** uniquement.

---

## ⚠️ Problèmes Observés dans la Configuration Actuelle

### Problème 1 : URI YouTube Tronqué
Dans la configuration actuelle du client YouTube OAuth, l'URI semble tronqué :
- **Actuel (incorrect)** : `https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazona`
- **Attendu (correct)** : `https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/social/youtube/callback`

**Solution** : Remplacer l'URI tronqué par l'URI complet avec le chemin `/api/social/youtube/callback`.

### Problème 2 : Chemin Manquant
L'URI doit inclure le chemin complet de callback, pas seulement le domaine de base.

**URIs Corrects** :
- YouTube : `/api/social/youtube/callback`
- Google : `/api/auth/google/callback`

### Problème 3 : Identification du Client Google Général
Il y a plusieurs clients OAuth avec des noms similaires. Pour le Google OAuth général :
- Utiliser le client de type **"Application Web"** (pas iOS ni Android)
- Client ID : `738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com`

## ✅ Vérification

Après la mise à jour, vous pouvez vérifier que les redirect URIs sont bien configurés :

1. Dans Google Cloud Console → Credentials
2. Ouvrir chaque OAuth Client
3. Vérifier que les nouvelles URLs AWS sont dans la liste des **"URI de redirection autorisés"** (Authorized redirect URIs)
4. **Vérifier que les URIs sont complets** avec le chemin de callback à la fin

---

## 📌 Notes Importantes

- ⚠️ **Transition** : Vous pouvez garder temporairement les deux URLs (Render + AWS) pour une transition en douceur
- ⚠️ **Sécurité** : Après la migration complète, supprimez l'ancienne URL Render
- ⚠️ **Test** : Testez l'authentification OAuth après la mise à jour pour confirmer que tout fonctionne

---

## 🚀 Après la Mise à Jour

Une fois les redirect URIs mis à jour dans Google Cloud Console :

1. ✅ L'authentification YouTube OAuth fonctionnera avec l'ALB AWS
2. ✅ L'authentification Google OAuth fonctionnera avec l'ALB AWS
3. ✅ Plus besoin de Render pour les callbacks OAuth

---

**Date** : 2026-01-31  
**Statut** : ⚠️ **Action requise dans Google Cloud Console**

