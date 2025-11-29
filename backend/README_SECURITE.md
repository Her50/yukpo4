# 🔒 Guide de Sécurité - Yukpomnang Backend

## Vue d'ensemble

Ce document résume toutes les améliorations de sécurité apportées à l'application Yukpomnang.

**Score de sécurité:** 8.5/10 ✅

---

## 📋 Documents Disponibles

1. **`ANALYSE_SECURITE.md`** - Analyse complète des vulnérabilités initiales
2. **`CORRECTIONS_SECURITE.md`** - Détails des 6 premières corrections critiques
3. **`AMELIORATIONS_SECURITE_COMPLETES.md`** - Toutes les améliorations (13 au total)

---

## ⚡ Démarrage Rapide

### Variables d'environnement minimales

```bash
# Obligatoire
JWT_SECRET=un_secret_tres_long_et_aleatoire_minimum_32_caracteres

# CORS (recommandé)
ALLOWED_ORIGINS=https://yukpomnang.com,https://app.yukpomnang.com

# OAuth (si utilisé)
GOOGLE_CLIENT_ID=votre_client_id
FACEBOOK_APP_ID=votre_app_id
FACEBOOK_APP_SECRET=votre_app_secret
```

### Test rapide

```bash
# 1. Vérifier que la compilation fonctionne
cargo build --release

# 2. Vérifier que JWT_SECRET est requis
unset JWT_SECRET
cargo run --release
# Devrait échouer avec "JWT_SECRET manquant"

# 3. Lancer les tests
cargo test
```

---

## 🛡️ Fonctionnalités de Sécurité

### ✅ Authentification
- JWT avec secret obligatoire
- Backdoors de développement désactivées en production
- OAuth validé (Google, Facebook)

### ✅ Protection contre les attaques
- Rate limiting: 100 req/min par IP
- Anti-brute-force: Blocage après 5 tentatives
- Protection CSRF
- Headers de sécurité (HSTS, X-Frame-Options, etc.)

### ✅ Validation
- Validation stricte des entrées
- Validation des mots de passe (complexité)
- Sanitization des données

### ✅ Confidentialité
- Logs sécurisés (emails/tokens masqués)
- Messages d'erreur génériques
- CORS configurable et sécurisé

---

## 📚 Modules de Sécurité

### Middlewares
- `auth.rs` - Authentification JWT
- `jwt.rs` - Validation JWT
- `rate_limit.rs` - Limitation de débit
- `anti_bruteforce.rs` - Protection brute-force
- `csrf.rs` - Protection CSRF
- `cors.rs` - Configuration CORS sécurisée
- `hide_headers.rs` - Headers de sécurité

### Utilitaires
- `validation.rs` - Validation des entrées
- `sanitize_logs.rs` - Nettoyage des logs
- `jwt_manager.rs` - Gestion JWT

---

## 🔧 Configuration

### CORS

Définir les origines autorisées dans `.env`:

```bash
ALLOWED_ORIGINS=https://yukpomnang.com,https://app.yukpomnang.com,https://staging.yukpomnang.com
```

**En développement**, localhost est automatiquement ajouté.

### Rate Limiting

Limites par défaut (configurables dans le code):
- **100 requêtes/minute** par IP
- Fenêtre de 60 secondes

### Anti-Brute-Force

Limites par défaut:
- **5 tentatives échouées** maximum
- Blocage de **15 minutes**
- Fenêtre de comptage: **5 minutes**

---

## 🧪 Tests

### Tests unitaires

```bash
cargo test utils::validation
cargo test utils::sanitize_logs
```

### Tests manuels

Voir `AMELIORATIONS_SECURITE_COMPLETES.md` section "Tests de Validation"

---

## 📞 Support

Pour toute question de sécurité:
1. Consulter les documents de sécurité
2. Vérifier les logs (`RUST_LOG=info`)
3. Tester avec les commandes de validation

---

## 🔄 Maintenance

### Mises à jour de sécurité recommandées

1. **Mensuel:** Vérifier `cargo audit`
2. **Trimestriel:** Rotation du `JWT_SECRET`
3. **Semestriel:** Audit de sécurité complet
4. **Annuel:** Tests de pénétration

### Vérifications régulières

- [ ] Redis est accessible (pour rate limiting)
- [ ] Les variables d'environnement sont correctes
- [ ] Les logs ne contiennent pas de données sensibles
- [ ] Les origines CORS sont à jour

---

**Dernière mise à jour:** 2025-01-27

