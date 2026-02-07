# 📝 Enregistrements DNS à Créer

**Date**: 2026-02-02

## ✅ Certificat ACM Créé

**ARN**: `arn:aws:acm:us-east-1:846505724644:certificate/1d05d964-2fde-457c-9259-ff573b7301b7`  
**Domaine**: `api.yukpomnang.com`  
**Status**: `PENDING_VALIDATION`

## 📋 Enregistrements DNS à Ajouter

### 1. Enregistrement CNAME pour l'API

**Type**: CNAME  
**Name**: `api.yukpomnang.com`  
**Value**: `yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com`  
**TTL**: 300 (ou valeur par défaut)

**Objectif**: Pointer le sous-domaine `api.yukpomnang.com` vers l'ALB.

### 2. Enregistrement CNAME pour la Validation ACM

**Type**: CNAME  
**Name**: `_07560c403145510b496c9b8313c6c600.api.yukpomnang.com`  
**Value**: `_91b2a9695a4220c151e8615cde4edbd2.jkddzztszm.acm-validations.aws.`  
**TTL**: 300 (ou valeur par défaut)

**Objectif**: Valider le certificat SSL/TLS pour `api.yukpomnang.com`.

## 🔧 Comment Ajouter ces Enregistrements

### Si vous utilisez Route 53 :

1. AWS Console → Route 53 → Hosted Zones
2. Sélectionner la zone pour `yukpomnang.com`
3. Create Record
4. Ajouter les deux enregistrements CNAME ci-dessus

### Si vous utilisez un autre DNS (Cloudflare, GoDaddy, etc.) :

1. Connectez-vous à votre fournisseur DNS
2. Allez dans la gestion DNS pour `yukpomnang.com`
3. Ajoutez les deux enregistrements CNAME ci-dessus

## ⏱️ Délai de Propagation

- **CNAME API**: Propagation immédiate à quelques minutes
- **CNAME Validation**: Validation ACM automatique dans 5-30 minutes après ajout

## ✅ Vérification

Une fois les enregistrements ajoutés, vérifiez le statut du certificat :

```bash
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:846505724644:certificate/1d05d964-2fde-457c-9259-ff573b7301b7 \
  --region us-east-1 \
  --query 'Certificate.Status'
```

**Attendre** : Le statut doit passer de `PENDING_VALIDATION` à `ISSUED`.

## 🚀 Prochaines Étapes

Une fois le certificat validé (`ISSUED`) :

1. **Ajouter le listener HTTPS** :
   ```powershell
   .\scripts\add-https-listener-alb-auto.ps1 -CertificateArn arn:aws:acm:us-east-1:846505724644:certificate/1d05d964-2fde-457c-9259-ff573b7301b7
   ```

2. **Mettre à jour la config mobile** (déjà fait - voir `mobile/eas.json`)

3. **Tester la connexion HTTPS** :
   ```bash
   curl -v https://api.yukpomnang.com/health
   ```


