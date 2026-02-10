# 🔑 Ajouter le Secret GitHub HETZNER_SSH_PRIVATE_KEY

## ⚠️ Erreur Actuelle

Le workflow échoue car le secret `HETZNER_SSH_PRIVATE_KEY` n'est pas configuré dans GitHub Secrets.

## ✅ Solution Rapide (2 minutes)

### Option 1 : Via GitHub Web Interface (Recommandé)

1. **Allez sur** : https://github.com/Her50/yukpo4/settings/secrets/actions

2. **Cliquez sur** "New repository secret" (bouton en haut à droite)

3. **Nom du secret** : `HETZNER_SSH_PRIVATE_KEY`

4. **Valeur** : Copiez tout le contenu de votre clé SSH privée :
   ```
   -----BEGIN OPENSSH PRIVATE KEY-----
   b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
   QyNTUxOQAAACChwmlYLrolAwamJKpr+b4L3tesNSwqFETFyJy2EHISmwAAAKDfsdm137HZ
   tQAAAAtzc2gtZWQyNTUxOQAAACChwmlYLrolAwamJKpr+b4L3tesNSwqFETFyJy2EHISmw
   AAAEDfFHIL78/myt+ODy+CVFmk/pUCyPKNyGVL2yw9W3H3oaHCaVguuiUDBqYkqmv5vgve
   16w1LCoURMXInLYQchKbAAAAFmdpdGh1Yi1hY3Rpb25zLWhldHpuZXIBAgMEBQYH
   -----END OPENSSH PRIVATE KEY-----
   ```

5. **Cliquez sur** "Add secret"

### Option 2 : Via GitHub CLI (Automatique)

Si vous avez GitHub CLI installé :

```powershell
# Se connecter (une seule fois)
gh auth login

# Ajouter le secret
Get-Content "$env:USERPROFILE\.ssh\hetzner_deploy" -Raw | gh secret set HETZNER_SSH_PRIVATE_KEY --repo Her50/yukpo4
```

## 🔍 Vérification

Après avoir ajouté le secret, relancez le workflow "Deploy .env to Hetzner" :
- https://github.com/Her50/yukpo4/actions/workflows/deploy-env-hetzner.yml
- Cliquez sur "Run workflow"

## 📝 Note

La clé SSH privée est déjà générée et se trouve dans :
`C:\Users\23767\.ssh\hetzner_deploy`

---

**Temps estimé : 2 minutes** ⏱️

