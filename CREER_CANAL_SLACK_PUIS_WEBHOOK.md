# 🔧 Solution : Créer un Canal Slack d'abord

## ⚠️ Problème

Vous êtes sur la page d'installation du webhook, mais **aucun canal n'est disponible** dans le menu déroulant.

**Solution** : Créer un canal dans Slack d'abord, puis revenir sur cette page.

---

## 📍 Étape 1 : Créer un Canal dans Slack

### Option A : Depuis l'application Slack (recommandé)

1. **Revenir à l'application Slack** (onglet Chrome avec Slack ouvert)
2. **Dans la barre latérale gauche**, chercher la section **"Canaux"** (Channels)
3. **Cliquer sur le "+"** à côté de "Canaux" (ou cliquer sur "Créer un canal")
4. **Remplir le formulaire** :
   - **Nom du canal** : `yukpo-pipeline-alerts`
   - **Description** (optionnel) : `Alertes du pipeline vidéo Yukpo`
   - **Visibilité** : **Public** (recommandé) ou Privé
5. **Cliquer sur** : **"Créer"** ou **"Create"**

### Option B : Depuis le navigateur (si vous êtes sur Slack web)

1. **Dans Slack**, cliquer sur **"Canaux"** dans la barre latérale
2. **Cliquer sur** : **"Créer un canal"** ou le bouton **"+"**
3. **Remplir** :
   - **Nom** : `yukpo-pipeline-alerts`
   - **Description** : `Alertes du pipeline vidéo`
4. **Cliquer sur** : **"Créer"**

---

## 📍 Étape 2 : Revenir sur la Page d'Installation

1. **Revenir à l'onglet** avec la page d'installation du webhook
2. **Dans le champ "Canal pour webhook"**, cliquer sur le menu déroulant
3. **Taper** : `yukpo-pipeline-alerts` (ou le nom du canal créé)
4. **Sélectionner** le canal dans la liste
5. **Le bouton "Installer Yukpo Pipeline Alerts"** devrait devenir **actif** (vert/violet)
6. **Cliquer sur** : **"Installer Yukpo Pipeline Alerts"**

---

## 📍 Étape 3 : Récupérer l'URL du Webhook

**Après l'installation**, vous serez redirigé vers la page de configuration de l'app.

1. **Dans le menu de gauche**, cliquer sur **"Incoming Webhooks"**
2. **Dans la section "Webhook URLs"**, vous verrez l'URL du webhook
3. **Format** : `https://hooks.slack.com/services/T.../B.../...`
4. **Cliquer sur** : **"Copy"** (ou copier manuellement)

---

## 🎯 Alternative : Utiliser un Canal Existant

Si vous avez déjà des canaux dans Slack :

1. **Dans le champ "Canal pour webhook"**, taper le nom d'un canal existant
   - Exemples : `general`, `nouveau-canal`, `ops`, etc.
2. **Sélectionner** le canal
3. **Cliquer sur** : **"Installer Yukpo Pipeline Alerts"**

---

## ✅ Checklist

- [ ] Canal créé dans Slack (`yukpo-pipeline-alerts` ou autre)
- [ ] Retour sur la page d'installation du webhook
- [ ] Canal sélectionné dans le menu déroulant
- [ ] Bouton "Installer" activé
- [ ] Webhook installé
- [ ] URL du webhook copiée

---

**Créez le canal d'abord, puis revenez sur la page d'installation !** ✅

