# 🔒 Configuration ALLOWED_ORIGINS : Valeur Recommandée

**Date** : 2026-02-14  
**Question** : La valeur `*` est-elle correcte pour `ALLOWED_ORIGINS` ?

---

## ❌ RÉPONSE : `*` NE FONCTIONNERA PAS

### Analyse du Code CORS

**Fichier** : `backend/src/middlewares/cors.rs`

Le backend parse `ALLOWED_ORIGINS` comme une **liste séparée par des virgules** :

```rust
// Ligne 12-14
if let Ok(env_origins) = env::var("ALLOWED_ORIGINS") {
    origins
        .extend(env_origins.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()));
}
```

Le backend vérifie si l'origine est **exactement** dans la liste :

```rust
// Ligne 79
if config.allowed_origins.contains(&origin_str.to_string()) {
    // Autoriser
}
```

**Problème** : Le code ne supporte **PAS** le wildcard `*`. Il cherche une correspondance exacte.

Si vous mettez `ALLOWED_ORIGINS=*`, le backend cherchera une origine littérale `*`, ce qui ne fonctionnera pas.

---

## ✅ SOLUTION RECOMMANDÉE

### Option 1 : Liste Spécifique d'Origines (Recommandé) ✅

**Valeur recommandée** :

```
ALLOWED_ORIGINS=https://api.yukpomnang.com,https://yukpomnang.com,capacitor://localhost,ionic://localhost
```

**Avantages** :
- ✅ Sécurisé (seules les origines autorisées sont acceptées)
- ✅ Fonctionne avec le code actuel
- ✅ Supporte les applications mobiles (sans header Origin, utilise la première origine)

**Explication** :
- `https://api.yukpomnang.com` : Pour les requêtes web directes
- `https://yukpomnang.com` : Pour le frontend web
- `capacitor://localhost` : Pour les apps Capacitor
- `ionic://localhost` : Pour les apps Ionic

---

### Option 2 : Une Seule Origine (Simple) ✅

**Valeur simple** :

```
ALLOWED_ORIGINS=https://api.yukpomnang.com
```

**Avantages** :
- ✅ Simple
- ✅ Fonctionne pour les apps mobiles (utilise cette origine par défaut si pas de header Origin)

**Comment ça fonctionne** :
- Les applications mobiles React Native/Expo n'envoient généralement **pas** de header `Origin`
- Le backend utilise alors la **première origine** de la liste par défaut (voir ligne 101 de `cors.rs`)
- Donc même sans header Origin, l'app mobile fonctionnera

---

## 🔍 COMPORTEMENT POUR LES APPLICATIONS MOBILES

### Sans Header Origin (Apps React Native/Expo)

**Code** (lignes 98-109 de `cors.rs`) :

```rust
} else {
    // ✅ SÉCURITÉ: Pour les applications mobiles sans origin header
    // Utiliser la première origine autorisée par défaut (ou ne rien mettre)
    if let Some(default_origin) = config.allowed_origins.first() {
        if let Ok(header_value) = HeaderValue::from_str(default_origin) {
            response.headers_mut().insert("access-control-allow-origin", header_value);
            response.headers_mut().insert(
                "access-control-allow-credentials",
                HeaderValue::from_static("true"),
            );
        }
    }
}
```

**Comportement** : Si pas de header `Origin`, le backend utilise la **première origine** de la liste.

**Conclusion** : Même avec une seule origine, les apps mobiles fonctionneront.

---

## 🎯 RECOMMANDATION FINALE

### Pour Production ✅

**Valeur recommandée** :

```
ALLOWED_ORIGINS=https://api.yukpomnang.com,https://yukpomnang.com
```

**OU** (si vous voulez être plus permissif pour le développement) :

```
ALLOWED_ORIGINS=https://api.yukpomnang.com,https://yukpomnang.com,capacitor://localhost,ionic://localhost
```

### Pour Développement (Optionnel)

Le code ajoute automatiquement `localhost` en mode debug (lignes 18-27), donc pas besoin de l'ajouter manuellement.

---

## ⚠️ POURQUOI PAS `*` ?

1. **Le code ne le supporte pas** : Le backend fait une comparaison exacte, pas de wildcard
2. **Sécurité** : `*` avec `allow_credentials: true` est interdit par les navigateurs (voir ligne 95-96)
3. **Inutile** : Pour les apps mobiles, la première origine de la liste est utilisée par défaut

---

## 📋 CONFIGURATION DANS AWS ECS

**Dans la Task Definition** :

```
Nom: ALLOWED_ORIGINS
Valeur: https://api.yukpomnang.com,https://yukpomnang.com
```

**OU** (plus simple) :

```
Nom: ALLOWED_ORIGINS
Valeur: https://api.yukpomnang.com
```

---

## ✅ VÉRIFICATION

**Test après configuration** :

```bash
# Test avec header Origin
curl -H "Origin: https://api.yukpomnang.com" \
  https://api.yukpomnang.com/health

# Test sans header Origin (comme les apps mobiles)
curl https://api.yukpomnang.com/health
```

**Résultat attendu** : Les deux devraient retourner 200 OK avec les headers CORS appropriés.

---

**Date** : 2026-02-14  
**Réponse** : ❌ `*` ne fonctionne pas - Utiliser une liste d'origines spécifiques



