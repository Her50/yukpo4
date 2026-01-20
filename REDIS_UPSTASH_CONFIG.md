# 🔧 Configuration Redis Upstash pour Yukpomnang

## 📋 Informations de votre compte Redis Upstash

D'après votre console Upstash :

- **Nom de la base** : `yukpomnang-cache`
- **Endpoint** : `quiet-crawdad-8969.upstash.io`
- **Port** : `6379`
- **TLS/SSL** : ✅ Enabled
- **Région** : Frankfurt, Germany (eu-central-1)
- **Token** : (visible dans votre console Upstash)

---

## 🔐 Format de l'URL Redis

Puisque TLS/SSL est activé, utilisez le format `rediss://` (avec deux 's') :

```bash
REDIS_URL=rediss://default:VOTRE_TOKEN@quiet-crawdad-8969.upstash.io:6379
```

**Remplacez `VOTRE_TOKEN`** par le token affiché dans votre console Upstash.

---

## 📝 Comment obtenir votre token

1. Allez sur https://console.upstash.com
2. Sélectionnez votre base `yukpomnang-cache`
3. Dans l'onglet **"Details"**, vous verrez :
   - **TOKEN** (ou clic sur les points pour le révéler)
   - **READONLY TOKEN** (optionnel)

---

## 🚀 Configuration dans votre backend

### Option 1 : Fichier `.env` (local)

Créez/modifiez `backend/.env` :

```env
REDIS_URL=rediss://default:VOTRE_TOKEN_ICI@quiet-crawdad-8969.upstash.io:6379
```

### Option 2 : Variables d'environnement Render.com

1. Allez sur https://dashboard.render.com
2. Sélectionnez votre service backend
3. Onglet **"Environment"**
4. Ajoutez/modifiez :
   - **Key** : `REDIS_URL`
   - **Value** : `rediss://default:VOTRE_TOKEN@quiet-crawdad-8969.upstash.io:6379`
   - Cochez **"Secret"** pour masquer le token

---

## ✅ Test de connexion

### Test 1 : Via redis-cli (si installé)

```bash
redis-cli --tls -u rediss://default:VOTRE_TOKEN@quiet-crawdad-8969.upstash.io:6379
```

Une fois connecté, testez :
```redis
PING
# Devrait retourner : PONG
```

### Test 2 : Via votre backend (route de santé)

Une fois votre serveur démarré :

```bash
# PowerShell
Invoke-WebRequest -Uri http://localhost:8080/health/redis -Method GET

# Ou curl
curl http://localhost:8080/health/redis
```

La réponse devrait être :
```json
{
  "status": "operational",
  "message": "✅ Redis opérationnel (XX ms)",
  "ping_test": true,
  "write_test": true,
  "read_test": true,
  "pool_test": true,
  "connection_time_ms": XX,
  "redis_url_configured": true,
  "pool_available": true,
  "timestamp": "2026-01-XX..."
}
```

---

## 🔍 Vérification dans la console Upstash

1. Allez sur https://console.upstash.com
2. Sélectionnez `yukpomnang-cache`
3. Onglet **"Monitor"** : Visualisez les commandes en temps réel
4. Onglet **"Data Browser"** : Voyez les clés/valeurs stockées

---

## ⚠️ Important

1. **TLS requis** : Utilisez toujours `rediss://` (pas `redis://`)
2. **Token secret** : Ne commitez jamais votre token dans Git
3. **Readonly token** : Optionnel, pour accès en lecture seule
4. **IP Allow List** : Par défaut, accès ouvert. Pour la production, configurez les IPs autorisées

---

## 🛠️ Résolution de problèmes

### Erreur : "Connection refused"
- Vérifiez que TLS est bien activé (`rediss://`)
- Vérifiez que le port est 6379
- Vérifiez que le token est correct

### Erreur : "TLS error"
- Assurez-vous d'utiliser `rediss://` (avec deux 's')
- Vérifiez que TLS/SSL est activé dans Upstash

### Erreur : "Authentication failed"
- Vérifiez que le token est correct (copie-collez depuis la console)
- Regénérez le token si nécessaire (bouton "Reset Credentials")

---

## 📊 Monitoring

Votre console Upstash affiche :
- **Commands** : 9,5 M / Unlimited
- **Bandwidth** : 829 MB / 200 GB
- **Storage** : 4 MB / 100 GB
- **Cost** : $18.91 (Budget: $50)

Tout est dans les limites ! ✅




