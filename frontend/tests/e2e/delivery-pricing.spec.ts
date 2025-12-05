// ✅ Tests E2E pour le calcul des coûts de livraison
import { expect, test } from '@playwright/test';

test.describe('Calcul Coût Livraison', () => {
    test.beforeEach(async ({ page }) => {
        // Se connecter
        await page.goto('/login');
        await page.fill('input[type="email"]', 'test@example.com');
        await page.fill('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForURL('/');
    });

    test('Estimation coûts - Distance courte (minimum)', async ({ page }) => {
        // 1. Aller sur un produit avec livraison
        await page.goto('/services/1');

        // 2. Cliquer "Commander"
        await page.click('button:has-text("Commander")');

        // 3. Vérifier modal OrderDeliveryModal
        await expect(page.locator('text=Commander la livraison')).toBeVisible();

        // 4. Sélectionner dropoff très proche (simuler GPS proche)
        // Note: Nécessite mock GPS ou sélection manuelle

        // 5. Vérifier estimation affichée
        // Coût livraison doit être minimum 1000 FCFA
        const deliveryCost = await page.locator('[data-testid="delivery-cost"]').textContent();
        expect(parseInt(deliveryCost || '0')).toBeGreaterThanOrEqual(1000);
    });

    test('Estimation coûts - Distance moyenne', async ({ page }) => {
        await page.goto('/services/1');
        await page.click('button:has-text("Commander")');

        // Sélectionner dropoff à ~5 km
        // Vérifier coût ~2500 FCFA
        const deliveryCost = await page.locator('[data-testid="delivery-cost"]').textContent();
        const cost = parseInt(deliveryCost?.replace(/[^0-9]/g, '') || '0');
        expect(cost).toBeGreaterThanOrEqual(2000);
        expect(cost).toBeLessThanOrEqual(3000);
    });

    test('Estimation coûts - Billing mode merchant_inclusive', async ({ page }) => {
        // Produit avec billing_mode = merchant_inclusive
        await page.goto('/services/2'); // Service avec livraison gratuite

        await page.click('button:has-text("Commander")');

        // Vérifier badge "Livraison gratuite"
        await expect(page.locator('text=Gratuite')).toBeVisible();

        // Vérifier total = prix produit seulement
        const totalCost = await page.locator('[data-testid="total-cost"]').textContent();
        const productCost = await page.locator('[data-testid="product-cost"]').textContent();

        expect(totalCost).toBe(productCost);
    });

    test('Estimation coûts - Produit avec promotion', async ({ page }) => {
        // Produit avec promotion active
        await page.goto('/services/3');

        // Vérifier badge PROMO
        await expect(page.locator('text=PROMO')).toBeVisible();

        await page.click('button:has-text("Commander")');

        // Vérifier prix réduit affiché
        const productPrice = await page.locator('[data-testid="product-price"]').textContent();
        const originalPrice = await page.locator('[data-testid="original-price"]').textContent();

        expect(parseInt(productPrice?.replace(/[^0-9]/g, '') || '0'))
            .toBeLessThan(parseInt(originalPrice?.replace(/[^0-9]/g, '') || '0'));
    });

    test('Création commande - Vérification réservation paiement', async ({ page }) => {
        await page.goto('/services/1');
        await page.click('button:has-text("Commander")');

        // Remplir formulaire
        await page.fill('textarea[placeholder*="instructions"]', 'Test');

        // Confirmer commande
        await page.click('button:has-text("Confirmer la commande")');

        // Vérifier message succès
        await expect(page.locator('text=Commande créée')).toBeVisible();

        // Vérifier redirection ou modal fermé
        // TODO: Vérifier réservation créée en DB (nécessite API test)
    });

    test('Erreur - Solde insuffisant', async ({ page }) => {
        // Utilisateur avec solde insuffisant
        // Mock solde = 1000 FCFA
        // Produit = 5000 FCFA + Livraison = 1500 FCFA = 6500 FCFA

        await page.goto('/services/1');
        await page.click('button:has-text("Commander")');

        // Confirmer commande
        await page.click('button:has-text("Confirmer la commande")');

        // Vérifier message d'erreur
        await expect(page.locator('text=Solde insuffisant')).toBeVisible();
    });
});

test.describe('Recalcul Coût après Changement Dropoff', () => {
    test('Changement dropoff - Recalcul automatique', async ({ page }) => {
        // Créer livraison
        // Changer dropoff
        // Vérifier coût recalculé
        // TODO: Implémenter
    });
});

