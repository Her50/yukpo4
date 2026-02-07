# 📋 Explication : Variable LAUNCH_PHASE_START_DATE

## 🎯 Utilisation de LAUNCH_PHASE_START_DATE

### Fonction : `get_launch_phase_start_date()`

**Fichier** : `backend/src/services/launch_phase_service.rs`

```rust
pub fn get_launch_phase_start_date() -> DateTime<Utc> {
    if let Ok(date_str) = env::var("LAUNCH_PHASE_START_DATE") {
        if let Ok(date) = DateTime::parse_from_rfc3339(&date_str) {
            return date.with_timezone(&Utc);
        }
    }
    // Par défaut: date actuelle (démarrage de la phase de lancement)
    Utc::now()
}
```

### 📝 Comportement

1. **Si la variable est définie** :
   - Lit la variable d'environnement `LAUNCH_PHASE_START_DATE`
   - Parse la date au format RFC3339 (ex: `"2026-02-06T00:00:00Z"`)
   - Retourne cette date comme date de début de la phase de lancement

2. **Si la variable n'est pas définie ou invalide** :
   - Utilise la date actuelle (`Utc::now()`) comme date de début
   - Cela signifie que la phase de lancement démarre **au moment où le backend démarre**

### 🔄 Calcul de la date de fin

```rust
pub fn get_launch_phase_end_date() -> DateTime<Utc> {
    let start = get_launch_phase_start_date();
    start + chrono::Duration::days(LAUNCH_PHASE_DURATION_DAYS) // 90 jours
}
```

La date de fin est **toujours** : `date_debut + 90 jours`

### ⚙️ Configuration dans AWS

#### Option 1 : Variable d'environnement ECS Task Definition

```json
{
  "environment": [
    {
      "name": "LAUNCH_PHASE_START_DATE",
      "value": "2026-02-06T00:00:00Z"
    }
  ]
}
```

#### Option 2 : AWS SSM Parameter Store

```bash
aws ssm put-parameter \
  --name /yukpomnang/production/LAUNCH_PHASE_START_DATE \
  --value "2026-02-06T00:00:00Z" \
  --type String \
  --region us-east-1
```

Puis dans la Task Definition, référencer :
```json
{
  "secrets": [
    {
      "name": "LAUNCH_PHASE_START_DATE",
      "valueFrom": "/yukpomnang/production/LAUNCH_PHASE_START_DATE"
    }
  ]
}
```

### 📊 Exemple d'utilisation

**Scénario 1 : Variable définie**
```bash
export LAUNCH_PHASE_START_DATE="2026-02-06T00:00:00Z"
```
- Début : 2026-02-06 00:00:00 UTC
- Fin : 2026-05-06 00:00:00 UTC (90 jours après)

**Scénario 2 : Variable non définie**
- Début : Date actuelle (ex: 2026-02-06 14:30:00 UTC)
- Fin : Date actuelle + 90 jours (ex: 2026-05-06 14:30:00 UTC)

### ⚠️ Important

1. **La variable est lue au démarrage du backend** : Si vous changez la variable, il faut redémarrer le backend pour que le changement soit pris en compte.

2. **La date de fin est calculée dynamiquement** : Chaque fois que `get_launch_phase_end_date()` est appelée, elle recalcule la date de fin basée sur la date de début.

3. **La table `launch_phase_config` dans la DB** : Cette table stocke aussi la configuration, mais le service Rust utilise **prioritairement** la variable d'environnement. La table DB sert de backup/configuration alternative.

### 🔧 Modification de la date de fin

Pour modifier la date de fin **sans redémarrer le backend**, vous pouvez directement modifier la table :

```sql
UPDATE launch_phase_config 
SET end_date = NOW() + INTERVAL '90 days',
    updated_at = NOW()
WHERE is_active = TRUE;
```

Mais attention : Le service Rust utilise la variable d'environnement en priorité, donc cette modification ne sera effective que si la variable n'est pas définie.

---

**Recommandation** : Utiliser la variable d'environnement pour un contrôle précis, ou laisser vide pour démarrer automatiquement à la date actuelle.

