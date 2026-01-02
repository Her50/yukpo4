# ✅ Correction erreur 413 Payload Too Large

## Date : 2025-12-31

## Problème identifié

**Erreur** : `413 Payload Too Large` lors de la création de service depuis le mobile  
**Payload** : 2633.01 KB (environ 2.6 MB)  
**Route** : `/api/services/create`

## Cause racine

La route `/api/services/create` dans `router_yukpo.rs` **n'avait pas de `DefaultBodyLimit` configuré**, alors que :
- La route `/api/services/{service_id}/products` avait `DefaultBodyLimit::max(200_000_000)` (200 MB)
- La route `/services/create` dans `service_routes.rs` avait `DefaultBodyLimit::max(50_000_000)` (50 MB)

**Axum a une limite par défaut très petite** (quelques MB), donc les payloads avec images base64 étaient rejetés.

## Solution appliquée

✅ Ajout de `DefaultBodyLimit::max(200_000_000)` (200 MB) à la route `/api/services/create` dans `router_yukpo.rs`

```rust
.route("/api/services/create", 
    post(handle_creer_service)
        .layer(axum::extract::DefaultBodyLimit::max(200_000_000)) // ✅ 200 MB
)
```

## Vérifications

- ✅ Route `/api/services/create` : 200 MB (corrigée)
- ✅ Route `/api/services/{service_id}/products` : 200 MB (déjà configurée)
- ✅ Route `/services/create` : 50 MB (déjà configurée)
- ✅ Middleware `request_size_limit` : 200 MB (déjà configuré)

## Résultat attendu

- ✅ Les payloads jusqu'à 200 MB sont acceptés
- ✅ Les images base64 volumineuses peuvent être envoyées
- ✅ Plus d'erreur 413 pour les créations de service normales

## Note importante

Le payload de 2.6 MB devrait maintenant passer sans problème. Si l'erreur persiste, vérifier :
1. La configuration nginx/reverse proxy (client_max_body_size)
2. La configuration du serveur web (si derrière un proxy)
3. Les logs pour voir si c'est Axum ou un autre composant qui rejette


