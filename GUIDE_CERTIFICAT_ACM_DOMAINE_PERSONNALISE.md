# 🔐 Guide: Certificat ACM avec Domaine Personnalisé

**Date**: 2026-02-02

## ⚠️ Problème Identifié

Le certificat avec `*.elb.amazonaws.com` a échoué car :
- AWS ne permet pas de valider les domaines `*.elb.amazonaws.com`
- Ce sont des domaines AWS réservés

## ✅ Solution Recommandée: Domaine Personnalisé

### Option 1: Utiliser un Domaine Existant

Si vous avez un domaine (ex: `yukpomnang.com`), créez un sous-domaine pour l'API :

1. **Créer un sous-domaine DNS**
   - Exemple: `api.yukpomnang.com` → CNAME vers l'ALB
   - Dans votre DNS (Route 53 ou autre):
     ```
     api.yukpomnang.com CNAME yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com
     ```

2. **Créer le certificat ACM**
   ```bash
   aws acm request-certificate \
     --domain-name "api.yukpomnang.com" \
     --validation-method DNS \
     --region us-east-1
   ```

3. **Valider le certificat**
   - Ajouter les enregistrements DNS retournés par ACM
   - Attendre validation (quelques minutes)

4. **Ajouter le listener HTTPS**
   ```powershell
   .\scripts\add-https-listener-alb-auto.ps1 -CertificateArn <CERTIFICAT_ARN>
   ```

### Option 2: Certificat Auto-Signé (Tests Uniquement)

⚠️ **ATTENTION**: Les certificats auto-signés ne sont pas recommandés pour la production.

Pour les tests uniquement, vous pouvez créer un certificat auto-signé localement et l'importer dans ACM, mais cela nécessitera que les clients acceptent le certificat manuellement.

### Option 3: Utiliser Route 53 + ACM (Automatique)

Si vous utilisez Route 53 pour votre domaine :

1. **Créer le certificat dans ACM**
   - AWS Console → Certificate Manager
   - Request a certificate
   - Domain: `api.yukpomnang.com`
   - Validation: DNS
   - ✅ **Cocher**: "Enable automatic validation" (si Route 53)

2. **ACM validera automatiquement** si le domaine est dans Route 53

3. **Créer l'enregistrement DNS**
   ```
   api.yukpomnang.com CNAME yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com
   ```

4. **Ajouter le listener HTTPS**

## 📝 Commandes Utiles

### Vérifier les certificats
```bash
aws acm list-certificates --region us-east-1
```

### Vérifier le statut d'un certificat
```bash
aws acm describe-certificate \
  --certificate-arn <ARN> \
  --region us-east-1 \
  --query 'Certificate.Status'
```

### Lister les enregistrements DNS à ajouter
```bash
aws acm describe-certificate \
  --certificate-arn <ARN> \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[*].ResourceRecord'
```

## 🎯 Prochaines Étapes

1. **Décider du domaine** à utiliser (personnalisé ou ALB direct)
2. **Créer le certificat** avec ce domaine
3. **Valider le certificat** (DNS)
4. **Ajouter le listener HTTPS** sur l'ALB
5. **Mettre à jour la config mobile** si nécessaire

## ⚠️ Note Importante

Pour que le mobile puisse se connecter via HTTPS, vous avez deux options :

1. **Domaine personnalisé** (recommandé)
   - Ex: `https://api.yukpomnang.com`
   - Nécessite un certificat ACM valide
   - Mettre à jour `EXPO_PUBLIC_API_URL` dans le mobile

2. **ALB direct avec certificat auto-signé** (tests uniquement)
   - Ex: `https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com`
   - Nécessite que le mobile accepte le certificat auto-signé
   - Non recommandé pour la production




