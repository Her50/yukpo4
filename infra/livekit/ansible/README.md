# LiveKit Hetzner – Playbook Ansible

Ce dossier fournit un playbook minimal pour (re)déployer LiveKit sur la VM Hetzner :

- copie (ou téléchargement) du binaire `livekit-server`
- déploiement de la configuration `livekit.yaml`
- installation du service `systemd`
- ouverture optionnelle des ports via UFW

## Prérequis

- Ansible ≥ 2.12 sur votre poste
- Accès SSH root (ou `become`) vers la machine cible
- Variables `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` prêtes
- Une archive `livekit_*_linux_amd64.tar.gz` à disposition **OU** un accès HTTP direct à l’asset GitHub

## Inventaire

Copiez `inventory.example.ini` et remplacez les valeurs :

```ini
[edge]
livekit-vps ansible_host=46.224.14.85 ansible_user=root \
  livekit_domain=livekit.46.224.14.85.sslip.io \
  srs_domain=srs.46.224.14.85.sslip.io \
  livekit_api_key=APIPHE9xDv5RPaP \
  livekit_api_secret=qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE \
  acme_email=lelehernandez2007@yahoo.fr
```

> ⚠️ Pour un dépôt public, remplacez les valeurs sensibles par des variables chiffrées (ansible-vault ou variables d’environnement).

## Variables importantes

| Variable | Description |
|----------|-------------|
| `livekit_download_url` | (optionnel) URL directe de l’archive LiveKit (ex: asset GitHub) |
| `livekit_local_tarball` | (optionnel) chemin local vers une archive LiveKit à copier (`~/Downloads/livekit.tar.gz`) |
| `livekit_api_key` | Clé LiveKit |
| `livekit_api_secret` | Secret LiveKit |
| `livekit_port` | Port HTTP (défaut 7880) |
| `livekit_tcp_port` | Port WebRTC TCP (défaut 7881) |
| `livekit_udp_port` | Port WebRTC UDP (défaut 7882) |
| `enable_ufw_rules` | `true` pour gérer automatiquement UFW |

> Définissez **exactement une** des variables `livekit_download_url` ou `livekit_local_tarball`. Si les deux sont absentes, le playbook échoue.

## Exécution

À partir de la racine du dépôt :

```bash
ansible-playbook -i infra/livekit/ansible/inventory.example.ini \
  infra/livekit/ansible/playbook.yml \
  -e "livekit_local_tarball=~/Downloads/livekit_1.9.3_linux_amd64.tar.gz"
```

Ou, si la VM a accès à GitHub :

```bash
ansible-playbook -i infra/livekit/ansible/inventory.example.ini \
  infra/livekit/ansible/playbook.yml \
  -e "livekit_download_url=https://github.com/livekit/livekit/releases/download/v1.9.3/livekit_1.9.3_linux_amd64.tar.gz"
```

## Hooks post-déploiement

- Le handler `restart livekit` redémarre `systemd`.
- Le playbook vérifie ensuite l’état du service (`systemctl status`).
- Ajouter vos étapes (certbot, Traefik, monitoring) dans une tâche séparée.

## Déploiements automatisés

Si un commit doit déclencher ce déploiement automatiquement :

1. Ajouter un job CI qui :
   - build/push le backend
   - exécute ce playbook (via runner avec SSH)
2. Versionner les artefacts LiveKit dans un bucket ou registry pour éviter les 404 GitHub.

Sinon, un déploiement manuel `ansible-playbook …` après chaque rotation de clé suffit.


