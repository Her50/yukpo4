================================================================================
ANALYSE DES LOGS POSTGRESQL
================================================================================

📊 RÉSUMÉ GÉNÉRAL
--------------------------------------------------------------------------------
Total d'erreurs détectées: 87
Erreurs critiques: 87
Opérations de migration détectées: 1
Opérations DB détectées: 27

🔴 ERREURS CRITIQUES
--------------------------------------------------------------------------------

MATERIALIZED_VIEW: 1 occurrence(s)
  1. [2026-02-06 22:51:43] 2026-02-06 21:51:43 UTC:10.0.3.41(54610):yukpo_db_user@postgres:[2479]:ERROR:  cannot refresh materialized view "public.services_search_optimized_v2" 

FROM_CLAUSE: 1 occurrence(s)
  1. [2026-02-06 22:53:36] 2026-02-06 21:53:36 UTC:10.0.3.39(53826):yukpo_db_user@postgres:[3167]:ERROR:  missing FROM-clause entry for table "u" at character 277

SYNTAX_ERROR: 77 occurrence(s)
  1. [2026-02-06 22:53:36] 2026-02-06 21:53:36 UTC:10.0.3.39(52604):yukpo_db_user@postgres:[3156]:ERROR:  syntax error at end of input at character 48
  2. [2026-02-06 22:53:40] 2026-02-06 21:53:40 UTC:10.0.3.72(57232):yukpo_db_user@postgres:[2850]:ERROR:  syntax error at end of input at character 330
  3. [2026-02-06 22:53:40] 2026-02-06 21:53:40 UTC:10.0.3.72(57278):yukpo_db_user@postgres:[2858]:ERROR:  syntax error at end of input at character 491
  4. [2026-02-06 22:53:40] 2026-02-06 21:53:40 UTC:10.0.3.72(57152):yukpo_db_user@postgres:[2841]:ERROR:  syntax error at end of input at character 459
  5. [2026-02-06 22:53:40] 2026-02-06 21:53:40 UTC:10.0.3.72(57182):yukpo_db_user@postgres:[2846]:ERROR:  syntax error at end of input at character 396
  ... et 72 autre(s)

DUPLICATE: 1 occurrence(s)
  1. [2026-02-06 22:53:39] 2026-02-06 21:53:39 UTC:10.0.3.72(57258):yukpo_db_user@postgres:[2854]:ERROR:  trigger "trigger_update_templates_updated_at" for relation "video_templ

PREPARED_STATEMENT: 2 occurrence(s)
  1. [2026-02-06 22:53:40] 2026-02-06 21:53:40 UTC:10.0.3.72(57266):yukpo_db_user@postgres:[2857]:ERROR:  cannot insert multiple commands into a prepared statement
  2. [2026-02-06 22:53:40] 2026-02-06 21:53:40 UTC:10.0.3.72(57254):yukpo_db_user@postgres:[2853]:ERROR:  cannot insert multiple commands into a prepared statement

GROUP_BY: 1 occurrence(s)
  1. [2026-02-06 22:53:40] 2026-02-06 21:53:40 UTC:10.0.3.72(57164):yukpo_db_user@postgres:[2842]:ERROR:  column "u.id" must appear in the GROUP BY clause or be used in an aggre

MISSING_COLUMN: 4 occurrence(s)
  1. [2026-02-06 22:53:40] 2026-02-06 21:53:40 UTC:10.0.3.72(57198):yukpo_db_user@postgres:[2847]:ERROR:  column "retry_at" does not exist
  2. [2026-02-06 22:53:41] 2026-02-06 21:53:41 UTC:10.0.3.72(57254):yukpo_db_user@postgres:[2853]:ERROR:  column "pharmacy_id" does not exist
  3. [2026-02-06 22:53:41] 2026-02-06 21:53:41 UTC:10.0.3.72(57232):yukpo_db_user@postgres:[2850]:ERROR:  column "user_id" does not exist
  4. [2026-02-06 22:53:41] 2026-02-06 21:53:41 UTC:10.0.3.72(57260):yukpo_db_user@postgres:[2855]:ERROR:  column "expiry_time" does not exist

📝 MIGRATIONS DÉTECTÉES
--------------------------------------------------------------------------------
Total: 1 opération(s) de migration

Dernières 10 opérations de migration:
  1. [2026-02-06 22:53:39] 2026-02-06 21:53:39 UTC:10.0.3.72(57258):yukpo_db_user@postgres:[2854]:STATEMENT:  -- Active les ext

💾 ÉTAT DE LA BASE DE DONNÉES
--------------------------------------------------------------------------------
❌ Erreurs critiques détectées - Base de données en état dégradé

🔍 PROBLÈMES DÉTECTÉS:
  ❌ Erreurs de syntaxe SQL (migrations mal formées)
  ❌ Colonnes manquantes (migrations incomplètes)
  ⚠️  Vue matérialisée nécessite un index unique pour refresh concurrent
  ❌ Erreurs dans les vues (FROM-clause manquant)
  ⚠️  Tentatives d'exécuter plusieurs commandes dans une prepared statement

================================================================================