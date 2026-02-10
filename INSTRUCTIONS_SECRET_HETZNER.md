# 🔑 Instructions : Ajouter HETZNER_SSH_PRIVATE_KEY

## ⚠️ Problème

Le workflow échoue avec l'erreur :
```
Error: The ssh-private-key argument is empty. Maybe the secret has not been configured
```

## ✅ Solution (2 minutes)

### Étape 1 : Ouvrir GitHub Secrets

La page a été ouverte dans votre navigateur :
**https://github.com/Her50/yukpo4/settings/secrets/actions**

### Étape 2 : Ajouter le Secret

1. **Cliquez sur** "New repository secret" (bouton en haut à droite)

2. **Nom** : `HETZNER_SSH_PRIVATE_KEY`

3. **Valeur** : Copiez **TOUT** le contenu ci-dessous (y compris les lignes `-----BEGIN` et `-----END`)

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACChwmlYLrolAwamJKpr+b4L3tesNSwqFETFyJy2EHISmwAAAKDfsdm137HZ
tQAAAAtzc2gtZWQyNTUxOQAAACChwmlYLrolAwamJKpr+b4L3tesNSwqFETFyJy2EHISmw
AAAEDfFHIL78/myt+ODy+CVFmk/pUCyPKNyGVL2yw9W3H3oaHCaVguuiUDBqYkqmv5vgve
16w1LCoURMXInLYQchKbAAAAFmdpdGh1Yi1hY3Rpb25zLWhldHpuZXIBAgMEBQYH
-----END OPENSSH PRIVATE KEY-----
```

4. **Cliquez sur** "Add secret"

### Étape 3 : Relancer le Workflow

Après avoir ajouté le secret :

1. Allez sur : https://github.com/Her50/yukpo4/actions/workflows/deploy-env-hetzner.yml
2. Cliquez sur "Run workflow"
3. Cliquez sur le bouton vert "Run workflow"

## 📝 Note

La clé SSH complète est aussi disponible dans :
- Fichier local : `C:\Users\23767\.ssh\hetzner_deploy`
- Instructions : `GITHUB_SECRETS_INSTRUCTIONS.txt`

---

**Temps estimé : 2 minutes** ⏱️

