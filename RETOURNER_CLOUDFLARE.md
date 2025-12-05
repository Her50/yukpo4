# 🔄 Retourner dans Cloudflare

## ⚠️ Vous Êtes Actuellement dans Namecheap

**Namecheap** = Votre registrar (où vous avez acheté le domaine)  
**Cloudflare** = Où vous devez créer le sous-domaine CDN

---

## 🚀 Aller dans Cloudflare

### **Étape 1 : Ouvrir Cloudflare**

1. **Ouvrez un nouvel onglet** dans votre navigateur
2. **Allez sur** : https://dash.cloudflare.com
3. **Connectez-vous** avec votre compte Cloudflare
   - Email : Lelehernandez2007@yahoo.fr

---

### **Étape 2 : Sélectionner le Domaine**

1. **Dans Cloudflare Dashboard**, vous verrez votre domaine `yukpomnang.com`
2. **Cliquez sur** `yukpomnang.com`

---

### **Étape 3 : Aller dans DNS**

Une fois dans `yukpomnang.com`, vous verrez plusieurs options :

**Option A : Menu de Gauche**
- Cherchez **"DNS"** dans le menu de gauche
- Cliquez dessus

**Option B : Onglets en Haut**
- Regardez en haut de la page
- Vous verrez des onglets : **Aperçu**, **DNS**, **SSL/TLS**, etc.
- Cliquez sur l'onglet **"DNS"**

**Option C : Recherche**
- En haut à droite, barre de recherche "Allez à... Ctrl + K"
- Tapez **"DNS"**
- Sélectionnez **"DNS"**

---

### **Étape 4 : Créer le Sous-domaine CDN**

Une fois dans DNS :

1. **Cliquez sur "Ajouter un enregistrement"** (bouton bleu)

2. **Remplissez** :
   - **Type** : CNAME (dans le menu déroulant)
   - **Nom** : `cdn`
   - **Cible** : (laissez vide ou mettez `yukpomnang.com`)
   - **Proxy** : ✅ **Activé** (nuage orange - TRÈS IMPORTANT)
   - **TTL** : Auto

3. **Cliquez sur "Sauvegarder"**

**Résultat** : Vous aurez `cdn.yukpomnang.com`

---

## 📋 Résumé

- ❌ **Namecheap** : Vous êtes ici actuellement (rien à faire)
- ✅ **Cloudflare** : C'est là qu'il faut créer le CDN
  - URL : https://dash.cloudflare.com
  - Section : DNS
  - Action : Créer CNAME `cdn`

---

*Date : 2025-12-03*  
*Retourner dans Cloudflare*

