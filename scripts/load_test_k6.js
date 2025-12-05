// ✅ Phase 5: Test de charge avec k6 pour millions de requêtes

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';

// ✅ Métriques personnalisées
const errorRate = new Rate('errors');
const videoJobDuration = new Trend('video_job_duration');

export const options = {
    stages: [
        { duration: '2m', target: 1000 },   // ✅ Montée à 1000 utilisateurs
        { duration: '5m', target: 1000 }, // ✅ Maintien à 1000 utilisateurs
        { duration: '2m', target: 2000 },  // ✅ Montée à 2000 utilisateurs
        { duration: '5m', target: 2000 }, // ✅ Maintien à 2000 utilisateurs
        { duration: '2m', target: 0 },     // ✅ Descente
    ],
    thresholds: {
        http_req_duration: ['p(95)<5000'],  // ✅ 95% des requêtes < 5s
        http_req_failed: ['rate<0.01'],     // ✅ Taux d'erreur < 1%
        errors: ['rate<0.01'],
    },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export default function () {
    const headers = {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
    };

    // ✅ Test 1: Création de session
    const sessionPayload = JSON.stringify({
        service_id: 1,
        brief: { raw: 'Test video creation' },
        distribution_plan: ['TikTok', 'Instagram'],
    });

    const sessionRes = http.post(`${BASE_URL}/api/studio/sessions`, sessionPayload, { headers });
    const sessionCreated = check(sessionRes, {
        'session created': (r) => r.status === 200,
        'response time < 2s': (r) => r.timings.duration < 2000,
    });
    errorRate.add(!sessionCreated);

    if (sessionRes.status === 200) {
        const session = sessionRes.json();
        const sessionId = session.session?.id;

        if (sessionId) {
            // ✅ Test 2: Génération de storyboard
            const storyboardPayload = JSON.stringify({
                script_outline: ['Scene 1', 'Scene 2', 'Scene 3'],
                product_name: 'Test Product',
                duration_seconds: 30,
            });

            const storyboardRes = http.post(
                `${BASE_URL}/api/studio/sessions/${sessionId}/storyboard`,
                storyboardPayload,
                { headers }
            );
            check(storyboardRes, {
                'storyboard generated': (r) => r.status === 200,
            });
            errorRate.add(storyboardRes.status !== 200);

            // ✅ Test 3: Génération de preview
            const previewRes = http.post(
                `${BASE_URL}/api/studio/sessions/${sessionId}/preview`,
                {},
                { headers, timeout: '300s' }
            );

            const previewDuration = previewRes.timings.duration;
            videoJobDuration.add(previewDuration);

            check(previewRes, {
                'preview generated': (r) => r.status === 200 || r.status === 202,
                'preview duration < 5min': () => previewDuration < 300000,
            });
            errorRate.add(previewRes.status >= 400);
        }
    }

    sleep(1);
}

export function handleSummary(data) {
    return {
        'summary.json': JSON.stringify(data, null, 2),
        'summary.html': htmlReport(data),
    };
}

function htmlReport(data) {
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>K6 Load Test Results</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          .metric { margin: 10px 0; padding: 10px; background: #f5f5f5; }
        </style>
      </head>
      <body>
        <h1>✅ Phase 5: Test de Charge - Résultats</h1>
        <div class="metric">
          <h2>Résumé</h2>
          <p>Total Requêtes: ${data.metrics.http_reqs.values.count}</p>
          <p>Requêtes/sec: ${data.metrics.http_reqs.values.rate.toFixed(2)}</p>
          <p>Taux d'erreur: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%</p>
          <p>Latence p95: ${(data.metrics.http_req_duration.values.p95 / 1000).toFixed(2)}s</p>
        </div>
      </body>
    </html>
  `;
}

