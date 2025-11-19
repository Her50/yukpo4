# 🎯 Guide Visuel - Création Webhook Slack

## ⚠️ IMPORTANT : Vous êtes actuellement dans l'application Slack

Pour créer un webhook, vous devez **quitter l'application Slack** et aller sur le **site web de l'API Slack**.

---

## 📍 Étape 1 : Ouvrir l'API Slack dans le navigateur

### Option A : Nouvel onglet dans Chrome

1. **Dans Chrome**, appuyer sur **Ctrl + T** (nouvel onglet)
2. **Taper dans la barre d'adresse** : `https://api.slack.com/apps`
3. **Appuyer sur Entrée**

### Option B : Utiliser le lien direct

**Cliquer sur ce lien** : https://api.slack.com/apps

---

## 📍 Étape 2 : Se connecter

1. **Vous verrez une page** avec le titre "Your Apps"
2. **Cliquer sur** : **"Sign in to Slack"** (en haut à droite)
3. **Sélectionner votre workspace** : `yukpo_Ops`
4. **Autoriser l'accès**

---

## 📍 Étape 3 : Créer une nouvelle app

1. **Sur la page "Your Apps"**, vous verrez :
   - Un bouton **"Create New App"** (en haut à droite, bouton vert/violet)
   - Ou un bouton **"Create an App"** (au centre de la page)

2. **Cliquer sur** : **"Create New App"** ou **"Create an App"**

3. **Une popup apparaît** avec 2 options :
   - **"From scratch"** ← **CLIQUER ICI**
   - "From an app manifest"

4. **Remplir le formulaire** :
   - **App Name** : `Yukpo Pipeline Alerts`
   - **Pick a workspace** : Sélectionner `yukpo_Ops` (dans le menu déroulant)

5. **Cliquer sur** : **"Create App"** (bouton vert/violet)

---

## 📍 Étape 4 : Activer Incoming Webhooks

1. **Vous arrivez sur la page de configuration de l'app**
2. **Dans le menu de gauche**, chercher :
   - **"Incoming Webhooks"** (avec une icône de lien/chaîne)
3. **Cliquer sur** : **"Incoming Webhooks"**
4. **En haut de la page**, vous verrez un toggle :
   - **"Activate Incoming Webhooks"**
5. **Cliquer sur le toggle** pour l'activer (il doit passer à "On" / vert)

---

## 📍 Étape 5 : Créer le webhook

1. **Descendre** sur la page jusqu'à la section :
   - **"Webhook URLs for Your Workspace"**

2. **Cliquer sur** : **"Add New Webhook to Workspace"** (bouton vert/violet)

3. **Une page d'autorisation s'affiche** :
   - **Sélectionner le canal** dans le menu déroulant :
     - Option 1 : Créer un nouveau canal `#yukpo-pipeline-alerts`
     - Option 2 : Utiliser un canal existant comme `#nouveau-canal`
   - **Cliquer sur** : **"Allow"** (bouton vert)

---

## 📍 Étape 6 : Copier l'URL du webhook

1. **Vous revenez sur la page "Incoming Webhooks"**
2. **Dans la section "Webhook URLs"**, vous verrez :
   - Une URL qui commence par : `https://hooks.slack.com/services/...`
3. **Cliquer sur** : **"Copy"** (à côté de l'URL)
   - Ou **sélectionner et copier** l'URL manuellement (Ctrl + C)

4. **⚠️ IMPORTANT** : Sauvegarder cette URL quelque part (notepad, fichier texte)

---

## 📍 Étape 7 : Tester le webhook

**Une fois l'URL copiée**, revenir ici et je vous aiderai à la tester !

---

## 🎯 Résumé des clics

1. **Nouvel onglet** → `https://api.slack.com/apps`
2. **"Sign in to Slack"** → Sélectionner `yukpo_Ops`
3. **"Create New App"** (bouton en haut à droite)
4. **"From scratch"**
5. **Remplir** : App Name = `Yukpo Pipeline Alerts`, Workspace = `yukpo_Ops`
6. **"Create App"**
7. **Menu gauche** → **"Incoming Webhooks"**
8. **Toggle** → **"Activate Incoming Webhooks"** (ON)
9. **"Add New Webhook to Workspace"**
10. **Sélectionner canal** → **"Allow"**
11. **Copier l'URL** du webhook

---

**Suivez ces étapes et dites-moi où vous en êtes !** ✅

