# ✅ Vérification : Commission non appliquée si produit rejeté

## 🔍 Problème identifié

La commission de 5% était appliquée même si le client refusait le produit.

## ✅ Solution implémentée

### Modification dans `backend/src/routes/delivery_routes.rs`

Dans la fonction `update_delivery_status`, lorsque le statut passe à `Delivered` :

```rust
crate::models::delivery_model::DeliveryStatus::Delivered => {
    // Livraison validée -> Reverser au prestataire
    // ✅ IMPORTANT : Vérifier si le produit a été rejeté avant de reverser
    if old_status != crate::models::delivery_model::DeliveryStatus::Delivered {
        // Vérifier dans le payload si le produit a été rejeté
        let product_rejected = payload.payload.as_ref()
            .and_then(|p| p.get("product_rejected"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        if product_rejected {
            // ✅ Produit rejeté : Pas de commission, pas de reversement
            // Rembourser le client via handle_product_rejection
            if let Err(e) = payment_service.handle_product_rejection(delivery_id, user.id).await {
                log::error!("Erreur gestion rejet produit pour livraison {}: {:?}", delivery_id, e);
            }
        } else {
            // Produit accepté : Reverser au prestataire avec commission
            let merchant_user_id = summary.creator_id;
            if let Err(e) = payment_service.payout_merchant(delivery_id, merchant_user_id).await {
                log::error!("Erreur reversement prestataire pour livraison {}: {:?}", delivery_id, e);
            }
        }
    }
}
```

## 📋 Logique

1. **Produit accepté** (`product_rejected = false` ou absent) :
   - ✅ Appel de `payout_merchant()` → Commission 5% appliquée
   - ✅ Reversement au prestataire = Prix produit - Commission

2. **Produit rejeté** (`product_rejected = true`) :
   - ✅ Appel de `handle_product_rejection()` → **PAS de commission**
   - ✅ Remboursement complet du prix produit au client
   - ✅ Gestion du coût de livraison selon `billing_mode`

## ⚠️ Important

Le frontend/mobile doit envoyer `product_rejected: true` dans le payload lors du changement de statut à "Delivered" si le client refuse le produit.

