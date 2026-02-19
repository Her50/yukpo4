# Solutions Cloud de Sauvegarde - Budget < 10$/mois

## Contexte
- Application microfinance avec maximum 100 membres
- Besoin de sauvegarde automatique des données
- Budget : moins de 10$ par mois

## Estimation des Besoins

### Volume de Données Estimé (100 membres)
- **Base de données** : ~50-200 MB (PostgreSQL compressé)
- **Fichiers uploadés** (preuves paiement, documents) : ~500 MB - 2 GB
- **Total estimé** : ~1-3 GB par sauvegarde
- **Sauvegardes multiples** : 7-30 jours de rétention = 10-30 GB total

## Solutions Recommandées

### 🥇 Option 1 : Backblaze B2 (Recommandé)
**Prix** : ~0.005$ par GB/mois de stockage + 0.01$ par GB de téléchargement

**Estimation coût** :
- Stockage 30 GB : 0.15$ / mois
- Téléchargement occasionnel : ~0.50$ / mois
- **Total : ~0.65$ / mois** ✅

**Avantages** :
- ✅ Très économique
- ✅ API S3-compatible (facile à intégrer)
- ✅ Pas de frais de sortie pour les 10 premiers GB/mois
- ✅ Sauvegardes incrémentielles supportées
- ✅ Versioning des fichiers

**Intégration** :
```rust
// Utiliser bibliothèque s3-compatible
// Configuration Backblaze B2
let config = S3Config {
    endpoint: "https://s3.us-west-000.backblazeb2.com",
    bucket: "yukpo-sauvegardes",
    access_key: "...",
    secret_key: "...",
};
```

**Outils** :
- `rclone` pour synchronisation automatique
- `pg_dump` + upload vers B2
- Scripts cron pour automatisation

---

### 🥈 Option 2 : Wasabi Hot Storage
**Prix** : 6.99$ / TB / mois (minimum 1 TB, mais facturé au GB)

**Estimation coût** :
- 30 GB : ~0.21$ / mois
- **Total : ~0.21$ / mois** ✅

**Avantages** :
- ✅ Très économique
- ✅ API S3-compatible
- ✅ Pas de frais d'egress (téléchargement gratuit)
- ✅ Performance élevée
- ✅ Rétention configurable

**Inconvénients** :
- Minimum de facturation (mais très faible pour 30 GB)

---

### 🥉 Option 3 : Scaleway Object Storage
**Prix** : 0.01€ / GB / mois (stockage) + 0.01€ / GB (sortie)

**Estimation coût** :
- Stockage 30 GB : 0.30€ / mois (~0.33$)
- Sortie occasionnelle : ~0.30€ / mois
- **Total : ~0.60€ / mois (~0.66$)** ✅

**Avantages** :
- ✅ API S3-compatible
- ✅ Datacenters en Europe (RGPD-friendly)
- ✅ Pas de frais minimum
- ✅ Facturation au GB réel

---

### Option 4 : DigitalOcean Spaces
**Prix** : 5$ / mois pour 250 GB (flat rate)

**Estimation coût** :
- **Total : 5$ / mois** ✅ (dans le budget)

**Avantages** :
- ✅ Prix fixe prévisible
- ✅ API S3-compatible
- ✅ CDN intégré (gratuit)
- ✅ Interface simple
- ✅ 250 GB inclus (largement suffisant)

**Inconvénients** :
- Plus cher que les autres si on utilise < 50 GB

---

### Option 5 : AWS S3 Glacier Instant Retrieval
**Prix** : 0.004$ / GB / mois (stockage) + 0.03$ / GB (récupération)

**Estimation coût** :
- Stockage 30 GB : 0.12$ / mois
- Récupération occasionnelle : ~0.30$ / mois
- **Total : ~0.42$ / mois** ✅

**Avantages** :
- ✅ Très économique pour stockage
- ✅ Récupération instantanée (contrairement à Glacier standard)
- ✅ Intégration AWS facile

**Inconvénients** :
- Coût de récupération plus élevé
- Plus complexe à configurer

---

### Option 6 : Solution Hybride (Recommandée pour Sécurité)

#### Combinaison : Backblaze B2 + Backup Local
**Stratégie** :
1. **Sauvegarde locale** : Serveur de développement ou NAS
2. **Sauvegarde cloud** : Backblaze B2 (0.65$ / mois)
3. **Sauvegarde externe** : Disque dur externe (une fois par semaine)

**Coût total** : ~0.65$ / mois (disque dur = investissement unique)

**Avantages** :
- ✅ Triple sauvegarde (3-2-1 rule)
- ✅ Récupération rapide (local)
- ✅ Protection contre sinistre (cloud)
- ✅ Coût minimal

---

## Architecture de Sauvegarde Recommandée

### Stratégie 3-2-1
- **3 copies** : Production + Sauvegarde locale + Cloud
- **2 supports différents** : Disque + Cloud
- **1 copie hors site** : Cloud

### Plan de Sauvegarde

```bash
# Sauvegarde quotidienne (automatisée)
0 2 * * * /usr/local/bin/backup-database.sh
0 3 * * * /usr/local/bin/backup-files.sh

# Script backup-database.sh
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/backups/db_${DATE}.sql.gz"

# Dump PostgreSQL
pg_dump -h localhost -U postgres yukpo_db | gzip > $BACKUP_FILE

# Upload vers Backblaze B2
rclone copy $BACKUP_FILE b2:yukpo-backups/database/

# Garder seulement 7 jours localement
find /backups -name "db_*.sql.gz" -mtime +7 -delete
```

