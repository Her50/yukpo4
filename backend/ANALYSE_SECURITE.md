# 🔒 Analyse de Sécurité Détaillée - Application Yukpomnang

**Date:** 2025-01-27  
**Version analysée:** Backend Rust/Axum  
**Niveau de risque global:** ⚠️ **ÉLEVÉ** (7/10)

---

## 📋 Résumé Exécutif

L'application Yukpomnang présente **plusieurs vulnérabilités critiques** qui permettent à un attaquant de :
- Bypasser complètement l'authentification
- Effectuer des attaques par brute-force sans limitation
- Accéder à des données sensibles
- Exploiter des tokens de développement en production
- Effectuer des attaques OAuth sans validation

**Recommandation immédiate:** Mise en production **NON RECOMMANDÉE** sans corrections urgentes.

---

## 🔴 Vulnérabilités Critiques (P0)

### 1. **Backdoor d'authentification - Tokens de développement en production**

**Fichier:** `backend/src/middlewares/auth.rs` (lignes 34-55), `backend/src/middlewares/jwt.rs` (lignes 34-56)

**Problème:**
```rust
// Mode développement : accepter les tokens de dev
if token.ends_with(".dev_signature") {
    // Accepte n'importe quel token se terminant par .dev_signature
    return Ok(AuthUser {
        user_id: payload["sub"].as_str().unwrap_or("dev-user-id").to_string(),
        role: payload["role"].as_str().unwrap_or("admin").to_string(),
    });
}

// Mode développement simplifié
if token == "dev_token_pinecone" {
    return Ok(AuthUser {
        user_id: "dev-user-1".to_string(),
        role: "admin".to_string(),
    });
}
```

**Impact:** 
- Un attaquant peut créer un token JWT factice avec `.dev_signature` et obtenir un accès admin
- Le token `dev_token_pinecone` donne un accès admin immédiat
- Aucune vérification de signature ou d'expiration

**Attaque possible:**
```bash
# Créer un token factice
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiYXV0aG9yaXR5IjoiUk9MRV9BRE1JTiJ9.fake.dev_signature"

# Utiliser dans une requête
curl -H "Authorization: Bearer fake.dev_signature" https://api.example.com/api/admin/users
```

**Solution:**
```rust
// SUPPRIMER complètement ces backdoors en production
#[cfg(not(debug_assertions))]
// Ne jamais accepter les tokens de dev en production
```

**Priorité:** 🔴 **CRITIQUE** - Corriger immédiatement

---

### 2. **JWT Secret avec fallback par défaut**

**Fichier:** `backend/src/middlewares/auth.rs` (ligne 58)

**Problème:**
```rust
let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev_secret".to_string());
```

**Impact:**
- Si `JWT_SECRET` n'est pas défini, utilisation d'un secret par défaut connu
- Un attaquant peut forger des tokens JWT valides
- Toutes les instances sans `JWT_SECRET` partagent le même secret

**Solution:**
```rust
let secret = std::env::var("JWT_SECRET")
    .map_err(|_| {
        log::error!("JWT_SECRET manquant - Arrêt du serveur");
        return (StatusCode::INTERNAL_SERVER_ERROR, "Configuration invalide");
    })?;
```

**Priorité:** 🔴 **CRITIQUE** - Corriger immédiatement

---

### 3. **Rate Limiting et Anti-Brute Force désactivés**

**Fichiers:** 
- `backend/src/middlewares/anti_bruteforce.rs` (lignes 6-10)
- `backend/src/middlewares/rate_limit.rs` (lignes 7-10)

**Problème:**
```rust
pub async fn anti_bruteforce(req: Request<Body>, next: Next) -> Result<Response, StatusCode> {
    // TODO: Track IP/username attempts, block if too many in short time
    // For now, just pass through
    Ok(next.run(req).await)
}

pub async fn rate_limit(req: Request<Body>, next: Next) -> Result<Response, StatusCode> {
    // TODO: Implement real rate limiting
    Ok(next.run(req).await)
}
```

