# 🚀 Exécuter sur Hetzner - Correction SSH

## 📋 Script à exécuter

Le fichier `fix-hetzner-ssh.sh` contient le script à exécuter sur Hetzner.

## 🔧 Méthode 1 : Copier et exécuter (Recommandé)

### Étape 1 : Copier le script sur Hetzner

```powershell
# Depuis Windows PowerShell
scp fix-hetzner-ssh.sh root@46.224.14.85:/tmp/
```

### Étape 2 : Se connecter et exécuter

```bash
ssh root@46.224.14.85
bash /tmp/fix-hetzner-ssh.sh
```

## 🔧 Méthode 2 : Commande directe (Plus rapide)

Connectez-vous à Hetzner et exécutez directement :

```bash
ssh root@46.224.14.85
```

Puis copiez-collez cette commande complète :

```bash
PUBLIC_KEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKHCaVguuiUDBqYkqmv5vgve16w1LCoURMXInLYQchKb github-actions-hetzner" && \
if [ ! -d ~/.ssh ]; then mkdir -p ~/.ssh && chmod 700 ~/.ssh; fi && \
if [ ! -f ~/.ssh/authorized_keys ]; then touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys; fi && \
grep -v "github-actions-hetzner" ~/.ssh/authorized_keys > ~/.ssh/authorized_keys.tmp 2>/dev/null || true && \
mv ~/.ssh/authorized_keys.tmp ~/.ssh/authorized_keys && \
echo "$PUBLIC_KEY" >> ~/.ssh/authorized_keys && \
chmod 600 ~/.ssh/authorized_keys && \
chmod 700 ~/.ssh && \
echo "✅ Clé ajoutée!" && \
grep "github-actions-hetzner" ~/.ssh/authorized_keys
```

## ✅ Vérification

Après exécution, vérifiez :

```bash
# Vérifier que la clé est présente
grep "github-actions-hetzner" ~/.ssh/authorized_keys

# Vérifier les permissions
ls -la ~/.ssh/authorized_keys
ls -ld ~/.ssh
```

Les permissions doivent être :
- `~/.ssh/authorized_keys` : `600` (rw-------)
- `~/.ssh` : `700` (rwx------)

## 🔄 Après correction

Relancez le workflow GitHub Actions :
- https://github.com/Her50/yukpo4/actions/workflows/docker-build-optimized.yml
- Cliquez sur "Run workflow" → Cochez `push_to_hetzner` → "Run workflow"

