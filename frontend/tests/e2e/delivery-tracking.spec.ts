import { expect, test } from '@playwright/test';

const DELIVERY_ID = 'DEL-123456';

const deliverySummary = {
    id: DELIVERY_ID,
    kind: 'parcel',
    status: 'assigned',
    pickup: {
        label: 'Magasin Yukpo Akwa',
        address: 'Rue des Manguiers, Douala',
        latitude: 4.051056,
        longitude: 9.767868,
    },
    dropoff: {
        label: 'Client Bonapriso',
        address: 'Avenue des Cocotiers, Douala',
        latitude: 4.03935,
        longitude: 9.70833,
    },
    checkpoints: [
        {
            status: 'pending',
            timestamp: '2025-11-10T08:10:00.000Z',
            note: 'Commande enregistrée',
            actor: 'system',
        },
        {
            status: 'assigned',
            timestamp: '2025-11-10T08:15:00.000Z',
            note: 'Coursier Yvan assigné',
            actor: 'system',
        },
    ],
    courier: {
        id: 'courier-042',
        name: 'Yvan B.',
        phone: '+237650000000',
        vehicleType: 'bike',
        isOnline: true,
    },
    recipient: {
        id: 'recipient-221',
        name: 'Aline Mbarga',
        phone: '+237670000000',
        consentGranted: true,
        allowTracking: true,
    },
    pricing: {
        currency: 'XAF',
        estimatedTotal: 4800,
        distanceFee: 1200,
        baseFee: 2500,
        shoppingAdvance: 1100,
    },
    metadata: {
        priority: 'express',
    },
    lastEventAt: '2025-11-10T08:15:00.000Z',
};

test.describe('Delivery tracking experience', () => {
    test('courier dashboard renders and handles realtime updates', async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem('token', [
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
                'eyJzdWIiOiJ0ZXN0LXVzZXIiLCJleHAiOjQ3OTk2NzIwMDB9',
                'c2lnbmF0dXJl',
            ].join('.'));

            class MockWebSocket {
                public url: string;
                public readyState = MockWebSocket.OPEN;
                public onopen: ((event: Event) => void) | null = null;
                public onmessage: ((event: MessageEvent) => void) | null = null;
                public onclose: ((event: CloseEvent) => void) | null = null;
                public onerror: ((error: Event) => void) | null = null;

                constructor(url: string) {
                    this.url = url;
                    (window as any).__mockWebSockets = (window as any).__mockWebSockets ?? [];
                    (window as any).__mockWebSockets.push(this);
                    queueMicrotask(() => {
                        this.onopen?.(new Event('open'));
                    });
                }

                close(code?: number, reason?: string) {
                    this.readyState = MockWebSocket.CLOSED;
                    this.onclose?.(new CloseEvent('close', { code: code ?? 1000, reason, wasClean: true }));
                }

                send(_data: string) {
                    // noop – intercepted by tests
                }

                __emit(payload: unknown) {
                    this.onmessage?.(
                        new MessageEvent('message', {
                            data: JSON.stringify(payload),
                        }),
                    );
                }

                static OPEN = 1;
                static CLOSED = 3;
            }

            // @ts-ignore override global
            window.WebSocket = MockWebSocket;
        });

        await page.route(/.*\/deliveries\/active$/, route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({ deliveries: [] }),
                headers: { 'content-type': 'application/json' },
            });
        });

        await page.route(new RegExp(`/deliveries/${DELIVERY_ID}$`), route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify(deliverySummary),
                headers: { 'content-type': 'application/json' },
            });
        });

        await page.route(new RegExp(`/deliveries/${DELIVERY_ID}/recipient/updates$`), route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({ updates: [] }),
                headers: { 'content-type': 'application/json' },
            });
        });

        await page.goto(`/delivery/${DELIVERY_ID}/tracking`);

        await expect(page.getByRole('heading', { name: 'Suivi en temps réel' })).toBeVisible();
        await expect(page.getByText('Coursier assigné')).toBeVisible();
        await expect(page.getByText('Yvan B.')).toBeVisible();
        await expect(page.getByText('Client Bonapriso')).toBeVisible();

        await page.evaluate(() => {
            const sockets = (window as any).__mockWebSockets as Array<{ __emit: (payload: unknown) => void }> | undefined;
            sockets?.[0]?.__emit({
                type: 'delivery_status',
                delivery_id: 'DEL-123456',
                timestamp: '2025-11-10T08:30:00.000Z',
                payload: {
                    status: 'delivered',
                    note: 'Colis remis au client',
                },
            });
        });

        await expect(page.getByText('Livraison terminée')).toBeVisible();
        await expect(page.getByText('Colis remis au client')).toBeVisible();
    });
});



