# 🎯 Où Cliquer pour Déployer

## ✅ Le workflow est maintenant sur GitHub !

### Étape 1 : Rafraîchir la page

**Rafraîchissez la page GitHub Actions** (F5 ou Ctrl+R)

Vous devriez maintenant voir le workflow **"Deploy .env to Hetzner"** dans la liste.

### Étape 2 : Cliquer sur "Run workflow"

1. **En haut à droite** de la page, vous verrez un bouton **"Run workflow"** (à côté de "Actions")
2. **Cliquez dessus**
3. Dans le menu déroulant, **cliquez sur le bouton vert "Run workflow"**

### Étape 3 : Attendre 2-3 minutes

Le workflow va automatiquement :
- ✅ Se connecter à AWS
- ✅ Récupérer toutes les variables
- ✅ Les adapter pour Hetzner
- ✅ Déployer le fichier `.env` sur Hetzner
- ✅ Vérifier que tout est OK

## ⚠️ Note importante

Le workflow utilise des secrets GitHub pour Wasabi :
- `WASABI_ACCESS_KEY`
- `WASABI_SECRET_KEY`

Si ces secrets n'existent pas dans GitHub, ajoutez-les dans :
**Settings → Secrets and variables → Actions → New repository secret**

Ou le workflow utilisera les valeurs par défaut depuis AWS.

---

**Rafraîchissez la page et cliquez sur "Run workflow" !** 🚀

