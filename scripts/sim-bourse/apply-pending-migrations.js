// ============================================================================
// apply-pending-migrations.js — 2026-05-19
// ----------------------------------------------------------------------------
// Applique sur staging (ou prod, à condition d'override DATABASE_URL) les
// migrations *.sql présentes dans backend/migrations/ mais absentes de la
// table _sqlx_migrations. Conçu pour les environnements qui ont désactivé
// ENABLE_AUTO_MIGRATIONS (cas du fork staging — cf. fly.staging.toml:53).
//
// Pourquoi ce script existe :
//   Depuis le clone fork-from prod, _sqlx_migrations s'arrête à dec 2025.
//   Toutes les migrations Bourse du Livre + librairie_network + Yukpo Lib
//   (5 mois de SQL) ne sont jamais passées. Mon fix build_neuf_packages
//   (UPDATE/SELECT sur cln.is_packaged) plantait en 500 jusqu'à ce qu'on
//   applique la migration is_packaged à la main. Ce script automatise.
//
// Convention d'analyse :
//   sqlx parse <version>_<description>.sql → splitn(2,'_'),
//   version = i64 du préfixe avant le premier '_', description = reste
//   avec underscores → espaces, ".sql" stripped.
//   En cas de versions doublonnées dans le repo, la 1ère du tri alpha gagne.
//
// Mode dry-run par défaut (lister les pendantes sans rien faire).
// Pour vraiment appliquer : `node apply-pending-migrations.js --apply`.
// ============================================================================

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'backend', 'migrations');

const APPLY = process.argv.includes('--apply');
const MIN_VERSION = (() => {
    const arg = process.argv.find((a) => a.startsWith('--min-version='));
    if (!arg) return 0n;
    return BigInt(arg.split('=')[1]);
})();
const ONLY_2026 = process.argv.includes('--only-2026');

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
    console.error('❌ DATABASE_URL absent (cf. scripts/sim-bourse/.env).');
    process.exit(1);
}

/**
 * Parse un nom de fichier de migration façon sqlx.
 * `20260519_001_commande_livre_neuf_is_packaged.sql`
 *   → { version: 20260519n, description: '001 commande livre neuf is packaged' }
 */
function parseFilename(filename) {
    const m = filename.match(/^(\d+)(?:_(.+))?\.sql$/);
    if (!m) return null;
    const version = BigInt(m[1]);
    const desc = (m[2] || '').replace(/_/g, ' ');
    return { version, description: desc };
}

/** sqlx utilise SHA-384 pour le checksum de la migration. */
function sha384(buf) {
    return crypto.createHash('sha384').update(buf).digest();
}

