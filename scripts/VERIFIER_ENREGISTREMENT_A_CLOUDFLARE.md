# 🔍 Comment trouver l'enregistrement A dans Cloudflare

## ⚠️ Situation Actuelle

Le DNS résout toujours vers des IPs Cloudflare :
- `104.21.28.135` (Cloudflare)
- `172.67.170.213` (Cloudflare)

Cela signifie que le **proxy Cloudflare est toujours activé** pour l'enregistrement A.

## 📋 Où trouver l'enregistrement A

Dans votre interface Cloudflare, l'enregistrement A peut apparaître sous différents noms selon la langue :

### En français :
- **Type** : "UN" ou "A" ou "AAAA"
- **Nom** : `yukpomnang.com` (ou juste `@` ou vide)
- **Contenu** : Une adresse IP (ex: `192.64.119.4` ou autre)

### Dans votre capture d'écran :
Je vois dans la deuxième image un enregistrement :
- **Type** : "UN" 
- **Nom** : `yukpomnang...` (tronqué)
- **Contenu** : `192.64.119.4`
- **Statut du proxy** : **ORANGE** (Procuration) ⚠️

## ✅ Action à faire

1. **Trouver l'enregistrement A/UN** pour `yukpomnang.com`
   - Il peut être en haut ou en bas de la liste
   - Cherchez celui avec l'IP `192.64.119.4` ou une autre IP

2. **Vérifier le statut du proxy**
   - Si le nuage est **ORANGE** → Cliquer dessus
   - Il doit passer en **GRIS** (DNS uniquement)

3. **Sauvegarder** les modifications

4. **Attendre 1-2 minutes** pour la propagation DNS

## 🔍 Vérification après modification

Après avoir désactivé le proxy, exécuter :

```powershell
Resolve-DnsName -Name yukpomnang.com -Type A
```

L'IP devrait maintenant être différente (pas les IPs Cloudflare 104.21.x.x ou 172.67.x.x).

## 📝 Note

Si vous ne voyez **aucun** enregistrement A/UN dans votre liste :
- Il se peut qu'il soit sur une autre page (pagination)
- Utilisez la recherche pour trouver "yukpomnang.com"
- Vérifiez qu'il n'y a pas de filtre actif qui le cache



