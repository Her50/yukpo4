# YukpoIA — facturation et quotas

## Migration base de données

Appliquer la migration :

`migrations/20260321_yukpo_ia_daily_usage.sql`

(création de la table `yukpo_ia_daily_usage` pour le quota gratuit journalier en UTC.)

## Variables d’environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `YUKPO_IA_BILLING_ENABLED` | `true` | Désactiver (`false`) pour tests sans prélèvement ni quota. |
| `YUKPO_IA_DAILY_FREE_TOKEN_BUDGET` | `8000` | « Unités » gratuites par jour et par utilisateur (alignées sur les tokens de réponse après multiplicateur). |
| `YUKPO_IA_TOKEN_MULTIPLIER` | `1.0` | Multiplicateur appliqué aux tokens de complétion OpenAI pour obtenir le montant prélevé en jetons app. |
| `YUKPO_IA_VISION_MODEL` | valeur de `OPENAI_MODEL` | Modèle utilisé lorsque des images sont jointes (`yukpo_ia_attachments`). |
| `OPENAI_MODEL` | `gpt-4o-mini` | Modèle texte par défaut. |
| `OPENAI_WHISPER_MODEL` | `whisper-1` | Modèle pour `POST /v1/audio/transcriptions` (audio YukpoIA). |
| `YUKPO_IA_WHISPER_ENABLED` | `true` | Mettre `false` pour désactiver la transcription serveur (garde le champ `transcript` tel quel). |
| `YUKPO_IA_WHISPER_BILLING_ENABLED` | `true` | Mettre `false` pour transcrire sans prélèvement (tests / debug). |
| `YUKPO_IA_WHISPER_BILL_UNITS` | `200` | Unités de base **une fois par fichier audio** transcrit avec succès (avant `YUKPO_IA_TOKEN_MULTIPLIER`, comme pour le chat). |

## Comportement

1. Avant chaque appel : si le quota gratuit du jour est épuisé **et** `users.tokens_balance <= 0`, la réponse JSON indique `billing.insufficient_balance` / `recharge_required` (pas d’appel OpenAI).
2. Après chaque réponse : les tokens de complétion (ou `total_tokens` en repli) sont convertis en unités facturées ; la part couvrable par le quota gratuit du jour est déduite de ce quota, le reste est prélevé sur `tokens_balance` et journalisé dans `token_consumption_logs` (`service_name = yukpo_ia`).
3. **Transcription audio (Whisper)** : chaque fichier audio transcrit avec succès déclenche **un prélèvement séparé** (`service_name = yukpo_ia_whisper`), avec les mêmes règles quota journalier + solde. La réponse peut inclure `billing.audio_transcription_units` (somme des unités facturées pour les audios de la requête).

### Prétraitement des pièces jointes (`yukpo_ia_preprocess`)

Avant l’appel au modèle chat, le backend peut enrichir `context.yukpo_ia_attachments` :

- **`kind: "audio"`** avec `data_base64` et sans transcription utile : appel **Whisper** (`OPENAI_API_KEY`, `OPENAI_WHISPER_MODEL`), résultat dans **`transcript`** (paramètre optionnel **`language`** = 2 premières lettres de la langue utilisateur) ; si la facturation Whisper est active, **un débit** est appliqué par fichier après transcription réussie.
- **`kind: "file"`** avec **`data_base64`** : extraction de texte via `extract_text_from_base64` (PDF `pdf-extract`, Excel `calamine`, DOCX `docx-rs`, texte brut), résultat dans **`extracted_text`**.

## Clarification : `ChatInputMobile` vs YukpoIA

Le composant **`ChatInputMobile.tsx`** (saisie riche Home / création produit, etc.) gère déjà côté app :

- **Audio** : enregistrement via **expo-av**, conversion en **base64** (`audio_base64` dans le payload) — ce sont des **données audio brutes**, pas une **reconnaissance vocale** (pas de transcription texte produite sur l’app).
- **PDF** : fichiers choisis avec **expo-document-picker**, stockés en **base64** (`pdf_base64` / `documents`) — **pas d’extraction du texte PDF en local** ; l’app envie le **binaire encodé**, pas un extrait texte.

Donc l’app « fait » bien la **capture et l’envoi** média pour ces flux ; ce qui n’y est en général **pas** fait sur l’app, c’est la **STT** (speech-to-text) et l’**OCR / parsing PDF** — ceux-ci relèvent plutôt du **backend** (ex. Whisper, extracteur PDF) si vous les branchez sur la même API.

Le flux **YukpoIA** (`/ai/chat`) utilise aujourd’hui `mobile/src/utils/yukpoIaAttachments.ts` : images, fichiers avec extrait texte pour les **fichiers texte** ; l’alignement complet avec le même niveau de médias que `ChatInputMobile` (audio base64, PDF base64) peut être ajouté en mappant ces champs vers `context.yukpo_ia_attachments`.

## API mobile

Le client envoie des pièces jointes dans `context.yukpo_ia_attachments` :

```json
[
  { "kind": "image", "mime": "image/jpeg", "data_base64": "..." },
  { "kind": "file", "mime": "text/plain", "name": "note.txt", "extracted_text": "..." },
  { "kind": "audio", "mime": "audio/m4a", "name": "clip.m4a", "transcript": "..." }
]
```

La réponse inclut `billing` (solde, quota restant, message `notice`) et `assistant_brand: "YukpoIA"`.

## Pièces jointes générées (`attachments`)

Après la réponse du modèle, le backend exécute `yukpo_ia_chat_enrich::enrich_response_attachments` :

1. **`attachments` et `generated_files`** (tableaux dans le JSON de réponse) : toute entrée contenant **`inline_base64`** est décodée, uploadée via `MediaStorageService::store_bytes` (préfixe clé `yukpo_ia/{user_id}/…`), puis **remplacée** par un objet prêt pour le mobile :

   `id`, `url`, `filename`, `mime_type`, `format`

   Taille max. par fichier inline : **15 Mo**.

2. **`tool_outputs`** (optionnel, même schéma) : traité de la même façon ; les entrées valides sont **fusionnées** dans `attachments`, puis **`tool_outputs` est retiré** de la réponse pour ne pas exposer de payloads volumineux.

3. **URLs déjà absolues** dans `tool_outputs` (`http://` / `https://`) : recopiées telles quelles dans `attachments`.

4. **Code Rust** : pour produire un fichier depuis un outil interne sans passer par le LLM, utiliser
   `crate::services::yukpo_ia_chat_enrich::upload_chat_attachment_blob`, puis
   `merge_extra_attachments(&mut body, &[valeur])` sur l’objet réponse avant envoi (ou étendre ce module avec votre hook).

Configuration stockage : `UPLOAD_BASE_URL` / `PUBLIC_BASE_URL` (voir `MediaStorageService`).

## Résilience / scalabilité des appels OpenAI

Voir **`docs/YUKPO_IA_SCALING_OPENAI.md`** : client HTTP partagé, limite de concurrence par instance (`YUKPO_IA_OPENAI_MAX_CONCURRENT`), retries 429/503, `OPENAI_API_KEYS`, et pistes (files Redis/SQS, autoscaling).
