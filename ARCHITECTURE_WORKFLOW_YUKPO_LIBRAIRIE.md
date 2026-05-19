# Architecture — Workflow Yukpo Librairie + Cascade Rupture/Refus

**Date** : 2026-05-19
**Auteur** : Spec validée user (5 réponses + scénarios terrain)
**Cible** : Sprint backend + frontend pour absorber le scale rentrée scolaire sans bottleneck humain

---

## 1. Vue d'ensemble

```
                          ┌─────────────────────────────┐
                          │  PARENT crée commande mixte │
                          │  (livres neufs + occasion)  │
                          └──────────────┬──────────────┘
                                         │ POST /commandes
                                         ▼
                          ┌─────────────────────────────┐
                          │  statut = edition           │
                          └──────────────┬──────────────┘
                                         │ POST /valider-budget
                                         ▼
                          ┌─────────────────────────────┐
                          │  statut = validation_budget │
                          │  transactions_agregees      │
                          │  statut = en_attente        │
                          │  (paiement à la livraison)  │
                          └──────────────┬──────────────┘
                                         │ POST /broadcast
                                         ▼
                          ┌─────────────────────────────┐
                          │  statut=envoyee_super_lib   │
                          │  Routage prioritaire vers   │
                          │  Yukpo Librairie            │
                          └──────────────┬──────────────┘
                                         │ AUTO-VALIDATION (worker async, ~5 min)
                                         ▼
                          ┌─────────────────────────────┐
                          │  validee_complete           │
                          │  Tous les livres_neufs en   │
                          │  statut = valide            │
                          │  Yukpo Lib doit s'aligner   │
                          │  sur prix figés dans code   │
                          └──────────────┬──────────────┘
                                         │ Génération wholesale-order agrégé
                                         ▼
                          ┌─────────────────────────────┐
                          │  Dashboard Yukpo Lib :      │
                          │  bons de commande           │
                          │  grossistes (téléphone)     │
                          └──────────────┬──────────────┘
                                         │ Retour grossiste (manuel)
                              ┌──────────┴──────────┐
                              │                     │
                              ▼                     ▼
                       ┌─────────────┐     ┌─────────────────────┐
                       │ Stock OK    │     │ Rupture grossiste   │
                       └──────┬──────┘     └──────────┬──────────┘
                              │                       │ POST /super-librairie/marquer-rupture-articles
                              ▼                       ▼
                  ┌────────────────────┐ ┌────────────────────────────┐
                  │ Préparation paquet │ │ Articles libérés vers      │
                  │ statut=en_prep     │ │ libraires_proches (zone)   │
                  └─────────┬──────────┘ │ statut=libere_libraires    │
                            │            │ Délai T=48h                │
                            │            └──────────┬─────────────────┘
                            │                       │
                            │            ┌──────────┴─────────────┐
                            │            │                        │
                            │            ▼                        ▼
                            │ ┌────────────────┐    ┌─────────────────────┐
                            │ │ Libraire X     │    │ Délai expire (48h)  │
                            │ │ POST /valider  │    │ → annule_rupture    │
                            │ │ → statut valide│    │ → notif parent      │
                            │ └────────┬───────┘    │ → remboursement     │
                            │          │            │   (si applicable)   │
                            │          │            └─────────────────────┘
                            └──────────┤
                                       │ Coursier assemble paquet
                                       ▼
                          ┌─────────────────────────────┐
                          │  Cycle livraison            │
                          │  constitue → en_route       │
                          │  Collecte livres occasion   │
                          │  chez les vendeurs          │
                          └──────────────┬──────────────┘
                                         │
                              ┌──────────┴──────────┐
                              │                     │
                              ▼                     ▼
                       ┌─────────────┐     ┌─────────────────────┐
                       │ Coursier OK │     │ Coursier refuse     │
                       └──────┬──────┘     │ (livre trop dégradé)│
                              │            │ POST /coursier/     │
                              │            │   refuse-article    │
                              │            └──────────┬──────────┘
                              │                       │
                              │                       ▼
                              │            ┌─────────────────────┐
                              │            │ Article retiré      │
                              │            │ Cascade : libère    │
                              │            │ vers libraires_proc │
                              │            │ OU annulation       │
                              │            │ Notif parent        │
                              │            └─────────────────────┘
                              │
                              ▼
                          ┌─────────────────────────────┐
                          │  Livraison chez parent      │
                          │  Coursier présente paquet   │
                          └──────────────┬──────────────┘
                                         │
                              ┌──────────┴──────────┐
                              │                     │
                              ▼                     ▼
                       ┌─────────────┐     ┌─────────────────────┐
                       │ Parent      │     │ Parent refuse       │
                       │ accepte tout│     │ certains articles   │
                       └──────┬──────┘     │ POST /livraison/    │
                              │            │   refuser-article   │
                              │            └──────────┬──────────┘
                              │                       │
                              │                       ▼
                              │            ┌─────────────────────┐
                              │            │ Article retourné    │
                              │            │ Ajustement facture  │
                              │            │ Yukpo Lib reprend   │
                              │            │ stock (revente future)│
                              │            └─────────────────────┘
                              │
                              ▼
                          ┌─────────────────────────────┐
                          │ Paiement à la livraison     │
                          │ (cash, MoMo manuel)         │
                          │ statut commande = livree    │
                          │ transactions_agregees       │
                          │ statut = succes             │
                          │ Bonus parrainage déclenché  │
                          │ si ≥ 10 000 XAF             │
                          └─────────────────────────────┘
```

