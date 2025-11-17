import { expect, test } from '@playwright/test';

test.describe('ImmersiveVideoWizard – storyboard IA + preview courte + rendu', () => {
    test('brief → storyboard IA → Utiliser → assignation média → preview courte → rendu avec payload complet', async ({
        page,
        request,
    }) => {
        // TODO: adapter cette étape à ton flux d’auth (login ou session déjà en place)
        // Ici on suppose un cookie de dev ou une page d’accueil non protégée.

        await page.goto('/');

        // Ouvrir le wizard vidéo pour un service donné (serviceId=1, productIndex=0)
        await page.goto('/video/immersive?serviceId=1&productIndex=0');

        // On attend que le wizard charge
        await expect(page.getByText(/wizard vidéo/i)).toBeVisible({ timeout: 30_000 });

        // Saisir un brief simple
        const briefTextarea = page.locator('textarea[aria-label="videoWizard.sections.describe"]');
        await briefTextarea.fill('Promo livraison express ce week-end avec réduction spéciale.');

        // Headline et CTA (les placeholders sont traduits, on utilise les labels ARIA)
        const headlineInput = page.locator('input[aria-label="videoWizard.placeholders.headline"]');
        const ctaInput = page.locator('input[aria-label="videoWizard.placeholders.callToAction"]');

        await headlineInput.fill('Livraison express Yukpo');
        await ctaInput.fill('Commander maintenant');

        // Générer le storyboard IA
        const storyboardButton = page.getByRole('button', { name: /générer/i }).first();
        await storyboardButton.click();

        // Attendre que les premières scènes du storyboard s’affichent
        await expect(page.getByText(/intro/i)).toBeVisible({ timeout: 30_000 });

        // Appliquer le storyboard à la timeline (bouton "Utiliser")
        const applyButton = page.getByRole('button', { name: /utiliser/i });
        await applyButton.click();

        // Vérifier que le rail de scènes reflète le storyboard (S1, S2 visibles)
        await expect(page.getByText(/S1/)).toBeVisible();
        await expect(page.getByText(/S2/)).toBeVisible();

        // Passer au step 2
        const nextStepButton = page.getByRole('button', { name: /prochaine étape/i });
        await nextStepButton.click(); // -> step 2 (médias / timeline)

        // Assigner un média simple à la première scène si un select est disponible
        // On cible le premier select de la liste d’assignation scène/média
        const firstSceneSelect = page.locator('select').first();
        if (await firstSceneSelect.isVisible()) {
            const options = await firstSceneSelect.locator('option').all();
            if (options.length > 1) {
                // On choisit la première option "réelle" (index 1)
                const value = await options[1].getAttribute('value');
                if (value) {
                    await firstSceneSelect.selectOption(value);
                }
            }
        }

        // Passer au step 3 (résumé)
        const previewTimelineButton = page.getByRole('button', {
            name: /prévisualisation timeline/i,
        });
        await previewTimelineButton.click(); // -> step 3

        // Lancer la prévisualisation courte et vérifier l’appel API /preview-short
        const [previewRequest] = await Promise.all([
            page.waitForRequest((req) =>
                req.url().includes('/api/studio/sessions') &&
                req.url().endsWith('/preview-short') &&
                req.method() === 'POST',
            ),
            page.getByRole('button', { name: /prévisualisation rapide/i }).click(),
        ]);

        expect(previewRequest.method()).toBe('POST');

        const previewResponse = await previewRequest.response();
        expect(previewResponse).not.toBeNull();
        const previewJson = await previewResponse!.json();

        const previewUrl = previewJson.preview_url ?? previewJson.data?.preview_url;
        expect(previewUrl).toBeTruthy();

        // Lancer le rendu complet et capturer le payload envoyé au backend
        const [renderRequest] = await Promise.all([
            page.waitForRequest((req) =>
                req.url().includes('/api/media/product/') &&
                req.url().includes('/generate-video') &&
                req.method() === 'POST',
            ),
            page
                .getByRole('button', { name: /lancer le rendu/i })
                .or(page.getByRole('button', { name: /render/i }))
                .click(),
        ]);

        const payload = renderRequest.postDataJSON() as Record<string, any> | null;

        // Vérifier la présence des champs clés dans le payload de rendu
        expect(payload).toHaveProperty('media_scene_overrides');
        expect(payload).toHaveProperty('style_effects');
        expect(payload).toHaveProperty('style_transitions');
        expect(payload).toHaveProperty('style_color_palette');
        expect(payload).toHaveProperty('style_music_hint');

        if (payload && typeof payload === 'object') {
            // Vérifier la présence des champs clés dans le payload de rendu
            expect(payload).toHaveProperty('media_scene_overrides');
            expect(payload).toHaveProperty('style_effects');
            expect(payload).toHaveProperty('style_transitions');
            expect(payload).toHaveProperty('style_color_palette');
            expect(payload).toHaveProperty('style_music_hint');
        }

        // Optionnel : si la réponse JSON de génération contient un job_id, on peut aller plus loin
        // en appelant /api/media/jobs/{job_id} pour vérifier audio_cue_map.
        // Cela dépend de la structure exacte de la réponse et peut être activé plus tard si besoin.
    });
});