**Impact:**
- Attaques par brute-force illimitées sur `/auth/login`
- Pas de limitation de débit sur les endpoints sensibles
- DDoS possible sur n'importe quelle route
- Énumération d'emails/identifiants possible

**Attaque possible:**
```bash
# Brute-force illimité
for password in $(cat wordlist.txt); do
  curl -X POST https://api.example.com/auth/login \
    -d '{"email":"victim@example.com","password":"'$password'"}'
done
```

**Solution:**
- Implémenter un rate limiting réel avec Redis
- Utiliser `tower-http::limit` ou `governor`
- Bloquer après 5 tentatives échouées pendant 15 minutes
- Limiter à 100 requêtes/minute par IP

**Priorité:** 🔴 **CRITIQUE** - Implémenter rapidement

---

### 4. **OAuth sans validation de signature**

**Fichier:** `backend/src/controllers/auth_controller.rs` (lignes 230-273)

**Problème:**
```rust
let user_res_url = match payload.provider.as_str() {
    "google" => format!("https://www.googleapis.com/oauth2/v3/tokeninfo?id_token={}", payload.token_id),
    "facebook" => format!("https://graph.facebook.com/me?fields=id,name,email&access_token={}", payload.token_id),
    // ...
};

let user_res = client.get(&user_res_url).send().await?;
let user_res = user_res.json::<serde_json::Value>().await?;

let email = user_res.get("email").and_then(|v| v.as_str());
// Aucune validation de signature JWT pour Google
// Aucune vérification que le token provient bien de Facebook
```

**Impact:**
- Un attaquant peut créer un faux token OAuth et l'envoyer
- Accès au compte de n'importe quel utilisateur
- Pas de vérification que le token est valide et signé par le provider

**Attaque possible:**
```bash
# Créer un faux token Google
curl -X POST https://api.example.com/auth/oauth \
  -d '{
    "provider": "google",
    "token_id": "fake_token_claiming_to_be_admin@example.com"
  }'
```

**Solution:**
- Pour Google: Utiliser `google-oauth1-rs` ou `google-oauth2-rs` pour valider la signature JWT
- Pour Facebook: Vérifier le `app_id` et la signature du token
- Valider l'expiration et l'audience du token

**Priorité:** 🔴 **CRITIQUE** - Corriger avant production

---

## 🟠 Vulnérabilités Majeures (P1)

### 5. **CORS trop permissif**

**Fichier:** `backend/src/middlewares/cors.rs` (lignes 10-64)

**Problème:**
- Liste de 50+ origines autorisées incluant des domaines de développement
- Wildcards et `null` acceptés
- `allow_credentials: true` avec des origines multiples

**Impact:**
- Risque de CSRF élevé
- Partage de cookies avec des domaines non autorisés
- Fuite de données via requêtes cross-origin

**Solution:**
- Limiter aux domaines de production uniquement
- Retirer `null` et les wildcards
- Utiliser une liste blanche stricte

**Priorité:** 🟠 **HAUTE** - Réduire la liste des origines

---

### 6. **Gestion des erreurs révélant des informations**

**Fichier:** Multiple fichiers

**Problème:**
- Messages d'erreur détaillés exposés à l'utilisateur
- Stack traces potentiellement exposées
- Erreurs SQL pouvant révéler la structure de la base

**Exemples:**
```rust
// auth_controller.rs
error!("[login_handler] Email introuvable: {}", payload.email);
return Err(AppError::Unauthorized("Email introuvable".into()));
```

**Impact:**
- Énumération d'emails/identifiants
- Fuite d'informations sur la structure interne
- Aide aux attaquants pour construire des attaques ciblées

**Solution:**
- Messages d'erreur génériques pour l'utilisateur
- Logs détaillés côté serveur uniquement
- Ne pas exposer de différences entre "email existe" et "mot de passe incorrect"

