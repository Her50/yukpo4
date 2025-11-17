## Résumé

- _Décrivez brièvement les changements apportés._

## Checklist QA / CI

- [ ] Backend : `cargo fmt -- --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test --all --locked`
- [ ] Backend : `cargo sqlx prepare -- --lib` (artefact `backend/sqlx-data.json` à jour)
- [ ] Frontend : `npm run lint:check`, `npm run test -- --coverage`, `npm run build`
- [ ] Mobile : `npm run test -- --coverage`, `npx expo export --platform web`
- [ ] Playwright : `npm run test:e2e -- --project=chromium` (joindre rapport)
- [ ] Detox : `npm run detox:test:<platform>` ou scénario équivalent (indiquer config)
- [ ] Vidéo : `scripts/run_video_pipeline_qa.sh --ci --scenarios ...` (lien artefacts)
- [ ] Seeds QA : `scripts/seed_staging.(sh|ps1)` appliqués (si données requises)
- [ ] Migrations appliquées sur staging / Render mentionnées dans la PR
- [ ] Feature flags documentés (`docs/qa_ci_phase5.md` + release notes)

## Notes complémentaires

- _Captures d’écran, liens vers artefacts CI, scénarios manuels exécutés, etc._


