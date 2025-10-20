#!/bin/bash
# Script pour configurer le cron job de rafraîchissement des pharmacies de garde
# Date: 2025-10-20

echo "🔧 Configuration du cron job pour rafraîchissement des pharmacies de garde"

# Vérifier si PostgreSQL est accessible
if ! command -v psql &> /dev/null; then
    echo "❌ psql n'est pas installé ou pas dans le PATH"
    exit 1
fi

# Variables de configuration
DB_NAME="yukpomnang"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"

# Créer le script de rafraîchissement
cat > /tmp/refresh_pharmacies.sh << 'EOF'
#!/bin/bash
# Script de rafraîchissement des pharmacies de garde
# Exécuté toutes les heures

# Variables de base de données
DB_NAME="yukpomnang"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"

# Log avec timestamp
LOG_FILE="/var/log/yukpomnang/pharmacies_refresh.log"
mkdir -p "$(dirname "$LOG_FILE")"

echo "$(date): Début rafraîchissement pharmacies de garde" >> "$LOG_FILE"

# Exécuter le rafraîchissement
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT refresh_pharmacies_on_duty();" >> "$LOG_FILE" 2>&1; then
    echo "$(date): Rafraîchissement réussi" >> "$LOG_FILE"
else
    echo "$(date): Erreur lors du rafraîchissement" >> "$LOG_FILE"
    exit 1
fi

echo "$(date): Fin rafraîchissement pharmacies de garde" >> "$LOG_FILE"
EOF

# Rendre le script exécutable
chmod +x /tmp/refresh_pharmacies.sh

# Copier le script dans un répertoire permanent
sudo cp /tmp/refresh_pharmacies.sh /usr/local/bin/refresh_pharmacies.sh
sudo chmod +x /usr/local/bin/refresh_pharmacies.sh

# Créer le répertoire de logs
sudo mkdir -p /var/log/yukpomnang
sudo chown postgres:postgres /var/log/yukpomnang

# Ajouter la tâche cron (toutes les heures à la minute 0)
CRON_JOB="0 * * * * /usr/local/bin/refresh_pharmacies.sh"

# Vérifier si la tâche cron existe déjà
if crontab -l 2>/dev/null | grep -q "refresh_pharmacies.sh"; then
    echo "⚠️  La tâche cron existe déjà"
else
    # Ajouter la tâche cron
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✅ Tâche cron ajoutée: $CRON_JOB"
fi

# Tester le script
echo "🧪 Test du script de rafraîchissement..."
if /usr/local/bin/refresh_pharmacies.sh; then
    echo "✅ Test réussi"
else
    echo "❌ Test échoué"
    exit 1
fi

# Afficher les tâches cron configurées
echo "📋 Tâches cron configurées:"
crontab -l | grep -E "(refresh_pharmacies|yukpomnang)" || echo "Aucune tâche yukpomnang trouvée"

echo "🎉 Configuration terminée!"
echo ""
echo "📝 Informations:"
echo "   - Script: /usr/local/bin/refresh_pharmacies.sh"
echo "   - Logs: /var/log/yukpomnang/pharmacies_refresh.log"
echo "   - Fréquence: Toutes les heures"
echo "   - Base de données: $DB_NAME@$DB_HOST:$DB_PORT"
echo ""
echo "🔍 Pour vérifier les logs:"
echo "   tail -f /var/log/yukpomnang/pharmacies_refresh.log"
echo ""
echo "🛠️  Pour modifier la fréquence, éditez le cron:"
echo "   crontab -e"
