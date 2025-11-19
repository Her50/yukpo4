# 🔍 Commandes de Vérification Backend

## Sur Hetzner - Vérifier où est le Backend

```bash
ssh root@46.224.14.85

# 1. Vérifier si backend tourne via docker-compose
cd /opt/yukpo
docker-compose ps backend

# 2. Vérifier si backend tourne via docker seul
docker ps | grep -E 'backend|yukpo'

# 3. Vérifier les ports ouverts
netstat -tlnp | grep 3001

# 4. Tester l'endpoint métriques local
curl http://localhost:3001/metrics | head -20

# 5. Si backend local fonctionne → prometheus.yml avec 'backend:3001' est OK ✅
# 6. Si backend n'est pas local → vérifier où il est déployé (Render/etc.)
```

## Identifier l'URL du Backend en Production

Si le backend n'est pas sur Hetzner, il faut trouver son URL :

```bash
# Vérifier les variables d'environnement
grep -r "API.*URL\|BACKEND.*URL" /opt/yukpo/

# Vérifier les configs nginx/reverse proxy
cat /opt/yukpo/nginx/nginx.conf | grep -i backend

# Vérifier les logs
docker-compose logs backend | grep -i "listening\|started\|running"
```

## Ajuster Prometheus selon le Résultat

**Si backend sur Hetzner (`localhost:3001` ou `backend:3001`)** :
```yaml
targets:
  - 'backend:3001'  # ✅ Déjà configuré
```

**Si backend sur cloud (ex: Render)** :
```yaml
targets:
  - 'https://yukpo-backend.onrender.com'
scheme: https
```

