import { by, device, element, expect } from 'detox';

describe('Video wizard – storyboard IA + preview courte', () => {
    beforeAll(async () => {
        await device.launchApp({ newInstance: true });
    });

    it('brief → storyboard IA → timeline → preview courte', async () => {
        // 1) Accès au wizard vidéo (adapter ces IDs à tes vrais testIDs)
        await element(by.id('home-create-video-button')).tap();
        await expect(element(by.id('video-wizard-screen'))).toBeVisible();

        // 2) Brief / contexte
        await element(by.id('video-brief-input')).replaceText(
            'Promo livraison express ce week-end avec réduction spéciale.',
        );
        await element(by.id('video-headline-input')).replaceText('Livraison express Yukpo');
        await element(by.id('video-cta-input')).replaceText('Commander maintenant');

        // 3) Storyboard IA
        await element(by.id('video-storyboard-generate-button')).tap();
        await expect(element(by.id('video-storyboard-scene-0'))).toBeVisible();

        // 4) Timeline hydratée (carrousel S1/S2…)
        await expect(element(by.id('video-timeline-chip-0'))).toBeVisible();
        await expect(element(by.id('video-timeline-chip-1'))).toBeVisible();

        // 5) Step 3 (résumé) puis preview courte
        await element(by.id('video-next-step-button')).tap(); // -> médias / timeline
        await element(by.id('video-next-step-button')).tap(); // -> résumé

        await element(by.id('video-preview-short-button')).tap();

        // On s’attend à un retour utilisateur (toast / flag testID) indiquant le lancement de la preview.
        // Ajuster ce testID une fois que l’app en expose un fiable.
        await expect(element(by.id('video-preview-short-started'))).toBeVisible();
    });
});


