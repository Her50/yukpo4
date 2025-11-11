const express = require('express');

const app = express();
app.use(express.json());

const port = Number(process.env.MOCK_SERVER_PORT || 4000);

const deliveries = {
    'DEL-123456': {
        id: 'DEL-123456',
        kind: 'shopping',
        status: 'assigned',
        clientId: 'client-1',
        pickup: {
            label: 'Supermarché Bonapriso',
            latitude: 3.8981,
            longitude: 11.5012,
        },
        dropoff: {
            label: 'Client Bonapriso',
            latitude: 3.9033,
            longitude: 11.5021,
        },
        recipient: {
            id: 'recipient-1',
            name: 'Aline Mbarga',
            phone: '+237650000001',
            allowTracking: true,
            consentGranted: true,
        },
        courier: {
            id: 'courier-9',
            name: 'Yvan B.',
            phone: '+237670000009',
            vehicleType: 'bike',
            etaMinutes: 12,
        },
        pricing: {
            currency: 'XAF',
            estimatedTotal: 5400,
            distanceFee: 1400,
            baseFee: 2500,
            shoppingAdvance: 1500,
        },
        checkpoints: [
            {
                status: 'pending',
                timestamp: '2025-11-10T08:00:00.000Z',
                note: 'Commande confirmée',
            },
            {
                status: 'assigned',
                timestamp: '2025-11-10T08:05:00.000Z',
                note: 'Coursier en route vers le magasin',
            },
        ],
        metadata: {
            last_location: {
                lat: 3.899,
                lng: 11.5018,
                updatedAt: '2025-11-10T08:15:00.000Z',
            },
        },
        shopping: {
            items: [
                {
                    id: 'item-1',
                    label: 'Tomates fraîches',
                    quantity: 3,
                    unit: 'kg',
                    estimatedTotal: 2100,
                },
                {
                    id: 'item-2',
                    label: 'Huile végétale',
                    quantity: 1,
                    unit: 'L',
                    estimatedTotal: 1800,
                },
            ],
            currency: 'XAF',
        },
        lastEventAt: '2025-11-10T08:05:00.000Z',
    },
};

app.get('/api/deliveries/active', (_req, res) => {
    res.json({
        success: true,
        data: {
            deliveries: Object.values(deliveries),
        },
    });
});

app.get('/api/deliveries/:id', (req, res) => {
    const delivery = deliveries[req.params.id];
    if (!delivery) {
        return res.status(404).json({
            success: false,
            error: 'Delivery not found',
        });
    }

    res.json({
        success: true,
        data: {
            delivery,
        },
    });
});

app.get('/api/deliveries/:id/recipient/updates', (_req, res) => {
    res.json({
        success: true,
        data: [],
    });
});

app.post('/api/deliveries/:id/recipient/location', (req, res) => {
    const delivery = deliveries[req.params.id];
    if (delivery) {
        delivery.recipient = delivery.recipient || {};
        delivery.recipient.currentLocation = {
            latitude: req.body.latitude,
            longitude: req.body.longitude,
            source: req.body.source ?? 'recipient',
            timestamp: new Date().toISOString(),
        };
    }

    res.json({
        success: true,
    });
});

app.post('/api/deliveries/:id/status', (req, res) => {
    const delivery = deliveries[req.params.id];
    if (delivery) {
        delivery.status = req.body.status ?? delivery.status;
        delivery.checkpoints.push({
            status: delivery.status,
            timestamp: new Date().toISOString(),
            note: req.body.metadata?.note,
        });
        delivery.lastEventAt = new Date().toISOString();
    }

    res.json({
        success: true,
    });
});

app.post('/api/deliveries/:id/cancel', (_req, res) => {
    res.json({
        success: true,
    });
});

app.post('/api/wallet/debit', (_req, res) => {
    res.json({
        success: true,
    });
});

app.post('/api/wallet/refund', (_req, res) => {
    res.json({
        success: true,
    });
});

const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[mock-server] Listening on port ${port}`);
});

const shutdown = () => {
    console.log('[mock-server] Shutting down');
    server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

