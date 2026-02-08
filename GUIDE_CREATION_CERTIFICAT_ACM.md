# 🔐 Guide Création Certificat ACM pour ALB

**Date**: 2026-02-02

## 📋 Vue d'ensemble

Pour que le mobile puisse se connecter via HTTPS, il faut :
1. Créer un certificat SSL/TLS dans AWS Certificate Manager (ACM)
2. Ajouter un listener HTTPS (443) sur l'ALB avec ce certificat

## 🎯 Option 1: Via AWS Console (Recommandé)

### Étapes

1. **Aller dans AWS Certificate Manager**
   - AWS Console → Services → Certificate Manager
   - Région : `us-east-1` (même région que l'ALB)

2. **Request a certificate**
   - Cliquer sur "Request a certificate"
   - Choisir "Request a public certificate"

3. **Configurer le domaine**
   - **Domain name**: 
     - Option A: `*.elb.amazonaws.com` (wildcard pour tous les ALB)
     - Option B: Votre domaine personnalisé (ex: `api.yukpomnang.com`)
   - **Validation method**: DNS (recommandé)

4. **Valider le certificat**
   - AWS va créer des enregistrements DNS à ajouter
   - Ajouter les enregistrements CNAME dans votre DNS
   - Attendre validation (quelques minutes)

5. **Une fois validé**
   - Copier l'ARN du certificat
   - Exécuter le script :
     ```powershell
     .\scripts\add-https-listener-alb-auto.ps1 -CertificateArn <ARN>
     ```

## 🎯 Option 2: Via AWS CLI

### Créer le certificat

```bash
aws acm request-certificate \
  --domain-name "*.elb.amazonaws.com" \
  --validation-method DNS \
  --region us-east-1 \
  --output json
```

### Valider le certificat

```bash
# Récupérer les enregistrements DNS à créer
aws acm describe-certificate \
  --certificate-arn <CERTIFICATE_ARN> \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[*].ResourceRecord' \
  --output json
```

### Ajouter les enregistrements DNS

Ajouter les enregistrements CNAME retournés dans votre DNS.

### Vérifier la validation

```bash
aws acm describe-certificate \
  --certificate-arn <CERTIFICATE_ARN> \
  --region us-east-1 \
  --query 'Certificate.Status' \
  --output text
```

**Attendre** : `ISSUED` (certificat validé)

### Ajouter le listener HTTPS

```powershell
.\scripts\add-https-listener-alb-auto.ps1 -CertificateArn <CERTIFICATE_ARN>
```

## 🎯 Option 3: Utiliser un Certificat Existant

Si vous avez déjà un certificat ACM :

```powershell
# Lister les certificats
aws acm list-certificates --region us-east-1

# Utiliser un certificat existant
.\scripts\add-https-listener-alb-auto.ps1 -CertificateArn <ARN_EXISTANT>
```

## ⚠️ Notes Importantes

1. **Région** : Le certificat doit être dans la même région que l'ALB (`us-east-1`)

2. **Validation** : La validation DNS peut prendre quelques minutes à quelques heures

3. **Wildcard** : Un certificat `*.elb.amazonaws.com` fonctionne pour tous les ALB AWS

4. **Domaine personnalisé** : Si vous avez un domaine, utilisez-le pour un certificat plus spécifique

## 🔍 Vérification

Après ajout du listener HTTPS :

```powershell
# Vérifier les listeners
aws elbv2 describe-listeners \
  --load-balancer-arn <ALB_ARN> \
  --region us-east-1 \
  --query 'Listeners[*].{Port:Port,Protocol:Protocol}' \
  --output json

# Tester HTTPS
curl -v https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/health
```

## 📝 Résumé

1. ✅ CORS configuré
2. ✅ Security Groups OK
3. ✅ Backend opérationnel
4. ⚠️ **Créer certificat ACM** (action requise)
5. ⚠️ **Ajouter listener HTTPS** (action requise)

Une fois ces deux actions effectuées, le mobile pourra se connecter via HTTPS.




