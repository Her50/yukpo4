# 🔴 PROBLÈME CRITIQUE IDENTIFIÉ - MONGODB_URL

**Date**: 2026-02-13  
**Audit**: Analyse complète des configurations AWS

---

## 🎯 PROBLÈME PRINCIPAL

### ❌ MONGODB_URL N'EST PAS RÉFÉRENCÉE DANS LA TASK DEFINITION

**Observation de l'audit**:
- ✅ DATABASE_URL → Référencée dans la task definition
- ✅ REDIS_URL → Référencée dans la task definition
- ✅ JWT_SECRET → Référencée dans la task definition
- ❌ **MONGODB_URL → NON RÉFÉRENCÉE** ← **PROBLÈME CRITIQUE**

**Impact**:
- Même si `MONGODB_URL` existe dans Secrets Manager, elle n'est **pas injectée** dans le container
- L'application Rust essaie de se connecter à MongoDB avec la valeur par défaut `mongodb://localhost:27017`
- La connexion échoue → L'application crash

---

## 📊 RÉSULTATS DE L'AUDIT COMPLET

### ✅ Configurations Correctes

1. **ECS Cluster**: ✅ ACTIVE
2. **ECS Service**: ✅ ACTIVE, 1 tâche en cours
3. **Task Definition**: ✅ ACTIVE (yukpo-backend:2)
4. **Health Check**: ✅ Configuré (`curl -f http://localhost:8080/health`)
5. **Permissions IAM**: ✅ GetSecretValue présente
6. **Réseau**: ✅ Port 5432 RDS accessible depuis ECS
7. **Secrets Manager**: ✅ Toutes les variables critiques présentes
8. **Extensions PostgreSQL**: ✅ uuid-ossp installée

### ❌ Problèmes Identifiés

1. **MONGODB_URL non référencée** dans la task definition
2. **Health checks échouent** → Toutes les tâches sont marquées UNHEALTHY
3. **Exit Code 137** → Tâches tuées par ECS après échec des health checks

---

## 🔧 SOLUTION IMMÉDIATE

### Étape 1: Ajouter MONGODB_URL à la Task Definition

Il faut mettre à jour la task definition pour inclure `MONGODB_URL` depuis Secrets Manager.

**Méthode**: Via Terraform ou AWS Console

**Via Terraform** (recommandé):
```hcl
resource "aws_ecs_task_definition" "backend" {
  # ... autres configurations ...
  
  container_definitions = jsonencode([{
    name  = "backend"
    # ... autres configurations ...
    
    secrets = [
      {
        name      = "DATABASE_URL"
        valueFrom = "arn:aws:secretsmanager:eu-west-1:108964700972:secret:yukpo/backend/secrets-0gPpWc:DATABASE_URL::"
      },
      {
        name      = "REDIS_URL"
        valueFrom = "arn:aws:secretsmanager:eu-west-1:108964700972:secret:yukpo/backend/secrets-0gPpWc:REDIS_URL::"
      },
      {
        name      = "JWT_SECRET"
        valueFrom = "arn:aws:secretsmanager:eu-west-1:108964700972:secret:yukpo/backend/secrets-0gPpWc:JWT_SECRET::"
      },
      {
        name      = "MONGODB_URL"  # ← AJOUTER CETTE LIGNE
        valueFrom = "arn:aws:secretsmanager:eu-west-1:108964700972:secret:yukpo/backend/secrets-0gPpWc:MONGODB_URL::"
      },
      # ... autres secrets ...
    ]
  }])
}
```

**Via AWS Console**:
1. Aller dans ECS → Task Definitions → `yukpo-backend`
2. Créer une nouvelle révision
3. Dans "Container Definitions" → "Secrets"
4. Ajouter:
   - Name: `MONGODB_URL`
   - Value from: `arn:aws:secretsmanager:eu-west-1:108964700972:secret:yukpo/backend/secrets-0gPpWc:MONGODB_URL::`
5. Créer la nouvelle révision
6. Mettre à jour le service pour utiliser la nouvelle révision

---

## 🔍 AUTRES OBSERVATIONS DE L'AUDIT

### Health Check Configuration

```
Command: curl -f http://localhost:8080/health || exit 1
Interval: 30s
Timeout: 10s
Retries: 3
Start Period: 60s
```

**Problème**: Les health checks échouent car l'application ne démarre pas (crash avant d'atteindre le serveur HTTP).

**Solution**: Une fois MONGODB_URL ajoutée, l'application devrait démarrer et les health checks devraient passer.

### Tâches Récentes

Toutes les tâches récentes ont:
- **Stop Code**: `ServiceSchedulerInitiated`
- **Exit Code**: `137` (SIGKILL - tué par ECS)
- **Stopped Reason**: `Task failed container health checks`
- **Health Status**: `UNHEALTHY`

**Cause**: L'application crash avant de pouvoir répondre aux health checks.

---

## 📝 CHECKLIST DE RÉSOLUTION

- [x] Extension uuid-ossp installée
- [x] Audit complet effectué
- [ ] **AJOUTER MONGODB_URL à la task definition** ← **CRITIQUE**
- [ ] Créer une nouvelle révision de la task definition
- [ ] Mettre à jour le service ECS pour utiliser la nouvelle révision
- [ ] Vérifier que MONGODB_URL est injectée dans le container
- [ ] Vérifier que les logs [MAIN] apparaissent
- [ ] Vérifier que les health checks passent

---

## 🎯 IMPACT ATTENDU

Une fois MONGODB_URL ajoutée à la task definition:

1. ✅ MONGODB_URL sera injectée dans le container
2. ✅ L'application pourra se connecter à MongoDB
3. ✅ Les logs [MAIN] devraient apparaître
4. ✅ L'application devrait démarrer complètement
5. ✅ Les health checks devraient passer
6. ✅ Le service devrait rester en cours d'exécution

---

## 🔍 POURQUOI C'ÉTAIT DIFFICILE À IDENTIFIER

1. **MONGODB_URL existe dans Secrets Manager** → On pensait qu'elle était utilisée
2. **Les logs s'arrêtent après Redis** → On pensait que c'était un problème Redis
3. **Aucun log [MAIN]** → On pensait que l'application crashait avant main()
4. **La vraie cause**: MONGODB_URL n'est simplement pas injectée dans le container

---

## ✅ CONCLUSION

**Problème identifié**: MONGODB_URL n'est pas référencée dans la task definition

**Solution**: Ajouter MONGODB_URL aux secrets de la task definition

**Priorité**: 🔴 **CRITIQUE** - Bloque complètement le démarrage

**Temps estimé**: 5-10 minutes

---

**Date de l'audit**: 2026-02-13 15:26:19  
**Audit effectué par**: Script d'audit automatisé complet