---

## 2. Acteurs et rôles

| Acteur | Rôle | Action principale |
|---|---|---|
| **Parent** | Client final | Crée commande, valide budget, paye à la livraison, refuse articles si défaut |
| **Yukpo Librairie** | Coordinateur central | Auto-validation cmds, génère bons grossiste, libère articles en rupture |
| **Grossiste** (manuel) | Fournisseur en gros | Confirme dispo / signale rupture par téléphone à Yukpo Lib |
| **Libraire de zone** | Fallback local | Valide articles libérés par Yukpo Lib s'il a le stock |
| **Coursier** | Logistique | Collecte (occasion) + livraison ; peut refuser livre dégradé à la collecte |
| **Admin Yukpo** | Override | Annulation manuelle exceptionnelle |

---

## 3. Auto-validation Yukpo Librairie

### Critères (validés user)

- **Pas de seuil de prix** : les prix entrée/standard/premium des accessoires sont **figés dans le code** (voir `GammeSelector.tsx` et `librairie_prix_bornes_service.rs`). Le libraire est censé s'aligner. → Tous les articles passent en auto-validation.
- **Toutes les commandes en `envoyee_super_librairie`** sont éligibles à l'auto-validation.
- **Exclusions** : aucune par défaut. Plus tard, possibilité d'exclure si Yukpo Lib le souhaite (flag commande `requires_manual_review`).

### Worker async

**Fichier** : `backend/src/workers/yukpo_lib_auto_validator.rs` (nouveau)

**Cron** : toutes les **5 min** (configurable via `YUKPO_LIB_AUTO_VAL_INTERVAL_S`).

**Logique** :
```rust
async fn run_auto_validator(pool: &PgPool) -> Result<()> {
    // 1. SELECT commandes en envoyee_super_librairie depuis > 1 min
    //    (laisse le temps au broadcast de finir proprement)
    let commandes = sqlx::query!(
        "SELECT id FROM commandes_mixtes
         WHERE statut = 'envoyee_super_librairie'
           AND created_at < NOW() - INTERVAL '1 minute'
         LIMIT 200"  // batch
    ).fetch_all(pool).await?;
    
    // 2. Pour chaque commande, appeler la logique de valider_livres_commande
    //    en se faisant passer pour la super-librairie
    for cmd in commandes {
        valider_tous_livres_neufs_via_super_lib(pool, cmd.id).await?;
    }
    
    Ok(())
}
```

→ Yukpo Librairie n'a **plus aucune action manuelle** pour la validation initiale. Elle se concentre sur le travail à valeur ajoutée : commande grossiste, gestion ruptures, supervision.

---

## 4. Coordination grossiste (mode hybride)

### Phase 1 : MANUEL téléphone (prioritaire — MVP)

**UI Dashboard Yukpo Librairie** :

```
┌─────────────────────────────────────────────────────────────┐
│  Bon de commande grossiste — 19/05/2026                    │
│                                                              │
│  Grossiste : [▼ Editions Camerounaises]                     │
│  Filtrer par classe : [▼ 6ème]   Par matière : [▼ Toutes]   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Article                  │ Qté │ Prix unit │ Total  │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Maths 6ème (Hachette)    │  47 │  3 500    │ 164 500│   │
│  │ Français 6ème (Bordas)   │  32 │  4 200    │ 134 400│   │
│  │ SVT 6ème (Belin)         │  18 │  3 200    │  57 600│   │
│  │ ...                      │     │           │        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  📞 Appeler grossiste : [+237 6XX XX XX XX] [📋 Copier list]│
│  💬 Envoyer WhatsApp : [Envoyer la liste]                   │
│  📧 Envoyer email : [Brouillon prêt]                        │
│                                                              │
│  Après appel — marquage retour :                            │
│  [✓ Tout dispo]   [⚠ Ruptures partielles]   [✗ Tout indispo]│
└─────────────────────────────────────────────────────────────┘
```

