# 🌐 Instructions Spécifiques - Cloudflare

**Date**: 2026-02-02

## ✅ DNS Détecté

Votre domaine `yukpomnang.com` est géré par **Cloudflare** !

Serveurs DNS détectés:
- `isaac.ns.cloudflare.com`
- `jillian.ns.cloudflare.com`

## 📋 Étapes pour Ajouter les Enregistrements DNS

### 1. Connectez-vous à Cloudflare

1. Allez sur [dash.cloudflare.com](https://dash.cloudflare.com)
2. Connectez-vous avec vos identifiants
3. Sélectionnez le domaine **`yukpomnang.com`**

### 2. Allez dans la Section DNS

1. Dans le menu de gauche, cliquez sur **DNS**
2. Vous verrez la liste des enregistrements DNS existants

### 3. Ajoutez le Premier Enregistrement (API)

1. Cliquez sur **Add record** (ou **Ajouter un enregistrement**)
2. Remplissez les champs :
   - **Type**: `CNAME`
   - **Name**: `api` (sans le `.yukpomnang.com`)
   - **Target**: `yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com`
   - **Proxy status**: Désactivé (orange cloud OFF) ⚠️ **IMPORTANT**
   - **TTL**: `Auto` (ou `300`)
3. Cliquez sur **Save**

**⚠️ IMPORTANT**: Désactivez le proxy Cloudflare (orange cloud OFF) pour cet enregistrement. Le proxy Cloudflare peut interférer avec l'ALB AWS.

### 4. Ajoutez le Deuxième Enregistrement (Validation ACM)

1. Cliquez sur **Add record** (ou **Ajouter un enregistrement**)
2. Remplissez les champs :
   - **Type**: `CNAME`
   - **Name**: `_07560c403145510b496c9b8313c6c600.api` (copiez-collez exactement)
   - **Target**: `_91b2a9695a4220c151e8615cde4edbd2.jkddzztszm.acm-validations.aws.` (copiez-collez exactement, avec le point final)
   - **Proxy status**: Désactivé (orange cloud OFF) ⚠️ **IMPORTANT**
   - **TTL**: `Auto` (ou `300`)
3. Cliquez sur **Save**

**⚠️ IMPORTANT**: Désactivez le proxy Cloudflare (orange cloud OFF) pour cet enregistrement également.

## 📸 À Quoi Ça Ressemble dans Cloudflare

```
Type    Name                                          Target                                                      Proxy
CNAME   api                                           yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com  OFF
CNAME   _07560c403145510b496c9b8313c6c600.api         _91b2a9695a4220c151e8615cde4edbd2.jkddzztszm.acm-validations.aws.  OFF
```

## ✅ Vérification

Après avoir ajouté les enregistrements, attendez **2-5 minutes**, puis vérifiez :

**Sur Windows (PowerShell)**:
```powershell
Resolve-DnsName -Name "api.yukpomnang.com" -Type CNAME
```

**Résultat attendu**: Vous devriez voir `yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com`

## 🚀 Prochaine Étape

Une fois les enregistrements ajoutés et vérifiés, lancez :

```powershell
.\scripts\wait-and-automate-https.ps1
```

Ce script va automatiquement :
- ✅ Vérifier que les DNS sont en place
- ⏳ Attendre la validation du certificat (5-30 minutes)
- 🔧 Ajouter le listener HTTPS sur l'ALB
- ✅ Tester la connexion HTTPS

## ⚠️ Notes Importantes

1. **Proxy Cloudflare**: Désactivez-le (orange cloud OFF) pour les deux enregistrements. Le proxy peut causer des problèmes avec l'ALB AWS.

2. **Propagation**: Les changements DNS peuvent prendre 2-5 minutes pour se propager.

3. **Validation ACM**: La validation du certificat peut prendre 5-30 minutes après l'ajout des enregistrements DNS.

## 🆘 Problèmes Courants

### Les DNS ne se propagent pas
- **Solution**: Attendez 5-10 minutes, la propagation peut prendre du temps
- Vérifiez que le proxy Cloudflare est bien désactivé

### Le certificat ne se valide pas
- **Vérifiez**: Que l'enregistrement de validation a bien été ajouté
- **Vérifiez**: Que le nom est exactement `_07560c403145510b496c9b8313c6c600.api`
- **Vérifiez**: Que le proxy Cloudflare est désactivé pour cet enregistrement

### Erreur de connexion
- **Vérifiez**: Que le proxy Cloudflare est désactivé pour l'enregistrement `api`
- Le proxy Cloudflare peut bloquer les connexions à l'ALB AWS


