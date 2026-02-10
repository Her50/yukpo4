# 🔍 Diagnostic SSH Hetzner - Permission Denied

## ✅ État actuel
- ✅ Secret `HETZNER_SSH_PRIVATE_KEY` présent dans GitHub Secrets
- ❌ Workflow échoue avec "Permission denied (publickey,password)"

## 🔍 Causes possibles

### 1. Clé publique absente sur Hetzner

La clé publique doit être dans `~/.ssh/authorized_keys` sur le serveur Hetzner.

**Clé publique à ajouter :**
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKHCaVguuiUDBqYkqmv5vgve16w1LCoURMXInLYQchKb github-actions-hetzner
```

**Commandes à exécuter sur Hetzner :**

```bash
# 1. Se connecter à Hetzner
ssh root@46.224.14.85

# 2. Vérifier si la clé existe déjà
grep 'github-actions-hetzner' ~/.ssh/authorized_keys

# 3. Si la clé n'existe pas, l'ajouter
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKHCaVguuiUDBqYkqmv5vgve16w1LCoURMXInLYQchKb github-actions-hetzner" >> ~/.ssh/authorized_keys

# 4. Vérifier les permissions (CRITIQUE)
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh

# 5. Vérifier que la clé est bien ajoutée
cat ~/.ssh/authorized_keys | grep 'github-actions-hetzner'
```

### 2. Format incorrect dans GitHub Secrets

La clé privée dans GitHub Secrets doit être **exactement** comme ci-dessous, sans espaces supplémentaires :

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACChwmlYLrolAwamJKpr+b4L3tesNSwqFETFyJy2EHISmwAAAKDfsdm137HZ
tQAAAAtzc2gtZWQyNTUxOQAAACChwmlYLrolAwamJKpr+b4L3tesNSwqFETFyJy2EHISmw
AAAEDfFHIL78/myt+ODy+CVFmk/pUCyPKNyGVL2yw9W3H3oaHCaVguuiUDBqYkqmv5vgve
16w1LCoURMXInLYQchKbAAAAFmdpdGh1Yi1hY3Rpb25zLWhldHpuZXIBAgMEBQYH
-----END OPENSSH PRIVATE KEY-----
```

**Pour vérifier/corriger :**
1. Ouvrir : https://github.com/Her50/yukpo4/settings/secrets/actions
2. Cliquer sur **"edit"** (icône crayon) à côté de `HETZNER_SSH_PRIVATE_KEY`
3. Vérifier que :
   - La clé commence par `-----BEGIN OPENSSH PRIVATE KEY-----`
   - La clé finit par `-----END OPENSSH PRIVATE KEY-----`
   - Il n'y a pas d'espaces ou de lignes vides avant/après
   - Le contenu est identique à celui ci-dessus
4. Si nécessaire, copier-coller la clé complète depuis `GITHUB_SECRETS_INSTRUCTIONS.txt`
5. Cliquer sur **"Update secret"**

### 3. Permissions SSH incorrectes sur Hetzner

Les permissions doivent être :
- `~/.ssh/authorized_keys` : `600` (rw-------)
- `~/.ssh` : `700` (rwx------)

**Vérifier :**
```bash
ls -la ~/.ssh/authorized_keys
ls -ld ~/.ssh
```

**Corriger si nécessaire :**
```bash
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

## 🧪 Test de connexion manuelle

Pour tester si la clé fonctionne :

```powershell
# Sur Windows (PowerShell)
ssh -i "$env:USERPROFILE\.ssh\hetzner_deploy" root@46.224.14.85 "echo 'SSH OK'"
```

Si cela fonctionne, le problème vient de GitHub Actions. Si cela échoue, le problème vient de la configuration SSH sur Hetzner.

## ✅ Checklist de résolution

- [ ] Clé publique ajoutée dans `~/.ssh/authorized_keys` sur Hetzner
- [ ] Permissions correctes (`600` pour authorized_keys, `700` pour .ssh)
- [ ] Format de la clé privée correct dans GitHub Secrets (avec BEGIN/END)
- [ ] Test de connexion manuelle réussi
- [ ] Workflow GitHub Actions relancé après corrections

## 🔗 Liens utiles

- GitHub Secrets : https://github.com/Her50/yukpo4/settings/secrets/actions
- Workflow : https://github.com/Her50/yukpo4/actions/workflows/docker-build-optimized.yml
- Clé publique : `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKHCaVguuiUDBqYkqmv5vgve16w1LCoURMXInLYQchKb github-actions-hetzner`

