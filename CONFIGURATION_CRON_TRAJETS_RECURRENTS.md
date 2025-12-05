# ⏰ Configuration Cron - Trajets Récurrents

## 📋 Vue d'ensemble

La tâche cron génère et active automatiquement les instances de trajets récurrents.

**Deux actions principales** :
1. **Génération** : Crée les instances pour les prochains jours
2. **Activation** : Crée les trajets réels depuis les instances en attente

---

## 🚀 Méthodes d'Exécution

### Méthode 1 : Script Standalone (Recommandé)

#### Linux/Mac
```bash
# Générer instances pour 30 jours
./scripts/recurring_trips_cron.sh generate 30

# Activer instances pour 7 jours
./scripts/recurring_trips_cron.sh activate 7

# Cycle complet (génère 30j + active 7j)
./scripts/recurring_trips_cron.sh full
```

#### Windows (PowerShell)
```powershell
# Générer instances pour 30 jours
.\scripts\recurring_trips_cron.ps1 -Action generate -DaysAhead 30

# Activer instances pour 7 jours
.\scripts\recurring_trips_cron.ps1 -Action activate -DaysAhead 7

# Cycle complet
.\scripts\recurring_trips_cron.ps1 -Action full
```

### Méthode 2 : Cargo Direct

```bash
cd backend

# Générer instances
cargo run --bin recurring_trips_cron --release -- generate 30

# Activer instances
cargo run --bin recurring_trips_cron --release -- activate 7

# Cycle complet
cargo run --bin recurring_trips_cron --release -- full
```

### Méthode 3 : API Endpoint (pour services externes)

```bash
# Générer instances
curl -X POST http://localhost:3000/api/covoiturages/recurring/generate \
  -H "Content-Type: application/json" \
  -d '{"days_ahead": 30}'

# Activer instances
curl -X POST http://localhost:3000/api/covoiturages/recurring/activate \
  -H "Content-Type: application/json" \
  -d '{"days_ahead": 7}'
```

---

## ⏰ Configuration Crontab (Linux/Mac)

### Édition Crontab
```bash
crontab -e
```

### Configuration Recommandée

```bash
# Générer instances tous les jours à 2h du matin (30 jours)
0 2 * * * cd /chemin/vers/yukpomnang2/backend && ./scripts/recurring_trips_cron.sh generate 30 >> /var/log/recurring_trips.log 2>&1

# Activer instances tous les jours à 3h du matin (7 jours)
0 3 * * * cd /chemin/vers/yukpomnang2/backend && ./scripts/recurring_trips_cron.sh activate 7 >> /var/log/recurring_trips.log 2>&1
```

### Configuration Alternative (Cycle Complet)

```bash
# Exécuter cycle complet tous les jours à 2h du matin
0 2 * * * cd /chemin/vers/yukpomnang2/backend && ./scripts/recurring_trips_cron.sh full >> /var/log/recurring_trips.log 2>&1
```

---

## 🪟 Configuration Task Scheduler (Windows)

### Créer Tâche Planifiée

1. Ouvrir **Planificateur de tâches** (Task Scheduler)
2. Créer tâche de base
3. **Déclencheur** : Quotidien, 2h00
4. **Action** : Démarrer un programme
   - Programme : `powershell.exe`
   - Arguments : `-File "C:\chemin\vers\yukpomnang2\backend\scripts\recurring_trips_cron.ps1" -Action generate -DaysAhead 30`
5. **Conditions** : Démarrer la tâche même si l'ordinateur est sur batterie
6. **Paramètres** : Autoriser l'exécution à la demande

### Script PowerShell pour Task Scheduler

Créer `backend/scripts/recurring_trips_cron_scheduled.ps1` :

```powershell
# Script pour Task Scheduler Windows
$env:PATH = "C:\Users\VotreUser\.cargo\bin;$env:PATH"
$env:DATABASE_URL = "postgresql://..."
$env:RUST_LOG = "info"

cd "C:\chemin\vers\yukpomnang2\backend"
cargo run --bin recurring_trips_cron --release -- full
```

---

## ☁️ Configuration Services Cloud

### GitHub Actions (Recommandé pour Cloud)

Créer `.github/workflows/recurring_trips_cron.yml` :

```yaml
name: Recurring Trips Cron

on:
  schedule:
    # Tous les jours à 2h UTC
    - cron: '0 2 * * *'
  workflow_dispatch: # Permet exécution manuelle

jobs:
  generate-instances:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - name: Run generate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          cd backend
          cargo run --bin recurring_trips_cron --release -- generate 30
      
  activate-instances:
    runs-on: ubuntu-latest
    needs: generate-instances
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - name: Run activate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          cd backend
          cargo run --bin recurring_trips_cron --release -- activate 7
```

### Render.com / Railway / Heroku

Utiliser **Cron Jobs** ou **Scheduled Tasks** :

```bash
# Commande à exécuter
cd backend && cargo run --bin recurring_trips_cron --release -- full
```

**Fréquence** : Quotidien, 2h00 UTC

---

## 🔧 Variables d'Environnement Requises

```bash
DATABASE_URL=postgresql://user:pass@host:port/db
RUST_LOG=info  # Optionnel, pour logging
```

---

## 📊 Monitoring

### Logs

Les logs sont écrits dans :
- **Stdout/Stderr** : Si exécuté manuellement
- **Fichier log** : Si configuré dans crontab (ex: `/var/log/recurring_trips.log`)

### Vérification

```bash
# Vérifier instances générées
psql $DATABASE_URL -c "SELECT COUNT(*) FROM recurring_trip_instances WHERE status = 'pending';"

# Vérifier instances activées
psql $DATABASE_URL -c "SELECT COUNT(*) FROM recurring_trip_instances WHERE status = 'active';"

# Vérifier trajets récurrents actifs
psql $DATABASE_URL -c "SELECT COUNT(*) FROM covoiturages WHERE is_recurring = true AND parent_trip_id IS NULL;"
```

---

## 🎯 Recommandations

### Fréquence

- **Génération** : Quotidien (30 jours à l'avance)
- **Activation** : Quotidien (7 jours à l'avance)

### Heure d'Exécution

- **2h00-3h00** : Période de faible trafic
- **UTC** : Pour éviter problèmes fuseaux horaires

### Monitoring

- Surveiller logs pour erreurs
- Vérifier nombre instances générées/activées
- Alertes si échec répété

---

## 🐛 Dépannage

### Erreur : "DATABASE_URL must be set"

**Solution** : Vérifier que `.env` contient `DATABASE_URL` ou définir variable d'environnement

### Erreur : "Failed to connect to database"

**Solution** : Vérifier connexion réseau, credentials, firewall

### Aucune instance générée

**Vérifier** :
- Trajets récurrents existent (`is_recurring = true`)
- Trajets sont actifs (`is_active = true`)
- Date de fin pas dépassée (`recurrence_end_date >= TODAY`)

---

## ✅ Checklist Configuration

- [ ] Scripts créés (`recurring_trips_cron.sh` et `.ps1`)
- [ ] Binary compilé (`cargo build --bin recurring_trips_cron`)
- [ ] Crontab configuré (Linux/Mac) OU Task Scheduler (Windows)
- [ ] Variables d'environnement configurées
- [ ] Test manuel réussi
- [ ] Monitoring configuré
- [ ] Logs vérifiés

---

**Date** : 2025-01-29  
**Status** : ✅ Tâche cron prête à être configurée

