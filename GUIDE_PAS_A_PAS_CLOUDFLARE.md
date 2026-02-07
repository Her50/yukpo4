# 📝 Guide Pas à Pas - Ajouter les DNS dans Cloudflare

**Date**: 2026-02-02

## 🎯 Objectif

Ajouter 2 enregistrements CNAME dans Cloudflare pour configurer HTTPS.

---

## 📋 ÉTAPE 1: Se Connecter à Cloudflare

### 1.1 Ouvrir Cloudflare

1. Ouvrez votre navigateur (Chrome, Firefox, Edge, etc.)
2. Allez sur : **https://dash.cloudflare.com**
3. Connectez-vous avec votre email et mot de passe Cloudflare

### 1.2 Sélectionner le Domaine

1. Une fois connecté, vous verrez la liste de vos domaines
2. **Cliquez sur** `yukpomnang.com` dans la liste
3. Vous arrivez sur le tableau de bord du domaine

---

## 📋 ÉTAPE 2: Accéder à la Section DNS

### 2.1 Trouver le Menu DNS

1. Dans le menu de gauche, cherchez **"DNS"**
2. **Cliquez sur "DNS"**
3. Vous verrez maintenant la liste de tous vos enregistrements DNS existants

### 2.2 Vérifier la Vue

Vous devriez voir quelque chose comme :
```
Type    Name    Content                    Proxy status
A       @       xxx.xxx.xxx.xxx            Proxied
CNAME   www     yukpomnang.com             Proxied
...
```

---

## 📋 ÉTAPE 3: Ajouter le Premier Enregistrement (API)

### 3.1 Cliquer sur "Add record"

1. En haut à droite de la liste DNS, **cliquez sur le bouton "Add record"** (ou "Ajouter un enregistrement")
2. Un formulaire s'ouvre pour ajouter un nouvel enregistrement

### 3.2 Remplir le Formulaire

Remplissez **exactement** comme suit :

**Type** :
- Sélectionnez **`CNAME`** dans le menu déroulant

**Name** :
- Tapez : **`api`**
- ⚠️ **IMPORTANT** : Ne mettez PAS `.yukpomnang.com`, juste `api`

**Target** :
- Tapez : **`yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com`**
- ⚠️ **IMPORTANT** : Copiez-collez exactement, sans espaces

**Proxy status** :
- ⚠️ **CRITIQUE** : Cliquez sur le **nuage orange** pour le désactiver
- Le nuage doit être **GRIS** (pas orange)
- Si le nuage est orange, **cliquez dessus** pour le désactiver

**TTL** :
- Laissez **"Auto"** (ou sélectionnez `300` si vous préférez)

### 3.3 Sauvegarder

1. **Cliquez sur "Save"** (ou "Enregistrer")
2. L'enregistrement apparaît dans la liste avec le nuage **GRIS** (proxy OFF)

**Vérification** :
- Vous devriez voir dans la liste :
  ```
  CNAME   api   yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com   DNS only
  ```
  (DNS only = proxy désactivé)

---

## 📋 ÉTAPE 4: Ajouter le Deuxième Enregistrement (Validation ACM)

### 4.1 Cliquer sur "Add record" à nouveau

1. **Cliquez à nouveau sur "Add record"** (ou "Ajouter un enregistrement")

### 4.2 Remplir le Formulaire

Remplissez **exactement** comme suit :

**Type** :
- Sélectionnez **`CNAME`** dans le menu déroulant

**Name** :
- Tapez : **`_07560c403145510b496c9b8313c6c600.api`**
- ⚠️ **IMPORTANT** : Copiez-collez exactement, avec le `_` au début
- ⚠️ **IMPORTANT** : Ne mettez PAS `.yukpomnang.com` à la fin

**Target** :
- Tapez : **`_91b2a9695a4220c151e8615cde4edbd2.jkddzztszm.acm-validations.aws.`**
- ⚠️ **IMPORTANT** : Copiez-collez exactement, avec le point final `.`
- ⚠️ **IMPORTANT** : Pas d'espaces avant ou après

**Proxy status** :
- ⚠️ **CRITIQUE** : Cliquez sur le **nuage orange** pour le désactiver
- Le nuage doit être **GRIS** (pas orange)
- Si le nuage est orange, **cliquez dessus** pour le désactiver

**TTL** :
- Laissez **"Auto"** (ou sélectionnez `300` si vous préférez)

### 4.3 Sauvegarder

