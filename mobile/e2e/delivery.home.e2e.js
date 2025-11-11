const { spawn } = require('child_process');

let mockServerProcess;

describe('Delivery Home Flow', () => {
    beforeAll(async () => {
        mockServerProcess = spawn('node', ['e2e/mock-server.js'], {
            stdio: 'inherit',
            env: {
                ...process.env,
                MOCK_SERVER_PORT: process.env.MOCK_SERVER_PORT || '4000',
            },
        });

        await new Promise((resolve) => setTimeout(resolve, 1500));

        await device.launchApp({
            newInstance: true,
            permissions: { location: 'always' },
        });
    });

    afterAll(async () => {
        if (mockServerProcess) {
            mockServerProcess.kill();
        }
    });

    it('affiche la page accueil livraison', async () => {
        await expect(element(by.text('Livraison intelligente Yukpo'))).toBeVisible();
        await expect(element(by.text('Courses supermarché'))).toBeVisible();
        await expect(element(by.text('Vos livraisons actives'))).toBeVisible();
    });

    it('ouvre la page tracking depuis la carte active', async () => {
        await element(by.text('Suivre')).atIndex(0).tap();
        await expect(element(by.text('Timeline'))).toBeVisible();
        await expect(element(by.text('Panier'))).toBeVisible();
        await expect(element(by.text('Livraison #123456'))).toBeVisible();
    });
});

