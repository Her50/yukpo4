# Plan d'implémentation : Système de prix négociés

## 🎯 Objectif

Permettre au prestataire de négocier un prix personnalisé avec un client dans ChatModal, sans modifier le prix réel en base. Lorsque le client clique sur "Se faire livrer", le prix négocié est pris en compte.

## 📋 Architecture

### 1. Table `negotiated_prices`

```sql
CREATE TABLE negotiated_prices (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER, -- NULL si prix global pour le service
    merchant_user_id INTEGER NOT NULL REFERENCES users(id),
    client_user_id INTEGER NOT NULL REFERENCES users(id),
    original_price_cents BIGINT NOT NULL,
    negotiated_price_cents BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'expired'
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(conversation_id, service_id, product_index, client_user_id)
);
```

### 2. Backend

**Nouveau service** : `negotiated_price_service.rs`
- `create_negotiated_price()` : Créer une offre de prix négocié
- `get_negotiated_price()` : Récupérer le prix négocié actif
- `accept_negotiated_price()` : Accepter une offre
- `reject_negotiated_price()` : Rejeter une offre

**Modification** : `product_price_service.rs`
- Vérifier d'abord s'il y a un prix négocié actif pour cette conversation/service/produit
- Si oui, utiliser le prix négocié
- Sinon, utiliser le prix avec promotions

**Nouvelle route** : `POST /api/negotiated-prices`
- Créer une offre de prix négocié

**Nouvelle route** : `POST /api/negotiated-prices/{id}/accept`
- Accepter une offre

**Nouvelle route** : `POST /api/negotiated-prices/{id}/reject`
- Rejeter une offre

### 3. Frontend/Mobile

**ChatModal** :
- Bouton "Proposer un prix" pour le prestataire
- Modal pour saisir le prix négocié
- Affichage de l'offre en attente pour le client
- Boutons "Accepter" / "Rejeter" pour le client

**OrderDeliveryModal** :
- Vérifier s'il y a un prix négocié actif
- Afficher le prix négocié si disponible
- Utiliser le prix négocié dans le calcul du total

## ⚠️ Points importants

- Le prix négocié n'affecte pas le prix réel en base
- Le prix négocié est lié à une conversation spécifique
- Le prix négocié peut expirer (optionnel)
- Le prix négocié est prioritaire sur les promotions pour cette commande spécifique