### Rétention
- **Quotidienne** : 7 jours
- **Hebdomadaire** : 4 semaines
- **Mensuelle** : 12 mois
- **Annuelle** : 3 ans

---

## Comparaison Rapide

| Solution | Coût/mois | API S3 | Egress | Recommandation |
|----------|-----------|--------|--------|----------------|
| **Backblaze B2** | ~0.65$ | ✅ | Payant | ⭐⭐⭐⭐⭐ |
| **Wasabi** | ~0.21$ | ✅ | Gratuit | ⭐⭐⭐⭐ |
| **Scaleway** | ~0.66$ | ✅ | Payant | ⭐⭐⭐⭐ |
| **DigitalOcean Spaces** | 5$ | ✅ | Gratuit | ⭐⭐⭐ |
| **AWS S3 Glacier** | ~0.42$ | ✅ | Payant | ⭐⭐⭐ |

---

## Recommandation Finale

### Pour votre cas (100 membres, < 10$/mois)

**Solution recommandée : Backblaze B2**

**Pourquoi ?**
1. ✅ Coût très faible (~0.65$ / mois)
2. ✅ API S3-compatible (intégration facile)
3. ✅ Fiable et performant
4. ✅ Pas de frais minimum
5. ✅ Supporte versioning

**Configuration suggérée** :
- **Stockage** : 30 GB (suffisant pour 1 an de sauvegardes)
- **Rétention** : 30 jours de sauvegardes quotidiennes
- **Fréquence** : Sauvegarde quotidienne automatique
- **Coût estimé** : **0.65$ / mois**

### Alternative : Wasabi (si priorité au coût)
- **Coût** : ~0.21$ / mois
- **Avantage** : Egress gratuit (téléchargements illimités)
- **Inconvénient** : Minimum de facturation (mais très faible)

---

## Implémentation Technique

### 1. Configuration Backblaze B2

```bash
# Installer rclone
curl https://rclone.org/install.sh | sudo bash

# Configurer Backblaze B2
rclone config
# Choisir "b2"
# Entrer account_id et application_key
```

### 2. Script de Sauvegarde Automatique

```bash
#!/bin/bash
# backup-to-b2.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_BACKUP="$BACKUP_DIR/db_${DATE}.sql.gz"
FILES_BACKUP="$BACKUP_DIR/files_${DATE}.tar.gz"

# Sauvegarde base de données
pg_dump -h localhost -U postgres yukpo_db | gzip > $DB_BACKUP

# Sauvegarde fichiers uploadés
tar -czf $FILES_BACKUP /var/www/yukpo/uploads/

# Upload vers B2
rclone copy $DB_BACKUP b2:yukpo-backups/database/
rclone copy $FILES_BACKUP b2:yukpo-backups/files/

# Nettoyage local (garder 7 jours)
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Sauvegarde terminée : $DATE"
```

### 3. Intégration dans l'Application (Rust)

```rust
// Cargo.toml
[dependencies]
aws-sdk-s3 = "1.0"  // Compatible avec Backblaze B2

// backup_service.rs
use aws_sdk_s3::Client as S3Client;

pub struct BackupService {
    s3_client: S3Client,
    bucket: String,
}

impl BackupService {
    pub async fn backup_database(&self) -> Result<(), Error> {
        // Dump PostgreSQL
        let backup_file = self.dump_database().await?;
        
        // Upload vers B2
        self.upload_to_b2(&backup_file, "database/").await?;
        
        Ok(())
    }
    
    pub async fn backup_files(&self) -> Result<(), Error> {
        // Archive fichiers uploadés
        let archive = self.archive_files().await?;
        
        // Upload vers B2
        self.upload_to_b2(&archive, "files/").await?;
        
        Ok(())
    }
}
```

### 4. Planification (Cron)

```cron
# Sauvegarde quotidienne à 2h du matin
0 2 * * * /usr/local/bin/backup-to-b2.sh >> /var/log/backup.log 2>&1

# Nettoyage anciennes sauvegardes B2 (garder 30 jours)
0 3 1 * * rclone delete b2:yukpo-backups --min-age 30d
```

---

## Monitoring et Alertes

### Vérification Automatique

```bash
#!/bin/bash
# check-backup.sh

# Vérifier dernière sauvegarde
LAST_BACKUP=$(rclone ls b2:yukpo-backups/database/ | tail -1)

if [ -z "$LAST_BACKUP" ]; then
    # Envoyer alerte (email, Slack, etc.)
    echo "ALERTE : Aucune sauvegarde trouvée !" | mail -s "Backup Alert" admin@yukpo.com
fi
```

---

## Budget Total Estimé

### Scénario Conservateur (30 GB stockage)
- **Backblaze B2** : 0.65$ / mois
- **Total annuel** : ~7.80$ / an
- **Sur 3 ans** : ~23.40$

### Scénario avec Croissance (100 GB)
- **Backblaze B2** : 2.00$ / mois
- **Total annuel** : ~24$ / an
- **Sur 3 ans** : ~72$

**Conclusion** : Même avec croissance, reste largement sous 10$ / mois ✅

---

## Checklist Implémentation

- [ ] Créer compte Backblaze B2
- [ ] Configurer bucket de sauvegarde
- [ ] Installer et configurer rclone
- [ ] Créer scripts de sauvegarde
- [ ] Configurer cron jobs
- [ ] Tester restauration
- [ ] Configurer monitoring
- [ ] Documenter procédure de restauration
- [ ] Tester sauvegarde complète
- [ ] Mettre en place alertes

---

*Document créé : Février 2026*
*Recommandation : Backblaze B2 à 0.65$ / mois*