1. **Cliquez sur "Save"** (ou "Enregistrer")
2. L'enregistrement apparaît dans la liste avec le nuage **GRIS** (proxy OFF)

**Vérification** :
- Vous devriez voir dans la liste :
  ```
  CNAME   _07560c403145510b496c9b8313c6c600.api   _91b2a9695a4220c151e8615cde4edbd2.jkddzztszm.acm-validations.aws.   DNS only
  ```
  (DNS only = proxy désactivé)

---

## 📋 ÉTAPE 5: Vérification Finale

### 5.1 Vérifier les 2 Enregistrements

Dans la liste DNS, vous devriez maintenant voir **2 nouveaux enregistrements** :

1. **`api`** → `yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com` (DNS only)
2. **`_07560c403145510b496c9b8313c6c600.api`** → `_91b2a9695a4220c151e8615cde4edbd2.jkddzztszm.acm-validations.aws.` (DNS only)

### 5.2 Vérifier le Proxy Status

⚠️ **IMPORTANT** : Les deux enregistrements doivent avoir le nuage **GRIS** (DNS only), pas orange (Proxied)

Si un des deux a le nuage orange :
1. **Cliquez sur l'enregistrement** pour l'éditer
2. **Cliquez sur le nuage orange** pour le désactiver
3. **Sauvegardez**

---

## 📋 ÉTAPE 6: Attendre la Propagation (2-5 minutes)

1. **Fermez** la page Cloudflare (ou gardez-la ouverte)
2. **Attendez 2-5 minutes** pour que les DNS se propagent
3. Vous pouvez vérifier avec cette commande PowerShell :
   ```powershell
   Resolve-DnsName -Name "api.yukpomnang.com" -Type CNAME
   ```

---

## 📋 ÉTAPE 7: Lancer le Script Automatique

Une fois les 2 enregistrements ajoutés et le proxy désactivé :

1. Ouvrez PowerShell dans le dossier du projet
2. Exécutez :
   ```powershell
   .\scripts\wait-and-automate-https.ps1
   ```

Le script va automatiquement :
- ✅ Vérifier que les DNS sont en place
- ⏳ Attendre la validation du certificat (5-30 minutes)
- 🔧 Ajouter le listener HTTPS
- ✅ Tester la connexion

---

## ⚠️ Points Importants

### ❌ Erreurs à Éviter

1. **Ne pas mettre `.yukpomnang.com`** dans le champ Name
   - ✅ Correct : `api`
   - ❌ Incorrect : `api.yukpomnang.com`

2. **Ne pas oublier le point final** dans le Target de validation
   - ✅ Correct : `_91b2a9695a4220c151e8615cde4edbd2.jkddzztszm.acm-validations.aws.`
   - ❌ Incorrect : `_91b2a9695a4220c151e8615cde4edbd2.jkddzztszm.acm-validations.aws` (sans point)

3. **Ne pas oublier de désactiver le proxy** (nuage orange → gris)
   - Le proxy Cloudflare peut bloquer les connexions à l'ALB AWS

### ✅ Checklist

Avant de lancer le script, vérifiez :

- [ ] Les 2 enregistrements sont ajoutés
- [ ] Le champ Name est correct (sans `.yukpomnang.com`)
- [ ] Le champ Target est correct (copié-collé exactement)
- [ ] Le proxy est désactivé (nuage GRIS, pas orange)
- [ ] Les 2 enregistrements sont sauvegardés

---

## 🆘 Aide

### Si vous ne trouvez pas le bouton "Add record"

- Cherchez "Ajouter un enregistrement" (si interface en français)
- Ou cherchez un bouton "+" ou "Add" en haut de la liste DNS

### Si le nuage reste orange

- Cliquez directement sur le nuage orange
- Il devrait devenir gris
- Si ça ne marche pas, éditez l'enregistrement et désactivez le proxy dans les options

### Si vous avez fait une erreur

- Cliquez sur l'enregistrement pour l'éditer
- Modifiez les champs
- Sauvegardez

---

## 📞 Résumé Rapide

1. **https://dash.cloudflare.com** → Connectez-vous
2. **Cliquez sur `yukpomnang.com`**
3. **Menu gauche → DNS**
4. **Add record** → CNAME → `api` → ALB → Proxy OFF → Save
5. **Add record** → CNAME → `_07560c403145510b496c9b8313c6c600.api` → Validation → Proxy OFF → Save
6. **Attendre 2-5 minutes**
7. **Lancer** `.\scripts\wait-and-automate-https.ps1`

**C'est tout !** 🎉