**Endpoint backend** : `GET /api/librairie-network/super-librairie/wholesale-order` (existant — agrège tous les `commande_livres_neufs` en statut `valide` cross-commandes).

**Améliorations à coder** :
- Filtre par `grossiste_partenaire_id`
- Bouton "Envoyer WhatsApp" → ouvre `wa.me/?text=...` avec la liste formatée
- Bouton "Copier liste" → presse-papier
- Tableau exportable CSV

### Phase 2 : Intégration B2B (plus tard)

**Pré-requis** : grossiste accepte un compte plateforme + API.

**Endpoints à prévoir** :
- `POST /grossiste/{id}/wholesale-order/submit` — envoi automatique du bon
- `POST /grossiste-callback/disponibilite` — webhook retour grossiste avec `[{article_id, dispo_qte}]`
- Worker `grossiste_callback_handler` qui ingère et déclenche cascade rupture si besoin

### Multi-grossiste

**Table `grossistes`** (nouvelle ou existante à vérifier) :
```sql
CREATE TABLE grossistes (
  id UUID PRIMARY KEY,
  nom TEXT NOT NULL,
  ville TEXT,
  telephone TEXT,
  email TEXT,
  whatsapp TEXT,
  specialites TEXT[],     -- ['secondaire', 'fournitures', 'primaire']
  mode_integration TEXT,  -- 'manuel' | 'api'
  is_active BOOLEAN
);
```

**Logique d'attribution** : pour chaque article du wholesale-order, Yukpo Lib peut choisir manuellement (dropdown) **OU** auto-suggérer le grossiste optimal (par spécialité + zone).

---

## 5. Cascade rupture/refus — 3 sources

### Source A : Grossiste signale rupture

**Endpoint** : `POST /api/librairie-network/super-librairie/marquer-rupture-articles`

**Body** :
```json
{
  "ruptures": [
    {
      "commande_id": "uuid",
      "livre_neuf_id": "uuid",
      "motif": "rupture_grossiste",
      "grossiste_id": "uuid (optionnel)"
    },
    ...
  ]
}
```

**Logique** :
1. Pour chaque rupture :
   - UPDATE `commande_livres_neufs` SET `statut_validation = 'rupture_grossiste'`
   - INSERT dans `commande_validations` pour CHAQUE libraire_proche (rayon 20 km de la commande GPS) :
     - statut = 'en_cours'
     - articles_libere = [livre_neuf_id]
     - timestamp_libere = NOW()
     - expire_at = NOW() + INTERVAL '48 hours'
   - Notif push aux libraires éligibles : "Article X disponible à valider — 48h"
2. UPDATE `commandes_mixtes.statut = 'envoyee_librairies'` si tous les articles non-valides sont libérés (commande "en partie libérée")

### Source B : Coursier refuse à la collecte (troc/occasion)

**Endpoint** : `POST /api/livraison/coursier-refuse-article`

**Body** :
```json
{
  "package_id": "uuid",
  "livre_occasion_id": "uuid",        // OU livre_neuf_id pour neuf
  "motif": "trop_degrade",             // ou "introuvable", "vendeur_absent"
  "photo_constatation": "base64..."    // preuve (optionnel)
}
```

**Logique** :
1. UPDATE `commande_livres_occasion.statut = 'refuse_coursier'`
2. Pour ce livre, 2 sous-cas :
   - **Si c'est un livre_occasion en mode troc** : annuler la chaîne troc. Le parent qui devait recevoir ce livre voit son article remplacé par achat neuf (auto-suggéré) ou annulé.
   - **Si c'est un livre_occasion en mode vente** : libérer vers le réseau d'occasion (autres parents vendeurs en stock). Si aucun → annulation + ajustement total commande.
3. Notif parent : "Le livre X n'a pas pu être collecté (trop dégradé). Voici tes options : [Acheter neuf à X XAF] [Annuler l'article]."

### Source C : Parent refuse à la livraison

**Endpoint** : `POST /api/livraison/parent-refuse-article`

**Body** :
```json
{
  "package_id": "uuid",
  "commande_livre_neuf_id": "uuid",   // OU commande_livre_occasion_id
  "motif": "mauvaise_edition",         // ou "endommage", "ne_correspond_pas"
  "photo_constatation": "base64..."
}
```

**Logique** :
1. UPDATE l'article : statut = `refuse_parent`
2. Coursier reprend l'article (le marque retour dans son interface)
3. Ajustement facture : montant à payer diminue du prix de l'article refusé
4. Yukpo Librairie reçoit l'article en retour → entrée stock (revente future)
5. Notif parent : "Article retourné. Nouveau total : X XAF."

### Workflow commun aux 3 sources

