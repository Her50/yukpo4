# 🔧 Configuration Backend AWS pour Mobile et Frontend

## 📋 Situation Actuelle

Le backend est déployé sur **AWS ECS Fargate** dans la région **eu-west-1** (Irlande).

### Configuration Infrastructure

- **Cluster ECS**: `yukpo-cluster`
- **Service ECS**: `yukpo-backend-service`
- **Load Balancer**: ❌ **Non activé** (par défaut)
- **NAT Gateway**: ✅ Activé
- **IP Publique**: ❌ Désactivée (service dans sous-réseaux privés)

## 🎯 Options pour Accéder au Backend

### Option 1: Activer le Load Balancer (Recommandé)

**Avantages**:
- ✅ URL stable et publique
- ✅ Gestion automatique du trafic
- ✅ Health checks intégrés
- ✅ Support HTTPS avec certificat ACM

**Coût**: ~$16/mois pour l'ALB

**Configuration**:

1. **Modifier `infra/aws/terraform.tfvars`**:
```hcl
enable_load_balancer = true
```

2. **Appliquer Terraform**:
```bash
cd infra/aws
terraform plan
terraform apply
```

3. **Récupérer l'URL du Load Balancer**:
```bash
terraform output alb_dns_name
```

4. **Mettre à jour les configurations** avec l'URL obtenue.

### Option 2: Utiliser un Domaine Personnalisé (Recommandé pour Production)

**Avantages**:
- ✅ URL professionnelle (`api.yukpomnang.com`)
- ✅ Certificat SSL gratuit via ACM
- ✅ Meilleure expérience utilisateur

**Configuration**:

1. **Créer un certificat ACM** pour `api.yukpomnang.com`
2. **Activer le Load Balancer** avec le certificat
3. **Configurer Route53** pour pointer vers l'ALB
4. **Mettre à jour les configurations** avec `https://api.yukpomnang.com`

### Option 3: Utiliser l'IP Publique Temporaire (Développement uniquement)

**⚠️ Non recommandé pour production**

Si vous avez besoin d'un accès direct temporaire:

1. **Modifier `infra/aws/terraform.tfvars`**:
```hcl
enable_nat_gateway = false  # Active assign_public_ip
```

2. **Récupérer l'IP publique** du service ECS
3. **Configurer les Security Groups** pour autoriser le trafic

## 📝 Configuration Mobile

### Fichiers à Modifier

1. **`mobile/src/config/api.config.ts`**:
```typescript
export const API_BASE_URL = EXPO_API_URL || 'https://api.yukpomnang.com';
```

2. **`mobile/eas.json`**:
```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.yukpomnang.com",
        "EXPO_PUBLIC_WS_URL": "wss://api.yukpomnang.com"
      }
    }
  }
}
```

3. **Créer `mobile/.env`** (optionnel, pour développement local):
```env
EXPO_PUBLIC_API_URL=https://api.yukpomnang.com
EXPO_PUBLIC_WS_URL=wss://api.yukpomnang.com
EXPO_PUBLIC_ENVIRONMENT=production
```

## 📝 Configuration Frontend

### Fichiers à Modifier

1. **`frontend/src/config/api.config.ts`**:
```typescript
export const API_BASE_URL = VITE_API_URL || 'https://api.yukpomnang.com';
```

2. **Créer `frontend/.env`**:
```env
VITE_API_BASE_URL=https://api.yukpomnang.com
VITE_WS_BASE_URL=wss://api.yukpomnang.com
VITE_ENVIRONMENT=production
```

3. **Pour Netlify** (`netlify.toml`):
```toml
[build.environment]
  VITE_API_BASE_URL = "https://api.yukpomnang.com"
```

## 🔍 Vérification

### Test de Connectivité

```bash
# Test health check
curl https://api.yukpomnang.com/health

# Test endpoint API
curl https://api.yukpomnang.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

## ✅ Checklist

- [ ] Load Balancer activé (ou domaine personnalisé configuré)
- [ ] URL du backend récupérée
- [ ] `mobile/src/config/api.config.ts` mis à jour
- [ ] `mobile/eas.json` mis à jour
- [ ] `frontend/src/config/api.config.ts` mis à jour
- [ ] Fichiers `.env` créés si nécessaire
- [ ] Test de connectivité réussi
- [ ] Application mobile testée
- [ ] Application frontend testée

## 🚀 Prochaines Étapes

1. **Activer le Load Balancer** via Terraform
2. **Configurer un domaine personnalisé** (optionnel mais recommandé)
3. **Mettre à jour les configurations** avec la nouvelle URL
4. **Tester les applications** mobile et frontend
5. **Vérifier les logs** pour confirmer les connexions

