# RUNBOOK INCIDENT – SERVICE LIVRAISON YUKPO

## 1. Détection rapide
- **Alertes automatisées**
  - Prometheus via `/metrics/delivery` :
    - `delivery_wallet_debit_events_total` dérivé → spike inhabituel (>3× moyenne 15 min).
    - `delivery_wallet_refund_events_total` < débit → suspicion fuite trésorerie.
    - Absence d’incrément `delivery_recipient_dropoff_events_total` ≥ 10 min → tracking destinataire KO.
  - Logs structurés `DeliveryWallet` / `DeliveryService` (niveau `error`) ingérés dans Loki.
- **Signalements terrain**
  - Support client/coursier (Zendesk, Slack #ops-delivery).
  - Monitoring UX (app mobile) : taux erreurs WebSocket > 5%.

## 2. Checklist initiale (≤ 5 min)
1. **Statut plateformes** : API Yukpo (`/healthz`), BDD Postgres, Redis, LiveKit.
2. **Métriques critiques** : Grafana dashboard "Delivery – Temps réel".
3. **Logs ciblés** : rechercher `DeliveryWallet` / `RecipientDropoff` sur dernière heure.
4. **WebSockets** : confirmer nombre de connexions actives (`DeliveryTrackingManager::connections_count` via observabilité interne).
5. **Matching** : vérifier jobs en attente (table `delivery_matching_queue` / logs `MatchingService`).

## 3. Classification incident
- **P1 Critique** : paiement bloqué, échec création livraison > 50%, indisponibilité API publique.
- **P2 Majeur** : tracking dégradé, latence matching > 3 min, remboursements en boucle.
- **P3 Modéré** : décalage métriques, anomalies isolées (1-2 utilisateurs).

## 4. Actions par scénario
### 4.1 Wallet débit/refund anormal
1. Geler opérations wallet (`feature flag` ou `rate_limit` middleware).
2. Exporter transactions récentes (`delivery_wallet_mutations`).
3. Vérifier soldes utilisateurs impactés (`DeliveryRepository::get_user_balance`).
4. Lancer remboursement manuel si besoin (`/wallet/refund` interne).
5. Post-mortem : analyser raisons (`reason` payload), corriger validation.

### 4.2 Tracking destinataire inactif
1. Vérifier WS `/delivery/{id}/ws` (ping/pong, nombre de messages).
2. Fallback polling : activer `useDeliveryTracking.refresh()` côté Front (tâche SRE).
3. Purger cache Dropoff si blocage (commandes SQL `recipient_dropoff_updates`).
4. Communiquer aux utilisateurs : notification push "Suivi en cours de stabilisation".

### 4.3 Matching bloqué
1. Vérifier table `deliveries` statut `awaiting_courier_confirmation`.
2. Relancer worker matching (`tokio::spawn` via `MatchingService::retry_pending()`).
3. Activer plan B : assignation manuelle (interface backoffice) ou message client.

## 5. Communication
- **Interne** : canal Slack `#incident-delivery`, mise à jour toutes les 15 min.
- **Support** : template réponse (FR/EN) pour clients/coursiers.
- **Clients finaux** : bannière in-app + push notification si durée > 30 min.

## 6. Rétablissement & validation
1. Surveiller métriques redevenues nominales (débits/refunds équilibrés, dropoff events).
2. Exécuter tests ciblés :
   - API `POST /delivery/{id}/recipient` + `POST /wallet/debit`.
   - Websocket tracking (simulateur).
3. Confirmer avec Support qu’aucun ticket critique ouvert.

## 7. Post-incident (≤ 48 h)
- Rédiger rapport (cause racine, impact, TTR, actions correctives).
- Mettre à jour tests automatisés (unitaires + intégration).
- Ajuster alerting / dashboards si défaillance de détection.
- Planifier sprint hardening si impact majeur.

## 8. Contacts & responsabilités
- **Incident commander** : Lead backend.
- **SRE / Observabilité** : assurer monitoring, scrapers Prometheus.
- **Support** : communication client.
- **Produit** : validation message externe + priorisation corrective.

## 9. Annexes
- Dashboard Grafana : `Delivery / Temps Réel`.
- Kibana / Loki : recherche `DeliveryWallet`.
- Script vérification soldes : `scripts/check_delivery_wallet_balances.rs` (à développer).




