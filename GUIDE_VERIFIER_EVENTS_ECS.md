# 🔍 Guide : Vérifier les Événements ECS

**Date** : 2026-02-14  
**Objectif** : Identifier pourquoi aucune tâche ne démarre

---

## 📋 ÉTAPES DANS AWS CONSOLE

### 1. Aller dans ECS

**URL** : https://console.aws.amazon.com/ecs/home?region=eu-west-1

---

### 2. Sélectionner le Cluster

1. **Clusters** → Cliquer sur `yukpo-cluster`

---

### 3. Sélectionner le Service

1. Onglet **"Services"**
2. Cliquer sur `yukpo-backend-service`

---

### 4. Vérifier l'Onglet "Events"

1. Cliquer sur l'onglet **"Events"**
2. Vérifier les événements récents (dernières 24 heures)

---

## 🔍 ERREURS COURANTES À CHERCHER

### 1. Erreur de Ressources

**Message** : `RESOURCE:CPU` ou `RESOURCE:MEMORY`

**Explication** : Pas assez de CPU ou mémoire disponible dans le cluster.

**Solution** :
- Augmenter la taille des instances EC2
- OU réduire les ressources demandées dans la Task Definition

---

### 2. Erreur de Port

**Message** : `RESOURCE:PORTS` ou `Port already in use`

**Explication** : Le port est déjà utilisé.

**Solution** : Vérifier la configuration des ports dans la Task Definition.

---

### 3. Erreur d'Image Docker

**Message** : `CannotPullContainerError` ou `Image not found`

**Explication** : L'image Docker n'existe pas ou n'est pas accessible.

**Solution** :
- Vérifier que l'image existe dans ECR
- Vérifier les permissions IAM pour accéder à ECR

---

### 4. Erreur de Configuration Réseau

**Message** : `NetworkConfiguration` ou `SecurityGroup`

**Explication** : Problème avec les Security Groups ou Subnets.

**Solution** : Vérifier la configuration réseau dans le service ECS.

---

### 5. Erreur de Health Check

**Message** : `Task failed health checks` ou `Health check failed`

**Explication** : Les health checks échouent.

**Solution** : Vérifier les logs de l'application pour identifier le problème.

---

### 6. Erreur de Task Definition

**Message** : `Invalid task definition` ou `Task definition not found`

**Explication** : La Task Definition est invalide ou introuvable.

**Solution** : Vérifier la Task Definition dans ECS → Task Definitions.

---

## 📊 EXEMPLE D'ÉVÉNEMENTS

### Événement Normal (Succès)

```
service yukpo-backend-service has reached a steady state.
```

### Événement d'Erreur (Problème)

```
service yukpo-backend-service was unable to place a task because no container instance met all of its requirements.
```

---

## ✅ ACTIONS SELON L'ERREUR

### Si Erreur de Ressources

1. **Vérifier les ressources disponibles** :
   - ECS → Clusters → `yukpo-cluster` → Onglet **"ECS Instances"**
   - Vérifier CPU et mémoire disponibles

2. **Ajuster la Task Definition** :
   - Réduire CPU/mémoire demandés
   - OU augmenter la taille des instances EC2

---

### Si Erreur d'Image Docker

1. **Vérifier l'image dans ECR** :
   - ECR → Repositories → Vérifier que l'image existe

2. **Vérifier les permissions IAM** :
   - IAM → Roles → Vérifier que le rôle ECS a les permissions ECR

---

### Si Erreur de Configuration Réseau

1. **Vérifier les Security Groups** :
   - EC2 → Security Groups → Vérifier les règles

2. **Vérifier les Subnets** :
   - VPC → Subnets → Vérifier que les subnets sont corrects

---

## 🎯 RÉSUMÉ

| Action | Description |
|--------|-------------|
| **1. Aller dans ECS** | Console AWS → ECS |
| **2. Cluster** | `yukpo-cluster` |
| **3. Service** | `yukpo-backend-service` |
| **4. Events** | Onglet "Events" → Vérifier les erreurs |
| **5. Corriger** | Suivre les solutions selon l'erreur |

---

**Date** : 2026-02-14  
**Statut** : Guide créé - À suivre dans AWS Console



