# 🔐 Solution Certificat HTTPS pour ALB

**Date**: 2026-02-02

## ⚠️ Problème Identifié

Les certificats créés avec les domaines ALB AWS (`*.elb.amazonaws.com` ou domaine spécifique) **ne peuvent pas être validés** car :
- Ce sont des domaines AWS réservés
- Vous ne pouvez pas ajouter d'enregistrements DNS pour ces domaines
- La validation DNS échoue donc

## ✅ Solutions Possibles

### Solution 1: Domaine Personnalisé (Recommandé pour Production)

**Étapes** :

1. **Avoir un domaine** (ex: `yukpomnang.com`)

2. **Créer un sous-domaine pour l'API**
   - Exemple: `api.yukpomnang.com`
   - Dans votre DNS (Route 53 ou autre):
     ```
     api.yukpomnang.com CNAME yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com
     ```

3. **Créer le certificat ACM**
   ```bash
   aws acm request-certificate \
     --domain-name "api.yukpomnang.com" \
     --validation-method DNS \
     --region us-east-1
   ```

4. **Valider le certificat**
   - Ajouter les enregistrements DNS retournés par ACM
   - Si vous utilisez Route 53, la validation peut être automatique

5. **Ajouter le listener HTTPS**
   ```powershell
   .\scripts\add-https-listener-alb-auto.ps1 -CertificateArn <CERTIFICAT_ARN>
   ```

6. **Mettre à jour la config mobile**
   - Changer `EXPO_PUBLIC_API_URL` vers `https://api.yukpomnang.com`

### Solution 2: Utiliser HTTP Temporairement (Tests)

Si vous n'avez pas de domaine personnalisé immédiatement :

1. **Modifier temporairement le mobile** pour utiliser HTTP au lieu de HTTPS
   - Dans `mobile/production.json`:
     ```json
     {
       "EXPO_PUBLIC_API_URL": "http://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com"
     }
     ```
   - ⚠️ **ATTENTION**: HTTP n'est pas sécurisé, à utiliser uniquement pour les tests

2. **Une fois le domaine personnalisé configuré**, revenir à HTTPS

### Solution 3: Certificat Auto-Signé (Tests Uniquement)

⚠️ **Non recommandé pour la production**

Pour les tests uniquement, vous pouvez créer un certificat auto-signé, mais cela nécessitera que le mobile accepte le certificat manuellement.

## 📊 État Actuel

- ✅ **CORS**: Configuré (`ALLOWED_ORIGINS=*`)
- ✅ **Security Groups**: HTTPS et HTTP autorisés
- ✅ **Backend**: Opérationnel
- ❌ **Certificat ACM**: Nécessite validation DNS (impossible avec domaine ALB)
- ❌ **Listener HTTPS**: Non ajouté (nécessite certificat valide)

## 🎯 Recommandation

**Pour la production** :
1. Utiliser un domaine personnalisé (`api.yukpomnang.com`)
2. Créer le certificat ACM avec ce domaine
3. Valider le certificat
4. Ajouter le listener HTTPS
5. Mettre à jour la config mobile

**Pour les tests immédiats** :
1. Utiliser HTTP temporairement
2. Configurer le domaine personnalisé en parallèle
3. Passer à HTTPS une fois le domaine configuré

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

### Créer un certificat avec domaine personnalisé
```bash
aws acm request-certificate \
  --domain-name "api.yukpomnang.com" \
  --validation-method DNS \
  --region us-east-1
```


