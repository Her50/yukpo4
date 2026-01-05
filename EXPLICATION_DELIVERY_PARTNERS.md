# Explication : Pourquoi `delivery_partners` ?

## Question
Pourquoi le partenaire est associé à "delivery" ? C'est confus car tous les partenaires ne sont pas des services de livraison.

## Réponse

### Historique et Architecture

La table `delivery_partners` a été créée **initialement** pour gérer les partenaires de livraison (coursiers, transporteurs, etc.). Cependant, elle a été **étendue** pour devenir une table **générique** qui gère **TOUS les types de partenaires commerciaux** de la plateforme Yukpomnang.

### Pourquoi cette approche ?

1. **Centralisation des données communes** :
   - Tous les partenaires ont des informations similaires : nom, contact, localisation, statut
   - Évite la duplication de code et de schémas
   - Facilite la maintenance

2. **Évolution naturelle** :
   - Au départ : uniquement partenaires de livraison
   - Extension : pharmacies, hôpitaux, laboratoires, agences de voyage, etc.
   - Le nom "delivery_partners" est resté pour des raisons de compatibilité

3. **Avantages** :
   - Un seul endpoint pour rechercher tous les partenaires (`/api/partners/search`)
   - Gestion unifiée des statuts (actif/inactif)
   - Localisation centralisée (GPS, adresse, ville, pays)
   - Relation simple avec `users` via `user_id`

### Structure de la table

```sql
CREATE TABLE delivery_partners (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    partner_type delivery_partner_type NOT NULL, -- 'pharmacie', 'hopital', 'laboratoire', etc.
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) NOT NULL,
    location_latitude DOUBLE PRECISION,
    location_longitude DOUBLE PRECISION,
    is_active BOOLEAN DEFAULT TRUE,
    user_id INTEGER REFERENCES users(id), -- ✅ NOUVEAU: Lien avec le compte utilisateur
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Types de partenaires supportés

- `livraison` : Coursiers, transporteurs
- `pharmacie` : Pharmacies
- `hopital` : Hôpitaux, cliniques
- `laboratoire` : Laboratoires d'analyses
- `agence de voyage` : Agences de voyage (tickets bus)
- `demenagement` : Services de déménagement
- `transport` : Services de transport
- `assureur` : Assureurs
- `supermarche` : Supermarchés
- `telecom` : Opérateurs télécom

### Relation avec `users`

Depuis la Phase 6, chaque partenaire est lié à un compte utilisateur via `user_id` :

- Un utilisateur avec `role = 'partenaire'` peut avoir un enregistrement dans `delivery_partners`
- Lors de l'inscription partenaire, l'utilisateur est créé avec `partner_type` et `partner_status = 'pending'`
- Après validation admin, l'entrée dans `delivery_partners` est créée automatiquement avec `user_id`

### Conclusion

Le nom "delivery_partners" est un **legacy** qui ne reflète plus uniquement les services de livraison. C'est maintenant une table **générique** pour tous les partenaires commerciaux. Un renommage en `partners` serait plus approprié, mais nécessiterait une migration importante.

