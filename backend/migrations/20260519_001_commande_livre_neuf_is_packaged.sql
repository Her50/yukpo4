-- 2026-05-19 — Marqueur de livre neuf déjà groupé dans un book_delivery_package.
--
-- Contexte : depuis le routage automatique Yukpo Librairie + auto-validation
-- (commit 9ade52132), les livres neufs achetés via commande mixte passent en
-- `commande_livres_neufs.statut_validation = 'valide'` mais ne sont JAMAIS
-- regroupés dans `book_delivery_packages` (cf. sim itér 13 : 922 livres
-- valides → 0 paquet créé). Cause : `build_all_pending_packages` lit
-- uniquement `troc_livres_scolaires`.
--
-- Cette colonne sert de drapeau anti-doublon pour la nouvelle branche de
-- constitution `build_neuf_packages_for_user`. Idempotent : si la colonne
-- existe déjà (re-run), pas d'erreur.
ALTER TABLE commande_livres_neufs
    ADD COLUMN IF NOT EXISTS is_packaged BOOLEAN NOT NULL DEFAULT false;

-- Index partiel pour la recherche des livres validés non-packagés (hot path
-- du worker / endpoint /packages/build-all).
CREATE INDEX IF NOT EXISTS idx_commande_livres_neufs_pending_packaging
    ON commande_livres_neufs(commande_id)
    WHERE statut_validation = 'valide' AND is_packaged = false;
