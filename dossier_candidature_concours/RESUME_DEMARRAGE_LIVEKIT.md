# Résumé Démarrage LiveKit - Guide Rapide 🚀

## Date
2025-11-28

---

## 🚀 DÉMARRAGE RAPIDE (Docker - Recommandé)

### Étape 1 : Créer la Configuration

```bash
cat > livekit.yaml << EOF
port: 7880
bind_addresses:
  - "0.0.0.0"
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
keys:
  APIPHE9xDv5RPaP: qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE
log_level: info
EOF
```

### Étape 2 : Ouvrir les Ports

```bash
# UFW
sudo ufw allow 7880/tcp
sudo ufw allow 7881/tcp
sudo ufw allow 50000:60000/udp

# iptables
sudo iptables -A INPUT -p tcp --dport 7880 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 7881 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 50000:60000 -j ACCEPT
```

### Étape 3 : Démarrer avec Docker

```bash
docker run -d \
  --name livekit-server \
  --restart unless-stopped \
  -p 7880:7880 \
  -p 7881:7881 \
  -p 50000-60000:50000-60000/udp \
  -v $(pwd)/livekit.yaml:/etc/livekit.yaml \
  livekit/livekit-server:latest \
  --config /etc/livekit.yaml \
  --dev
```

### Étape 4 : Vérifier

```bash
# Vérifier le conteneur
docker ps | grep livekit

# Vérifier les logs
docker logs livekit-server

# Tester la connexion
curl -v http://46.224.14.85:7880/
```

---

## 📋 INFORMATIONS DE CONFIGURATION

**IP :** `46.224.14.85`  
**Port :** `7880`  
**API Key :** `APIPHE9xDv5RPaP`  
**API Secret :** `qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE`

---

## 🔧 COMMANDES UTILES

### Gestion Docker

```bash
# Démarrer
docker start livekit-server

# Arrêter
docker stop livekit-server

# Redémarrer
docker restart livekit-server

# Logs
docker logs -f livekit-server

# Statut
docker ps | grep livekit
```

### Vérification

```bash
# Test TCP
telnet 46.224.14.85 7880

# Test HTTP
curl -v http://46.224.14.85:7880/

# Vérifier les ports
sudo netstat -tlnp | grep 7880
```

---

## ✅ CHECKLIST

- [ ] Configuration `livekit.yaml` créée
- [ ] Ports ouverts dans le firewall
- [ ] Conteneur Docker démarré
- [ ] Test de connexion réussi
- [ ] Logs vérifiés (pas d'erreurs)

---

**Date de création :** 2025-11-28  
**Dernière mise à jour :** 2025-11-28