Tous les 3 partagent :
- Notification au parent
- Mise à jour timeline commande (statut + raison)
- Si commande **avant livraison** → pas de remboursement (paiement à la livraison)
- Si commande **livrée puis refus partiel** → ajustement facture sur place (coursier modifie le total dans son app)

---

## 6. Remboursement automatique

### Cas A : Annulation AVANT livraison (rupture grossiste 48h expirée OU coursier refuse à la collecte)

- `transactions_agregees.statut` reste `en_attente` (jamais débité)
- Coté commande : article passe en `annule_rupture` ou `annule_coursier`
- **Pas de remboursement nécessaire** (rien à rembourser)
- Si le parent avait engagé un **crédit bourse** (troc), il est **restauré** sur le wallet (montant des articles annulés)

### Cas B : Annulation APRÈS livraison (refus parent à la réception)

- Coursier ajuste le montant collecté en cash/MoMo
- `transactions_agregees.statut = 'succes'` avec `montant_total` réduit
- Pas de remboursement (le parent n'a payé que les articles acceptés)

### Cas C : Crédit bourse / bonus parrainage

- Wallet = `wallet_credit_bourse` (troc) + bonus parrainage (500 XAF par filleul actif)
- Si la commande utilisait le crédit bourse et qu'un article est annulé :
  - Quote-part crédit affecté à l'article annulé → **re-crédité** au wallet
  - Trigger : `UPDATE users SET wallet_credit_bourse = wallet_credit_bourse + montant_a_rembourser WHERE id = commande.user_id`

---

## 7. Notifications client (timeline)

### Vue parent : `/mes-commandes/{id}` ou `/suivi/{id}`

```
┌────────────────────────────────────────────────────────────┐
│ Commande #CMD-2026-04531                                   │
│ 12 manuels + 8 cahiers · 47 850 XAF                        │
│                                                             │
│ 🟢 Commande créée                          19/05 09:15     │
│ 🟢 Budget validé                            19/05 09:16    │
│ 🟢 Validée par Yukpo Librairie              19/05 09:21    │
│ 🟡 En attente du grossiste                  19/05 14:00    │
│ ⚠ Article rupture grossiste — libéré vers   20/05 10:30    │
│   les libraires de Akwa-Douala (48h)                       │
│     • SVT 6ème (Belin)                                     │
│ 🟢 Article récupéré chez Libraire Eyene     21/05 14:00    │
│ 🟢 Paquet en préparation                    21/05 16:30    │
│ 🟢 Coursier en route                        22/05 08:00    │
│ 🟢 Livré et payé (45 300 XAF)               22/05 11:45    │
│                                                             │
│ ✅ Article SVT 6ème : -2 550 XAF (refusé par parent)       │
│ ✅ Bonus parrainage : +500 XAF crédité (15 000 ≥ seuil)    │
└────────────────────────────────────────────────────────────┘
```

### Canaux de notification

- **Push notif** in-app (existant — voir `send_notification` dans backend)
- **WhatsApp** (intégration future)
- **SMS** seulement pour les évènements critiques (rupture, livraison)

---

## 8. Endpoints à coder (résumé)

### 🔴 Sprint backend 1 (auto-validation + rupture grossiste)

| Endpoint | Description |
|---|---|
| Worker async `yukpo_lib_auto_validator` | Cron 5 min — auto-validation commandes en `envoyee_super_librairie` |
| `POST /super-librairie/marquer-rupture-articles` | Yukpo Lib marque articles rupture grossiste (batch) |
| `POST /super-librairie/liberer-articles` | Libération vers libraires_proches (par article, pas commande entière) |
| Worker `expirer-libraires-proches` | Cron 1h — articles libérés > 48h sans preneur → annule_rupture + notif |

### 🟡 Sprint backend 2 (refus terrain)

| Endpoint | Description |
|---|---|
| `POST /livraison/coursier-refuse-article` | Coursier refuse livre trop dégradé à la collecte |
| `POST /livraison/parent-refuse-article` | Parent refuse article à la livraison |
| `PATCH /livraison/ajuster-facture` | Coursier ajuste total payé après refus parent |

### 🟢 Sprint backend 3 (B2B grossiste — plus tard)

| Endpoint | Description |
|---|---|
| `POST /grossiste/{id}/wholesale-order/submit` | Envoi auto bon de commande |
| `POST /grossiste-callback/disponibilite` | Webhook retour grossiste |

### 📋 Nouvelles colonnes / statuts

**`commande_livres_neufs.statut_validation`** ajouter :
- `rupture_grossiste`
- `libere_libraires` (en attente preneur 48h)
- `annule_rupture`
- `refuse_coursier`
- `refuse_parent`

**`commande_livres_occasion.statut`** ajouter :
- `refuse_coursier`
- `refuse_parent`

**`commandes_mixtes.statut`** : aucun nouveau (les existants couvrent : `envoyee_librairies`, `validee_complete`, `validee_partielle`, `en_preparation`, `en_livraison`, `livree`, `annulee`).

**Nouvelle table `commande_validations`** : ajouter colonnes :
- `articles_libere UUID[]` (les `commande_livres_neufs.id` libérés à cette librairie)
- `timestamp_libere TIMESTAMPTZ`
- `expire_at TIMESTAMPTZ` (48h après timestamp_libere)

---

## 9. Migration de schéma SQL

```sql
-- Migration 20260520_001_workflow_yukpo_lib.sql

-- Étendre statut_validation pour commande_livres_neufs
ALTER TYPE livre_validation_statut ADD VALUE IF NOT EXISTS 'rupture_grossiste';
ALTER TYPE livre_validation_statut ADD VALUE IF NOT EXISTS 'libere_libraires';
ALTER TYPE livre_validation_statut ADD VALUE IF NOT EXISTS 'annule_rupture';
ALTER TYPE livre_validation_statut ADD VALUE IF NOT EXISTS 'refuse_coursier';
ALTER TYPE livre_validation_statut ADD VALUE IF NOT EXISTS 'refuse_parent';

-- Étendre statut pour commande_livres_occasion
ALTER TYPE livre_occasion_statut ADD VALUE IF NOT EXISTS 'refuse_coursier';
ALTER TYPE livre_occasion_statut ADD VALUE IF NOT EXISTS 'refuse_parent';

-- Articles libérés cross-commandes
ALTER TABLE commande_validations
  ADD COLUMN IF NOT EXISTS articles_libere UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS timestamp_libere TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expire_at TIMESTAMPTZ;

-- Table grossistes (si pas existante)
CREATE TABLE IF NOT EXISTS grossistes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  ville TEXT,
  telephone TEXT,
  whatsapp TEXT,
  email TEXT,
  specialites TEXT[] DEFAULT '{}',
  mode_integration TEXT NOT NULL DEFAULT 'manuel'
    CHECK (mode_integration IN ('manuel', 'api')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  api_endpoint TEXT,
  api_token_encrypted TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lien commande_livres_neufs → grossiste choisi (optionnel)
ALTER TABLE commande_livres_neufs
  ADD COLUMN IF NOT EXISTS grossiste_assigne_id UUID REFERENCES grossistes(id),
  ADD COLUMN IF NOT EXISTS commande_grossiste_envoyee_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS commande_grossiste_confirmee_at TIMESTAMPTZ;

-- Index sur expire_at pour worker rapide
CREATE INDEX IF NOT EXISTS idx_validations_expire_at
  ON commande_validations (expire_at)
  WHERE expire_at IS NOT NULL
    AND statut IN ('en_cours');
```

---

## 10. Plan de release

### MVP1 — Auto-validation + rupture grossiste manuelle (sprint 2-3 semaines)

**État au 2026-05-19 — backend livré, frontend à venir.**

- ✅ **Worker `yukpo_lib_auto_validator`** — commit `9ade52132` ([backend/src/services/yukpo_lib_auto_validator.rs](backend/src/services/yukpo_lib_auto_validator.rs)). En prod sur `yukpo-fly-backend` + staging `yukpo-bourse-sim` (2026-05-19). Cron 5 min, débloque les commandes `envoyee_super_librairie` après 60s.
- ✅ **Fix sqlx jsonb `livres_valides`** — commit `839183b7a` (cherry-pick prod `5cbd8d9f9`). `#[sqlx(json)]` sur `CommandeValidation`. Sans ce fix, le worker auto-val crashait au moment d'écrire les livres validés.
- ✅ **Fix `build-packages` pour livres neufs** — commit `a03722394` ([backend/src/services/troc_intelligent_service.rs:2865+](backend/src/services/troc_intelligent_service.rs#L2865) + migration [20260519_001](backend/migrations/20260519_001_commande_livre_neuf_is_packaged.sql)). Sans ce fix, le worker auto-val produisait `validee_complete` mais aucun paquet livraison n'était créé (sim itér 13 : 357 commandes validées → 0 paquet).
- ✅ **Endpoint `marquer-rupture-articles`** — `POST /api/librairie-network/super-librairie/marquer-rupture-articles` ([librairie_network_controller.rs](backend/src/controllers/librairie_network_controller.rs)). Body : `{ ruptures: [{commande_id, livre_neuf_id, motif?, grossiste_id?}] }`. Batch, idempotent (skip si déjà en rupture).
- ✅ **Endpoint `liberer-articles`** — `POST /api/librairie-network/super-librairie/liberer-articles`. Body : `{ livre_neuf_ids: [uuid], rayon_km?: 20, duree_heures?: 48 }`. Trouve libraires_proches via GPS de livraison, UPSERT `commande_validations` avec `articles_libere` + `expire_at`, push notif.
- ✅ **Worker `expirer-libraires-proches`** — cron 1h ([expirer_libraires_proches_worker.rs](backend/src/services/expirer_libraires_proches_worker.rs)). `libere_libraires` → `annule_rupture` pour articles non pris sous 48h. Push notif au parent. Désactivable via `YUKPO_LIB_EXPIRE_ENABLED=false`.
- ✅ **Migration SQL** — [20260519_002_workflow_yukpo_lib_mvp1.sql](backend/migrations/20260519_002_workflow_yukpo_lib_mvp1.sql). Enum extensions (`rupture_grossiste`, `libere_libraires`, `annule_rupture`, `refuse_coursier`, `refuse_parent`), colonnes `commande_validations.articles_libere/timestamp_libere/expire_at`, table `grossistes`, FK `commande_livres_neufs.grossiste_assigne_id`.
- ✅ **Frontend coursier** — page `/courier/bourse-livre` ([BookDeliveryFlowPage.tsx](frontend/src/pages/delivery/BookDeliveryFlowPage.tsx) + [bourseDeliveryApi.ts](frontend/src/services/bourseDeliveryApi.ts)). Coursier voit ses paquets assignés + bouton "Refuser livre dégradé" (cf. MVP2 §5 source B). Commit `f16fb5bfd` / prod `ebfa062c3`.
- ✅ **Endpoint `assign-courier`** — `POST /api/bourse-livre/v2/packages/{id}/assign-courier` ([bourse_livre_v2_controller.rs](backend/src/controllers/bourse_livre_v2_controller.rs)). Body : `{ coursier_user_id }`. Auth admin OU super-lib. Vérifie `couriers.status='active'`, UPDATE atomique (refuse si déjà assigné ou pas en `constitue`), push notif coursier + destinataire. Conflit 409 si déjà pris.
- ✅ **Guard `RequireCourierValidated` (frontend)** — [components/auth/RequireCourierValidated.tsx](frontend/src/components/auth/RequireCourierValidated.tsx). Vérifie `GET /api/courier/me`, redirige vers `/become-courier` si pas `is_courier && courier.status === 'active'`. Appliqué sur `/courier/my-deliveries` et `/courier/bourse-livre` ([App.tsx](frontend/src/App.tsx)).
- ✅ **Push notif candidature** — `approve_courier_application_endpoint` + `reject_courier_application_endpoint` ([delivery_routes.rs:3687-3820](backend/src/routes/delivery_routes.rs#L3687-L3820)) envoient déjà notif DB + push via `notification_service` + `push_notification_service`. Pas de modif nécessaire.
- ⏳ **Dashboard Yukpo Librairie (UI)** — *à coder MVP2* : bon grossiste + bouton WhatsApp/copie/email + marquage rupture batch + bouton "Libérer N articles" + assignation coursier (dropdown filtré par GPS via `GET /api/couriers/available?pickup_latitude=…&pickup_longitude=…`).
- ⏳ **Timeline commande côté parent** — *à coder MVP2* : `/mes-commandes/{id}` (cf. §7 wireframe).

### MVP2 — Refus terrain (sprint 1-2 semaines après MVP1)

- Endpoint `coursier-refuse-article`
- Endpoint `parent-refuse-article`
- Endpoint `ajuster-facture`
- UI coursier (boutons "Refuser" lors collecte / livraison)
- UI parent (timeline + remboursement crédit bourse auto)

### MVP3 — Intégration B2B grossiste (post-launch, après partenariats signés)

- Endpoint `wholesale-order/submit`
- Webhook `grossiste-callback/disponibilite`
- Worker ingestion réponses grossiste

---

## 11. Points d'attention pour le launch

1. **Charge worker auto-validation** : 5 min × 200 commandes/batch = 2 400 cmds/h. Suffit pour la rentrée (~10k cmds/jour).
2. **Délai 48h** : si beaucoup de ruptures, accumulation côté libraires_proches. Prévoir un dashboard "Articles libérés à valider" pour eux aussi.
3. **Téléphone grossiste** : si Yukpo Lib appelle 50 grossistes par jour, le dashboard doit minimiser le clic-clic (template WhatsApp pré-rempli, copier-coller liste).
4. **Photos constatation refus** : stockage à prévoir (S3 / Wasabi ?) avec retention 90 jours minimum pour audit.
5. **Remboursement crédit bourse** : tester le scénario où le parent avait 5 000 XAF de crédit bourse, l'a engagé sur commande, l'article correspondant est annulé → le crédit doit revenir.

---

## 12. Compatibilité avec le code existant

| Composant | État | Adaptation requise |
|---|---|---|
| `valider_livres_commande` | ✅ Existe | Pas besoin de modif, juste appelé par le worker auto |
| `broadcast_commande_librairies` | ✅ Existe | Logique super_librairie déjà active |
| `super_librairie_liberer_commande` | ✅ Existe | Libération commande-entière. Nouveau `liberer-articles` (2026-05-19) gère le cas article-par-article. |
| `wholesale-order` agrégat SQL | ✅ Existe | Ajouter filtre par grossiste + bouton actions UI |
| `finaliser_commande` | ⚠ TODO simulé paiement | Déplacer le trigger au moment "livraison confirmée" |
| `commande_validations` | ✅ Étendu 2026-05-19 | `articles_libere UUID[]`, `timestamp_libere`, `expire_at` ajoutés (migration 20260519_002). |
| `transactions_agregees` | ✅ Table existe | Statut `en_attente` reste compatible paiement à la livraison |
| `wallet_credit_bourse` | ✅ Existe | Ajouter trigger remboursement auto sur annulation |

→ **80 % du code est déjà en place**. Les 20 % manquants sont surtout le worker async + 5 endpoints + UI dashboard Yukpo Lib + UI timeline parent.

---

## 13. Impact budget — recalcul automatique

À CHAQUE annulation/refus (source A, B ou C), le montant total de la commande change. Le **recalcul doit être automatique et atomique** dans la même TX que l'annulation.

### Fonction centrale (à étendre depuis l'existant)

`calculer_totaux_commande` (`librairie_network_controller.rs:4146`) existe déjà et fait :
```sql
SELECT COALESCE(SUM(prix_final * quantite), 0)::DOUBLE PRECISION
  FROM commande_livres_neufs WHERE commande_id = $1
```

→ Aujourd'hui ça inclut **tous les livres**, y compris ceux en statut `rupture_grossiste`/`annule_rupture`/`refuse_*`. À adapter pour exclure les statuts annulés :

```sql
SELECT COALESCE(SUM(prix_final * quantite), 0)::DOUBLE PRECISION
  FROM commande_livres_neufs
  WHERE commande_id = $1
    AND statut_validation NOT IN (
      'rupture_grossiste', 'annule_rupture',
      'refuse_coursier', 'refuse_parent'
    )
```

Idem pour `commande_livres_occasion`.

### Flux de recalcul

Chaque endpoint d'annulation/refus (sources A, B, C) doit, dans la même TX :

```rust
// Pseudo-code
async fn annuler_article(tx, commande_id, livre_id, source) -> Result {
    // 1. Vérifier idempotence (anti-doublon)
    let current_statut: String = sqlx::query_scalar(
        "SELECT statut_validation FROM commande_livres_neufs WHERE id = $1"
    ).bind(livre_id).fetch_one(&mut **tx).await?;
    
    if est_statut_annule(&current_statut) {
        return Ok(AnnulationResult::AlreadyCancelled);  // 200 ok, idempotent
    }
    
    // 2. UPDATE statut article
    sqlx::query("UPDATE commande_livres_neufs SET statut_validation = $1 WHERE id = $2")
        .bind(statut_pour_source(source))
        .bind(livre_id)
        .execute(&mut **tx).await?;
    
    // 3. Recalcul totaux (exclut maintenant cet article)
    let nouveau_totaux = calculer_totaux_commande(tx, commande_id).await?;
    
    // 4. UPDATE commandes_mixtes.budget_total + commission_app + montant_net_libraires
    sqlx::query(r#"
        UPDATE commandes_mixtes SET
          budget_total = $1,
          commission_app = $2,
          montant_net_libraires = $3,
          updated_at = NOW()
        WHERE id = $4
    "#)
    .bind(nouveau_totaux.total_commande)
    .bind(nouveau_totaux.commission_app)
    .bind(nouveau_totaux.montant_net_libraires)
    .bind(commande_id)
    .execute(&mut **tx).await?;
    
    // 5. UPDATE transactions_agregees si elle existe (et statut = 'en_attente')
    sqlx::query(r#"
        UPDATE transactions_agregees SET
          montant_total = $1,
          commission_app = $2,
          montant_net = $3,
          updated_at = NOW()
        WHERE commande_id = $4
          AND statut = 'en_attente'   -- ne touche pas une transaction déjà 'succes'
    "#).bind(...).execute(&mut **tx).await?;
    
    // 6. Si transaction déjà 'succes' (paiement effectué) → créer un remboursement
    if transaction_already_succeeded(tx, commande_id).await? {
        crediter_remboursement_wallet(tx, parent_user_id, montant_article_annule).await?;
    }
    
    // 7. Notif parent (out-of-tx, dans un .await après commit)
    Ok(AnnulationResult::Done { nouveau_total: nouveau_totaux.total_commande })
}
```

### Impact côté UI parent

Timeline doit afficher le **nouveau total** à chaque annulation :

```
Commande #CMD-2026-04531
  Total initial : 47 850 XAF
  
  19/05 14:30 ⚠ SVT 6ème (rupture grossiste) : -3 200 XAF → 44 650 XAF
  20/05 11:00 ⚠ Maths CP (libéré, libraire prend) : neutre (récup)
  21/05 09:15 ✗ Article X annulé (48h expirés) : -2 100 XAF → 42 550 XAF
  22/05 11:45 ✗ Cahier Y refusé par parent : -800 XAF → 41 750 XAF
  
  💰 Total à payer (livraison) : 41 750 XAF
```

---

## 14. Anti-doublons d'annulation (existant + renforcement)

### Existant côté code (à NE PAS dupliquer)

| Mécanisme existant | Lieu | Protection |
|---|---|---|
| `SELECT … FOR UPDATE` sur la commande | `valider_livres_commande` ligne 3152 | Lock row pendant TX → 2 libraires concurrents = 1 gagne, l'autre 409 Conflict |
| `verrou_exclusif` dans `commande_validations` | Schema | Empêche 2 libraires de valider la même commande simultanément |
| `ON CONFLICT DO NOTHING` (INSERT broadcast) | Lignes 1186, 1355 | Pas de doublon de commande_validations |
| `cancel_book_on_site` retire le livre du JSON | `troc_intelligent_service.rs:2581+` | Idempotent par construction (2ème appel ne trouve pas le livre → credit=0) |
| `update_purchase_status` remboursement | `bourse_livre_v2_controller.rs:4860` | Vérifie le statut avant remboursement |

### Renforcement recommandé (à ajouter)

Pour les **nouveaux endpoints d'annulation** (sources A, B, C), ajouter explicitement :

```rust
// Pattern recommandé pour TOUT endpoint d'annulation
// (à ajouter en début de chaque handler)
let current_statut: String = sqlx::query_scalar(
    "SELECT statut_validation FROM commande_livres_neufs WHERE id = $1 FOR UPDATE"
).bind(livre_id).fetch_one(&mut *tx).await?;

const STATUTS_DEJA_ANNULES: &[&str] = &[
    "rupture_grossiste", "annule_rupture",
    "refuse_coursier", "refuse_parent",
];

if STATUTS_DEJA_ANNULES.contains(&current_statut.as_str()) {
    // Idempotent : on renvoie 200 OK avec un message clair
    return Ok(Json(json!({
        "success": true,
        "already_processed": true,
        "current_statut": current_statut,
        "message": "Cet article a déjà été annulé/refusé"
    })));
}
```

### Pourquoi pas un simple `ON CONFLICT` ?

Parce qu'une annulation a **plusieurs side-effects** (recalcul budget, remboursement, notif parent). On veut **bloquer la 2ème exécution** entièrement, pas juste l'INSERT principal. Le `SELECT … FOR UPDATE` + check `STATUTS_DEJA_ANNULES` est la bonne approche.

### Anti-doublon entre sources A/B/C

Scénario : grossiste signale rupture (A) → article passe en `rupture_grossiste`. Puis coursier essaie de marquer refus (B) sur le même article → check `STATUTS_DEJA_ANNULES` → 200 idempotent.

→ **Les 3 sources sont mutuellement exclusives par le check de statut**. Pas de race condition possible si le `FOR UPDATE` est respecté.

### Tests d'idempotence à inclure

Dans la sim ou en intégration :
1. Appeler `marquer-rupture-articles` 2x sur le même livre → 1ère = OK avec recalcul, 2ème = 200 `already_processed`
2. Source A puis source B sur même livre → 2ème = `already_processed`
3. Cancel `cancel_book_on_site` 2x sur même livre/paquet → wallet pas double-crédité (déjà OK par construction)

---

## 15. Estimations effort

| Tâche | Effort dev | Effort tests |
|---|---|---|
| Worker auto-validation | 1 jour | 0.5 jour |
| 3 endpoints rupture (grossiste / coursier / parent) | 2 jours | 1 jour |
| Migration SQL | 0.5 jour | 0.5 jour |
| UI Dashboard Yukpo Librairie (admin) | 3 jours | 1 jour |
| UI Timeline parent | 2 jours | 1 jour |
| UI Coursier (refus article) | 2 jours | 1 jour |
| Test e2e via sim étendue | 1 jour | 1 jour |
| **Total MVP1+2** | **~11.5 jours** | **~6 jours** |

→ **~3 semaines** avec 1 dev backend + 1 dev frontend + 0.5 QA.