**Priorité:** 🟠 **HAUTE** - Uniformiser les messages d'erreur

---

### 7. **Validation d'entrées insuffisante**

**Fichiers:** Contrôleurs multiples

**Problème:**
- Pas de validation stricte des types de données
- Pas de limites de taille sur certains champs
- Upload de fichiers sans validation approfondie

**Impact:**
- Injection de données malformées
- Upload de fichiers malveillants
- Overflow de buffers potentiel

**Solution:**
- Utiliser `validator` ou `serde_valid` pour la validation
- Limiter strictement les tailles de fichiers
- Valider les types MIME réels (pas seulement les extensions)

**Priorité:** 🟠 **HAUTE** - Ajouter validation systématique

---

## 🟡 Vulnérabilités Modérées (P2)

### 8. **Pas de protection CSRF**

**Problème:**
- Pas de tokens CSRF pour les requêtes state-changing
- Protection CORS insuffisante (voir vulnérabilité #5)

**Impact:**
- Attaques CSRF possibles si l'utilisateur est authentifié
- Actions non autorisées via requêtes cross-site

**Solution:**
- Implémenter des tokens CSRF pour POST/PUT/DELETE
- Vérifier l'origine des requêtes

**Priorité:** 🟡 **MOYENNE**

---

### 9. **Mots de passe avec bcrypt mais pas de politique**

**Fichier:** `backend/src/controllers/auth_controller.rs` (ligne 127)

**Problème:**
```rust
let password_hash = hash(&payload.password, DEFAULT_COST)?;
```

**Impact:**
- Pas de validation de complexité du mot de passe
- Utilisateurs peuvent utiliser des mots de passe faibles
- `DEFAULT_COST` peut être insuffisant (vérifier que c'est 12+)

**Solution:**
- Valider la complexité (min 8 caractères, majuscules, chiffres)
- Augmenter le cost de bcrypt à 12 minimum
- Implémenter une vérification de force du mot de passe

**Priorité:** 🟡 **MOYENNE**

---

### 10. **Headers de sécurité manquants**

**Fichier:** `backend/src/middlewares/hide_headers.rs`

**Problème:**
- Seuls `Server` et `X-Powered-By` sont masqués
- Pas de `X-Content-Type-Options`
- Pas de `X-Frame-Options`
- Pas de `Strict-Transport-Security`
- Pas de `Content-Security-Policy`

**Solution:**
```rust
response.headers_mut().insert(
    "X-Content-Type-Options",
    HeaderValue::from_static("nosniff"),
);
response.headers_mut().insert(
    "X-Frame-Options",
    HeaderValue::from_static("DENY"),
);
response.headers_mut().insert(
    "Strict-Transport-Security",
    HeaderValue::from_static("max-age=31536000; includeSubDomains"),
);
```

**Priorité:** 🟡 **MOYENNE**

---

### 11. **Logs contenant des informations sensibles**

**Problème:**
- Emails loggés en clair
- Tokens potentiellement loggés
- Informations utilisateur dans les logs

**Impact:**
- Fuite d'informations si les logs sont exposés
- Non-conformité RGPD/CCPA

**Solution:**
- Masquer les emails dans les logs (garder seulement le hash)
- Ne jamais logger les tokens ou mots de passe
- Filtrer les données sensibles avant logging

**Priorité:** 🟡 **MOYENNE**

---

### 12. **Pas de rotation de secrets**

**Problème:**
- Pas de mécanisme de rotation des secrets JWT
- Secrets probablement statiques en production

**Impact:**
- Si un secret est compromis, tous les tokens sont compromis
- Pas de moyen de révoquer les tokens existants

**Solution:**
- Implémenter une rotation régulière des secrets
- Maintenir une blacklist de tokens révoqués (Redis)
- Utiliser des secrets différents par environnement

**Priorité:** 🟡 **MOYENNE**

---

## ✅ Points Positifs

1. **SQLx avec requêtes paramétrées** - Protection contre les injections SQL ✅
2. **Bcrypt pour les mots de passe** - Hashing sécurisé ✅
3. **Middleware d'authentification JWT** - Structure en place ✅
4. **Service de sécurité** - Framework présent (mais à activer) ✅
5. **Validation de base des fichiers** - Types MIME vérifiés (partiellement) ✅

---

## 📊 Score de Sécurité

| Catégorie | Score | Commentaire |
|-----------|-------|-------------|
| Authentification | 3/10 | Backdoors critiques |
| Autorisation | 5/10 | JWT en place mais vulnérable |
| Validation d'entrées | 4/10 | Insuffisante |
| Gestion des erreurs | 3/10 | Trop d'informations exposées |
| Rate Limiting | 0/10 | Complètement désactivé |
| CORS/CSRF | 3/10 | Trop permissif, pas de CSRF |
| Headers de sécurité | 4/10 | Manquants |
| Logging | 5/10 | Informations sensibles |
| Secrets | 3/10 | Fallbacks dangereux |
| OAuth | 2/10 | Pas de validation |

**Score global: 3.2/10** ⚠️

---

## 🎯 Plan d'Action Prioritaire

### Urgence Critique (À faire immédiatement)

1. ✅ **Supprimer les backdoors de développement** (1 heure)
   - Retirer les tokens `.dev_signature` et `dev_token_pinecone`
   - Ajouter `#[cfg(debug_assertions)]` pour les garder en dev uniquement

2. ✅ **Corriger le fallback JWT_SECRET** (30 minutes)
   - Faire échouer le démarrage si `JWT_SECRET` est absent

3. ✅ **Implémenter le rate limiting** (4 heures)
   - Utiliser `tower-http::limit` ou Redis
   - Bloquer après 5 tentatives de login échouées

4. ✅ **Valider les tokens OAuth** (3 heures)
   - Utiliser les bibliothèques officielles pour Google/Facebook
   - Vérifier les signatures JWT

### Priorité Haute (Cette semaine)

5. ⚠️ **Réduire la liste CORS** (1 heure)
6. ⚠️ **Uniformiser les messages d'erreur** (2 heures)
7. ⚠️ **Ajouter la validation d'entrées** (8 heures)
8. ⚠️ **Ajouter les headers de sécurité** (1 heure)

### Priorité Moyenne (Ce mois)

9. 📅 **Implémenter la protection CSRF**
10. 📅 **Renforcer la politique de mots de passe**
11. 📅 **Nettoyer les logs**
12. 📅 **Mettre en place la rotation des secrets**

---

## 🔍 Tests de Sécurité Recommandés

1. **Tests de pénétration:**
   - Tester les backdoors de développement
   - Tester le brute-force sur `/auth/login`
   - Tester la forge de tokens JWT
   - Tester les attaques OAuth

2. **Tests automatisés:**
   - Tests unitaires pour l'authentification
   - Tests d'intégration pour les middlewares
   - Tests de charge pour le rate limiting

3. **Audit de code:**
   - Scan avec `cargo audit`
   - Analyse statique avec `clippy`
   - Review manuel des contrôleurs

---

## 📚 Ressources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Rust Security Guidelines](https://rustsec.org/)
- [OWASP JWT Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)

---

## ⚠️ Conclusion

**L'application est actuellement VULNÉRABLE et ne devrait PAS être mise en production** sans corriger au minimum les 4 vulnérabilités critiques identifiées.

Les points positifs sont l'utilisation de SQLx (protection SQL) et bcrypt (hashing sécurisé), mais ces bonnes pratiques sont annulées par les vulnérabilités critiques d'authentification.

**Temps estimé pour corriger les vulnérabilités critiques: 8-10 heures**  
**Temps estimé pour un niveau de sécurité acceptable: 2-3 semaines**

---

*Document généré automatiquement - À mettre à jour après chaque correction*