async function main() {
    const allFiles = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort();

    // ⚠ Le repo contient des doublons de version (ex: 20260126 partagé par 10+
    // fichiers immobilier). sqlx::migrate!() runtime gérerait ça en ne stockant
    // qu'une row par version dans _sqlx_migrations, mais il APPLIQUE tous les
    // fichiers SQL. On reproduit ce comportement : on traite chaque fichier
    // (le SQL doit être idempotent — convention codebase), et on log un
    // discriminator dans la description quand plusieurs fichiers partagent
    // la même version.
    const parsed = [];
    const versionCounts = new Map();
    for (const f of allFiles) {
        const p = parseFilename(f);
        if (!p) {
            console.warn(`⚠️  Nom ignoré (regex): ${f}`);
            continue;
        }
        const key = p.version.toString();
        const idx = (versionCounts.get(key) || 0) + 1;
        versionCounts.set(key, idx);
        parsed.push({ filename: f, dupIndex: idx, ...p });
    }

    // Filtre min-version + only-2026
    const filtered = parsed.filter((p) => {
        if (p.version < MIN_VERSION) return false;
        if (ONLY_2026 && (p.version < 20260000n || p.version >= 20270000n)) return false;
        return true;
    });

    console.log(`▶️  ${allFiles.length} fichiers, ${parsed.length} parsables, ${filtered.length} dans le filtre`);

    const pool = new pg.Pool({ connectionString: DB_URL });
    const client = await pool.connect();
    try {
        // Récupère les versions déjà appliquées (success = true uniquement).
        // Les versions success=false sont des migrations cassées qu'on doit
        // re-tenter (sqlx au runtime bloque normalement, ici on force).
        const r = await client.query(
            `SELECT version, success FROM _sqlx_migrations`,
        );
        const applied = new Set(
            r.rows.filter((row) => row.success).map((row) => row.version.toString()),
        );
        const broken = new Set(
            r.rows.filter((row) => !row.success).map((row) => row.version.toString()),
        );

        // Une version "appliquée" couvre AUSSI les fichiers doublonnés
        // (même version) — le SQL aura été appliqué par la branche initiale.
        // On garde quand même les fichiers doublonnés non-tracés pour donner
        // la trace exécutable au reviewer (avec un warning).
        const pending = filtered.filter((p) => !applied.has(p.version.toString()));

        const pendingFiles = pending.length;
        const pendingUniqueVersions = new Set(pending.map((p) => p.version.toString())).size;

        console.log(`📊 Versions appliquées (success=t): ${applied.size}`);
        console.log(`📊 Versions en échec (success=f) : ${broken.size}`);
        console.log(`📊 Fichiers pendants : ${pendingFiles} (${pendingUniqueVersions} versions uniques)`);
        console.log('');

        if (pending.length === 0) {
            console.log('✅ Rien à faire.');
            return;
        }

        // Liste avant action (tronquée si > 50 — on commence par les
        // dernières qui sont celles qu'on a probablement ajoutées).
        const head = pending.slice(0, 25);
        const tail = pending.slice(-15);
        console.log('--- Premières 25 ---');
        for (const p of head) {
            const dup = p.dupIndex > 1 ? `  [dup #${p.dupIndex}]` : '';
            console.log(`  ${p.version}  ${p.filename}${dup}`);
        }
        if (pending.length > 40) {
            console.log(`  … (${pending.length - 40} fichiers intermédiaires)`);
            console.log('--- Dernières 15 ---');
            for (const p of tail) {
                const dup = p.dupIndex > 1 ? `  [dup #${p.dupIndex}]` : '';
                console.log(`  ${p.version}  ${p.filename}${dup}`);
            }
        }
        console.log('');

        if (!APPLY) {
            console.log('🟡 DRY-RUN (--apply absent). Relance avec --apply pour exécuter.');
            return;
        }

        let okCount = 0;
        let errCount = 0;
        const errors = [];

        for (const p of pending) {
            const sqlPath = path.join(MIGRATIONS_DIR, p.filename);
            const sqlBuf = fs.readFileSync(sqlPath);
            const checksum = sha384(sqlBuf);
            const sqlText = sqlBuf.toString('utf8');

            const t0 = Date.now();
            try {
                // ALTER TYPE ... ADD VALUE refuse d'être dans une tx → on
                // exécute le SQL hors tx, et on enregistre la trace dans
                // _sqlx_migrations dans une 2e tx séparée. Si l'ALTER plante,
                // on saute l'enregistrement.
                await client.query(sqlText);
                const elapsed = Date.now() - t0;

                // Pour les fichiers doublons d'une même version (cf.
                // 20260126 / 20260403 / etc.), on n'écrase pas la 1ère row
                // déjà inscrite — sqlx::migrate!() aurait ignoré la 2e au
                // tracking (PK). Le SQL a été appliqué quand même → effet
                // identique au runtime sqlx normal.
                await client.query(
                    `INSERT INTO _sqlx_migrations (version, description, installed_on, success, checksum, execution_time)
                     VALUES ($1, $2, NOW(), TRUE, $3, $4)
                     ON CONFLICT (version) DO NOTHING`,
                    [p.version.toString(), p.description, checksum, elapsed * 1_000_000],
                );

                const dup = p.dupIndex > 1 ? ` [dup #${p.dupIndex}]` : '';
                console.log(`✅ ${p.version}  ${p.filename}${dup}  (${elapsed} ms)`);
                okCount++;
            } catch (e) {
                const elapsed = Date.now() - t0;
                const dup = p.dupIndex > 1 ? ` [dup #${p.dupIndex}]` : '';
                console.error(`❌ ${p.version}  ${p.filename}${dup}  (${elapsed} ms)`);
                console.error(`    ${e.message.split('\n')[0]}`);
                errors.push({ migration: p, error: e.message });
                errCount++;
                // On continue malgré l'échec — les migrations sont supposées
                // idempotentes mais certaines ont des prérequis qu'on ne
                // contrôle pas. L'humain triera le rapport final.
            }
        }

        console.log('');
        console.log(`📊 Bilan : ${okCount} ✅ / ${errCount} ❌ sur ${pending.length}`);

        if (errors.length > 0) {
            const reportPath = path.join(__dirname, 'pending-migrations-errors.json');
            fs.writeFileSync(
                reportPath,
                JSON.stringify(
                    errors.map((e) => ({
                        version: e.migration.version.toString(),
                        filename: e.migration.filename,
                        error: e.error,
                    })),
                    null,
                    2,
                ),
            );
            console.log(`📝 Détail erreurs : ${reportPath}`);
        }
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((e) => {
    console.error('❌ Erreur fatale:', e);
    process.exit(1);
});
