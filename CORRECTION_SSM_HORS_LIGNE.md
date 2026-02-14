# 🔧 Correction - Agent SSM Toujours Hors Ligne

**Date**: 2026-02-13  
**Problème**: Agent SSM toujours "Hors ligne" après avoir attaché le rôle IAM

---

## ✅ **SOLUTIONS À ESSAYER**

### Solution 1: Redémarrer l'Instance (Recommandé)

**Via AWS Console**:
1. **EC2** → **Instances** → Sélectionnez `i-0b9ad404f8d738d04`
2. **Actions** → **Instance State** → **Reboot**
3. **Attendez 2-3 minutes**
4. **Retournez sur "Connect"** → **Session Manager**
5. Le statut devrait être **"En ligne"** ✅

**Via AWS CLI**:
```bash
aws ec2 reboot-instances --instance-ids i-0b9ad404f8d738d04 --region eu-west-1
```

---

### Solution 2: Vérifier l'État de l'Instance

**Via AWS Console**:
1. **EC2** → **Instances** → Sélectionnez `i-0b9ad404f8d738d04`
2. **Vérifiez le statut**:
   - ✅ **"running"** → L'instance fonctionne, continuez avec Solution 1
   - ❌ **"stopped"** → Démarrez l'instance (Actions → Instance State → Start)
   - ❌ **"stopping"** → Attendez qu'elle s'arrête, puis démarrez-la

---

### Solution 3: Vérifier les Logs de l'Agent SSM

Si vous avez un autre moyen d'accéder à l'instance (SSH, etc.) :

```bash
# Vérifier que l'agent SSM est en cours d'exécution
sudo systemctl status amazon-ssm-agent

# Si arrêté, le démarrer
sudo systemctl start amazon-ssm-agent

# Vérifier les logs
sudo tail -f /var/log/amazon/ssm/amazon-ssm-agent.log
```

---

### Solution 4: Vérifier le Rôle IAM Attaché

**Via AWS Console**:
1. **EC2** → **Instances** → Sélectionnez `i-0b9ad404f8d738d04`
2. **Onglet "Sécurité"** (Security) en bas
3. **Section "Rôles IAM"** (IAM roles)
4. **Vérifiez** que `yukpo-temp-ec2-ssm-profile` est bien attaché
5. Si **non attaché**, attachez-le à nouveau

---

### Solution 5: Vérifier les Permissions du Rôle

**Via AWS Console**:
1. **IAM** → **Roles** → `yukpo-temp-ec2-ssm-role`
2. **Onglet "Permissions"**
3. **Vérifiez** que ces politiques sont attachées:
   - ✅ `AmazonSSMManagedInstanceCore` (doit être présent)
   - ✅ `yukpo-temp-ec2-secrets-policy` (pour Secrets Manager)

---

## 🔍 **DIAGNOSTIC**

### Vérifier l'État de l'Instance

```bash
# Depuis votre machine locale
aws ec2 describe-instances \
  --instance-ids i-0b9ad404f8d738d04 \
  --region eu-west-1 \
  --query 'Reservations[0].Instances[0].[State.Name,InstanceId,PublicIpAddress]' \
  --output table
```

**Résultats possibles**:
- `running` → ✅ Instance fonctionne, redémarrez-la (Solution 1)
- `stopped` → ❌ Instance arrêtée, démarrez-la
- `stopping` → ⏳ Instance en cours d'arrêt, attendez puis démarrez-la

---

## ✅ **RECOMMANDATION - Ordre d'Action**

1. **Vérifiez l'état de l'instance** (Solution 2)
2. **Si "running"** → **Redémarrez l'instance** (Solution 1)
3. **Attendez 2-3 minutes**
4. **Vérifiez Session Manager** → Devrait être "En ligne"
5. **Si toujours hors ligne** → Vérifiez les permissions du rôle (Solution 5)

---

## 🚀 **ALTERNATIVE - Utiliser SSH Directement**

Si SSM ne fonctionne toujours pas après avoir essayé toutes les solutions :

### Créer une Clé SSH

1. **EC2** → **Key Pairs** → **Create key pair**
2. **Nom**: `yukpo-temp-key`
3. **Type**: RSA, Format: `.pem`
4. **Téléchargez la clé**

### Attacher la Clé à l'Instance

1. **Arrêtez l'instance** (si nécessaire)
2. **Actions** → **Instance settings** → **Attach/Replace key pair**
3. **Sélectionnez**: `yukpo-temp-key`
4. **Démarrez l'instance**

### Se Connecter via SSH

```bash
# Depuis votre machine locale
ssh -i yukpo-temp-key.pem ec2-user@52.17.27.232
```

---

## ✅ **RÉSUMÉ**

**Problème**: Agent SSM toujours hors ligne après attachement du rôle

**Solutions**:
1. ✅ Redémarrer l'instance (le plus efficace)
2. ✅ Vérifier l'état de l'instance
3. ✅ Vérifier les permissions du rôle
4. ✅ Utiliser SSH directement (alternative)

**Action immédiate**: Redémarrez l'instance et attendez 2-3 minutes.

