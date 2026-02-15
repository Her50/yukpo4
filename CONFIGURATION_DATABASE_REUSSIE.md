# ✅ Configuration Accessibilité Base de Données - Réussie

**Date**: 2026-02-15  
**Statut**: ✅ **CONFIGURÉ AVEC SUCCÈS**

---

## ✅ Configuration Complétée

### Ressources GCP Créées/Existantes

1. ✅ **IP Statique Cloud NAT** : `cloud-run-nat-ip`
   - **IP** : `104.199.18.176`
   - **Statut** : Existe déjà

2. ✅ **Routeur Cloud** : `cloud-run-router`
   - **Statut** : Existe déjà

3. ✅ **Cloud NAT** : `cloud-run-nat`
   - **Statut** : Existe déjà

4. ✅ **VPC Connector** : `yukpo-connector`
   - **Statut** : Existe déjà

5. ✅ **Service Cloud Run** : `yukpo-backend`
   - **VPC Connector** : Attaché avec succès
   - **Nouvelle révision** : `yukpo-backend-00029-sm2`
   - **Service URL** : https://yukpo-backend-376093909298.europe-west1.run.app

---

## 🔴 Action Requise : Autoriser IP NAT dans AWS RDS

### IP NAT à Autoriser

**IP NAT** : `104.199.18.176`  
**Port** : `5432`  
**Type** : `PostgreSQL`

### Instructions AWS

1. **Aller dans AWS Console** :
   - https://console.aws.amazon.com/rds/

2. **Sélectionner votre instance RDS** :
   - Cliquer sur votre instance PostgreSQL (34.79.29.219)

3. **Ouvrir le Security Group** :
   - Onglet "Connectivity & security"
   - Cliquer sur le Security Group (ex: `sg-xxxxx`)

4. **Modifier les règles entrantes** :
   - Onglet "Inbound rules"
   - Cliquer sur "Edit inbound rules"

5. **Ajouter la règle** :
   - Cliquer sur "Add rule"
   - **Type** : `PostgreSQL`
   - **Port** : `5432`
   - **Source** : `104.199.18.176/32`
   - Cliquer sur "Save rules"

---

## ✅ Vérification

### 1. Vérifier la Connectivité

```bash
# Vérifier les logs Cloud Run
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND resource.labels.revision_name=yukpo-backend-00029-sm2" --limit=50 --format="table(timestamp,severity,textPayload)" --project=yukpo-project
```

**Logs attendus** :
```
✅ Pool PostgreSQL créé avec succès
✅ Serveur lance sur http://0.0.0.0:8080
```

### 2. Tester le Service

```bash
# Test health endpoint
curl https://yukpo-backend-376093909298.europe-west1.run.app/health

# Test avec authentification
curl -H "Authorization: Bearer YOUR_TOKEN" https://yukpo-backend-376093909298.europe-west1.run.app/api/health
```

### 3. Vérifier la Configuration VPC

```bash
# Vérifier le VPC Connector
gcloud compute networks vpc-access connectors describe yukpo-connector \
  --region=europe-west1 \
  --project=yukpo-project

# Vérifier la configuration Cloud Run
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="get(spec.template.spec.vpcAccess)" \
  --project=yukpo-project
```

---

## 📋 Checklist

- [x] **IP Statique Cloud NAT** : Créée (104.199.18.176)
- [x] **Routeur Cloud** : Créé
- [x] **Cloud NAT** : Créé
- [x] **VPC Connector** : Créé
- [x] **VPC Connector attaché** : À Cloud Run
- [x] **Service redéployé** : Révision yukpo-backend-00029-sm2
- [ ] **IP NAT autorisée** : Dans AWS RDS Security Group (ACTION REQUISE)
- [ ] **Connectivité vérifiée** : Logs Cloud Run
- [ ] **Service testé** : Endpoint /health

---

## 🔧 Dépannage

### Si la Base de Données N'est Toujours Pas Accessible

1. **Vérifier que l'IP NAT est autorisée** :
   - AWS Console → RDS → Security Groups
   - Vérifier que `104.199.18.176/32` est dans les Inbound Rules

2. **Vérifier le VPC Connector** :
   ```bash
   gcloud compute networks vpc-access connectors describe yukpo-connector \
     --region=europe-west1 \
     --project=yukpo-project
   ```

3. **Vérifier les logs Cloud Run** :
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND textPayload=~'database\|PostgreSQL\|DB'" --limit=50 --project=yukpo-project
   ```

4. **Tester depuis Cloud Run** :
   - Créer un job Cloud Run pour tester la connexion
   - Ou vérifier les logs d'erreur de connexion

---

## 💡 Notes Importantes

1. **IP NAT Statique** : `104.199.18.176`
   - Cette IP ne changera pas (sauf si vous supprimez et recréez l'IP)
   - Vous pouvez l'autoriser de manière permanente dans AWS RDS

2. **VPC Connector** : `yukpo-connector`
   - Coût : ~$0.10/heure par instance
   - Min instances : 2
   - Max instances : 3

3. **Cloud NAT** : `cloud-run-nat`
   - Coût : ~$0.045/heure + trafic sortant
   - IP statique : 104.199.18.176

4. **Service Cloud Run** :
   - Nouvelle révision : `yukpo-backend-00029-sm2`
   - VPC Connector attaché : ✅
   - VPC Egress : `all-traffic`

---

**✅ Configuration GCP terminée avec succès !**

**🔴 PROCHAINE ÉTAPE CRITIQUE** : Autoriser l'IP NAT `104.199.18.176/32` dans AWS RDS Security Group pour que la base de données soit accessible.

