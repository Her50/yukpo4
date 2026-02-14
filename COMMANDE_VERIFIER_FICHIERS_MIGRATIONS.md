# 🔍 Vérifier les Fichiers Migrations

## ✅ **Vérification**

Les fichiers téléchargés contiennent probablement des pages d'erreur 404 HTML au lieu du SQL. Vérifions :

```bash
# Vérifier le contenu d'un fichier
head -5 ~/migrations/00000001_create_extensions.sql

# Si vous voyez "<!DOCTYPE html>" ou "404", les fichiers sont invalides
```

---

## ✅ **Solution : Utiliser SCP depuis Windows**

Le repository est privé, donc curl ne peut pas télécharger les fichiers. Il faut utiliser SCP depuis votre machine Windows.

### Étape 1 : Sur Windows PowerShell

```powershell
# Aller dans le projet
cd C:\Users\23767\yukpomnang2

# Vérifier que les migrations existent
dir backend\migrations\*.sql | Select-Object -First 5

# Trouver l'IP EC2
$EC2_IP = aws ec2 describe-instances --filters "Name=tag:Name,Values=yukpo-temp-db-creator" --region eu-west-1 --query 'Reservations[0].Instances[0].PublicIpAddress' --output text
Write-Host "IP EC2: $EC2_IP"

# Transférer (REMPLACEZ le chemin de la clé .pem)
scp -i "C:\chemin\vers\votre-cle.pem" -r backend\migrations ec2-user@${EC2_IP}:~/migrations/
```

---

## ✅ **Alternative : Supprimer les Fichiers Invalides et Réessayer avec Token**

Si vous avez un token GitHub :

```bash
# Sur EC2, supprimer les fichiers invalides
rm ~/migrations/000000*.sql

# Créer un token sur https://github.com/settings/tokens
# Puis télécharger avec le token
GITHUB_TOKEN="votre_token_ici"

cd ~/migrations

MIGRATIONS=(
    "00000001_create_extensions.sql"
    # ... (liste complète)
)

for migration in "${MIGRATIONS[@]}"; do
    echo "📥 Téléchargement de $migration..."
    curl -L "https://raw.githubusercontent.com/Her50/yukpo4/main/backend/migrations/$migration" \
        -o "$migration" \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3.raw" \
        2>/dev/null && echo "✅ $migration" || echo "⚠️  Échec: $migration"
done
```

---

## ✅ **Solution Recommandée : SCP**

La méthode la plus fiable est d'utiliser SCP depuis Windows pour transférer les fichiers locaux.

