# Diagnostic de Connexion CloudShell

## Problème : La commande de test ne répond pas

Si `psql "$DATABASE_URL" -c "SELECT version();"` ne répond rien, essayez ces commandes de diagnostic :

### 1. Test de connexion avec timeout

```bash
timeout 10 psql "$DATABASE_URL" -c "SELECT 1;" 2>&1
```

### 2. Test de connexion avec affichage des erreurs

```bash
psql "$DATABASE_URL" -c "SELECT 1;" -v ON_ERROR_STOP=1 2>&1
```

### 3. Vérifier si la base de données est accessible (ping réseau)

```bash
# Extraire le hostname
echo $DATABASE_URL | grep -oP '@\K[^:]+'
# Puis tester la connectivité
nc -zv yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com 5432
```

### 4. Test avec psql en mode interactif (pour voir les erreurs)

```bash
psql "$DATABASE_URL" << 'EOF'
\conninfo
SELECT version();
\q
EOF
```

### 5. Si la connexion échoue, vérifier les Security Groups

La base de données RDS doit autoriser les connexions depuis CloudShell. Vérifiez que :
- Le Security Group de RDS autorise le trafic depuis CloudShell
- CloudShell est dans le même VPC ou a accès au VPC

### 6. Alternative : Utiliser le script SQL directement même si le test échoue

Parfois le test échoue mais le script fonctionne quand même. Essayez directement :

```bash
psql "$DATABASE_URL" << 'EOFSQL'
CREATE TABLE IF NOT EXISTS user_saved_addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    address_type VARCHAR(20) NOT NULL CHECK (address_type IN ('pickup', 'dropoff', 'both')),
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location_data JSONB DEFAULT '{}'::jsonb,
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    instructions TEXT,
    building_number VARCHAR(50),
    floor VARCHAR(50),
    apartment VARCHAR(50),
    is_default_pickup BOOLEAN DEFAULT FALSE,
    is_default_dropoff BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, label)
);
EOFSQL
```

Si cette commande simple fonctionne, alors le script complet devrait aussi fonctionner.



