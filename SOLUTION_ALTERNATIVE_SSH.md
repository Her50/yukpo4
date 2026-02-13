# 🔧 Solution Alternative : Utiliser SSH Directement

## ⚠️ Problème

Impossible d'attacher le rôle IAM via la console. Solution : Utiliser SSH directement.

## ✅ Solution : Créer une Clé SSH et Se Connecter

### Option 1 : Créer une Clé SSH dans AWS Console

1. **Allez dans EC2** → **Network & Security** → **Key Pairs**
2. **Cliquez sur "Create key pair"**
3. **Configuration** :
   - Name : `yukpo-temp-key`
   - Key pair type : `RSA`
   - Private key file format : `.pem`
4. **Cliquez sur "Create key pair"**
5. **Téléchargez le fichier** `.pem` (gardez-le en sécurité !)

### Option 2 : Attacher la Clé à l'Instance

**Problème** : On ne peut pas modifier une instance en cours d'exécution.

**Solution** : Recréer l'instance avec la clé SSH.

### Option 3 : Utiliser AWS Systems Manager avec Rôle IAM (Recommandé)

Recréons l'instance avec le rôle IAM déjà attaché dès le départ.

