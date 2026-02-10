# 🔧 Fix : Erreur SSH Hetzner - Permission Denied

## ❌ Problème
```
Permission denied (publickey,password).
Error: Process completed with exit code 255.
```

## 🔍 Cause
Le secret `HETZNER_SSH_PRIVATE_KEY` n'est pas configuré dans GitHub Secrets, ou la clé publique n'est pas sur le serveur Hetzner.

## ✅ Solution en 3 étapes

### Étape 1 : Vérifier que la clé publique est sur Hetzner

Connectez-vous à Hetzner et vérifiez que la clé publique est dans `~/.ssh/authorized_keys` :

```bash
ssh root@46.224.14.85
cat ~/.ssh/authorized_keys
```

Si la clé n'est pas là, ajoutez-la :

```bash
# Sur votre machine Windows, récupérez la clé publique :
cat ~/.ssh/hetzner_deploy.pub

# Copiez le contenu, puis sur Hetzner :
echo "VOTRE_CLE_PUBLIQUE_ICI" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

### Étape 2 : Ajouter le secret dans GitHub

1. **Ouvrir GitHub Secrets** :
   - https://github.com/Her50/yukpo4/settings/secrets/actions

2. **Cliquer sur "New repository secret"**

3. **Nom** : `HETZNER_SSH_PRIVATE_KEY`

4. **Valeur** : Copier le contenu complet de la clé privée :
   ```
   -----BEGIN OPENSSH PRIVATE KEY-----
   b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
   QyNTUxOQAAACChwmlYLrolAwamJKpr+b4L3tesNSwqFETFyJy2EHISmwAAAKDfsdm137HZ
   tQAAAAtzc2gtZWQyNTUxOQAAACChwmlYLrolAwamJKpr+b4L3tesNSwqFETFyJy2EHISmw
   AAAEDfFHIL78/myt+ODy+CVFmk/pUCyPKNyGVL2yw9W3H3oaHCaVguuiUDBqYkqmv5vgve
   16w1LCoURMXInLYQchKbAAAAFmdpdGh1Yi1hY3Rpb25zLWhldHpuZXIBAgMEBQYH
   -----END OPENSSH PRIVATE KEY-----
   ```

   **OU** lire depuis le fichier local :
   ```powershell
   Get-Content "$env:USERPROFILE\.ssh\hetzner_deploy"
   ```

5. **Cliquer sur "Add secret"**

### Étape 3 : Vérifier la connexion

Après avoir ajouté le secret, relancez le workflow :
- https://github.com/Her50/yukpo4/actions/workflows/docker-build-optimized.yml
- Cliquez sur "Run workflow" → Cochez `push_to_hetzner` → "Run workflow"

## 🔍 Vérification rapide

Pour vérifier que tout est correct :

```powershell
# 1. Vérifier que la clé existe localement
Test-Path "$env:USERPROFILE\.ssh\hetzner_deploy"

# 2. Afficher la clé publique (à copier sur Hetzner)
Get-Content "$env:USERPROFILE\.ssh\hetzner_deploy.pub"

# 3. Tester la connexion SSH manuellement
ssh -i "$env:USERPROFILE\.ssh\hetzner_deploy" root@46.224.14.85 "echo 'Test OK'"
```

## 📝 Notes importantes

- ⚠️ **Ne jamais commiter la clé privée** dans Git
- ✅ La clé privée doit être dans GitHub Secrets uniquement
- ✅ La clé publique doit être sur le serveur Hetzner dans `~/.ssh/authorized_keys`
- ✅ Les permissions SSH doivent être correctes (600 pour authorized_keys, 700 pour .ssh)

