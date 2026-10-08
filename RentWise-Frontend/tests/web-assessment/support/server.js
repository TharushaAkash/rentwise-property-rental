import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { property, agreement, maintenance } from './fixtures';
export { http, HttpResponse };
export const server = setupServer(
  http.post('*/agentic/workflow/maintenance-triage', () => HttpResponse.json({ message: 'AI triage unavailable' }, { status: 503 })),
  http.get('*/agreements/mine', () => HttpResponse.json([agreement])),
  http.get('*/maintenance-requests/mine', () => HttpResponse.json([maintenance])),
  http.get('*/properties/browse', () => HttpResponse.json({ items: [property], hasMore: false })),
  http.get('*/properties', () => HttpResponse.json([property])),
  http.get('*/property-applications', () => HttpResponse.json([])),
  http.get('*/service-providers', () => HttpResponse.json([])),
  http.get('*/properties/p-1', () => HttpResponse.json(property)),
);
