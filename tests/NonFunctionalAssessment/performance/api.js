import http from 'k6/http';
import { check, sleep } from 'k6';
const base = (__ENV.API_BASE_URL || 'https://rentwise-api-v2-athfc8b8g7c2ahfc.eastasia-01.azurewebsites.net/api').replace(/\/$/, '');
if (!base || !base.endsWith('/api')) throw new Error('Set API_BASE_URL to the real API URL ending in /api');
const profile = __ENV.PROFILE || 'normal';
const profiles = {
  normal: { vus: 1, duration: '1m' },
  load: { stages: [{ duration: '30s', target: 5 }, { duration: '1m', target: 10 }, { duration: '30s', target: 0 }] },
  stress: { stages: [{ duration: '30s', target: 10 }, { duration: '30s', target: 25 }, { duration: '1m', target: 50 }, { duration: '30s', target: 0 }] },
};
if (!profiles[profile]) throw new Error('PROFILE must be normal, load or stress');
export const options = {
  ...profiles[profile],
  thresholds: {
    http_req_duration: [`p(95)<${__ENV.P95_MS || (profile === 'stress' ? 3000 : 1500)}`],
    http_req_failed: [{ threshold: `rate<${profile === 'stress' ? 0.05 : 0.01}`, abortOnFail: profile === 'stress', delayAbortEval: '30s' }],
    checks: ['rate>0.99'],
  },
};
export default function () {
  const response = http.get(`${base}/properties/browse?pageSize=12`, { tags: { endpoint: 'browse', profile }, timeout: '10s' });
  check(response, { 'browse is 200': r => r.status === 200, 'browse returns items array': r => { try { return Array.isArray(r.json().items); } catch { return false; } } });
  if (__ENV.PROPERTY_ID) {
    const detail = http.get(`${base}/properties/${encodeURIComponent(__ENV.PROPERTY_ID)}`, { tags: { endpoint: 'detail', profile }, timeout: '10s' });
    check(detail, { 'detail is 200': r => r.status === 200, 'detail matches ID': r => { try { return String(r.json().id) === __ENV.PROPERTY_ID; } catch { return false; } } });
  }
  sleep(1);
}
