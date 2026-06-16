import { describe, it, expect, vi, afterEach } from 'vitest';

// La Custom App de Shopify debe estar "configurada" para instanciar el cliente:
// se fijan ANTES del primer getEnv() (que memoiza). server-only está aliasado en
// vitest y getEnv() no se invoca al importar, solo al construir el cliente.
process.env.SHOPIFY_STORE_DOMAIN = 'test-store.myshopify.com';
process.env.SHOPIFY_ADMIN_TOKEN = 'shpat_test';

import { ShopifyClient, ShopifyApiError } from '../lib/shopify/client';

/** Respuesta tipo fetch: GraphQL responde 200 incluso con errores de aplicación. */
function res(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
    headers: { get: () => null },
  } as unknown as Response;
}

function node(id: string, title: string, amount: string | null | undefined, sku: string | null = null) {
  const inventoryItem = amount === undefined ? null : { unitCost: amount === null ? null : { amount } };
  return { id, title, handle: title.toLowerCase(), variants: { nodes: [{ sku, inventoryItem }] } };
}

function page(opts: {
  nodes?: ReturnType<typeof node>[];
  hasNextPage?: boolean;
  endCursor?: string | null;
}) {
  return { data: { products: { pageInfo: { hasNextPage: opts.hasNextPage ?? false, endCursor: opts.endCursor ?? null }, nodes: opts.nodes ?? [] } } };
}

/** Mock de fetch que devuelve respuestas en orden (cola). */
function mockFetch(responses: Response[]) {
  const fn = vi.fn();
  responses.forEach((r) => fn.mockResolvedValueOnce(r));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ShopifyClient.fetchAllProductCosts', () => {
  it('parsea el costo: 0/negativo/no-numérico/vacío → null; positivo → redondeado', async () => {
    mockFetch([
      res(
        page({
          nodes: [
            node('gid://shopify/Product/1', 'A', null),
            node('gid://shopify/Product/2', 'B', ''),
            node('gid://shopify/Product/3', 'C', 'abc'),
            node('gid://shopify/Product/4', 'D', '0.00'),
            node('gid://shopify/Product/5', 'E', '-5'),
            node('gid://shopify/Product/6', 'F', '12345.67'),
            node('gid://shopify/Product/7', 'G', undefined),
          ],
        }),
      ),
    ]);
    const { rows, missingInventoryScope } = await new ShopifyClient().fetchAllProductCosts();
    expect(missingInventoryScope).toBe(false);
    expect(rows.map((r) => r.unitCost)).toEqual([null, null, null, null, null, 12346, null]);
  });

  it('convierte el gid de Shopify a id numérico', async () => {
    mockFetch([res(page({ nodes: [node('gid://shopify/Product/987654', 'X', '100')] }))]);
    const { rows } = await new ShopifyClient().fetchAllProductCosts();
    expect(rows[0].shopifyProductId).toBe('987654');
  });

  it('ACCESS_DENIED citando read_inventory → missingInventoryScope (sin filas, sin throw)', async () => {
    mockFetch([
      res({
        errors: [{ message: 'Access denied for inventoryItem field. Required access: `read_inventory` access scope.', extensions: { code: 'ACCESS_DENIED' } }],
      }),
    ]);
    const { rows, missingInventoryScope } = await new ShopifyClient().fetchAllProductCosts();
    expect(missingInventoryScope).toBe(true);
    expect(rows).toEqual([]);
  });

  it('un error que solo menciona unitCost (sin access denied/read_inventory) se PROPAGA, no se disfraza de scope', async () => {
    mockFetch([res({ errors: [{ message: 'Internal error resolving unitCost', extensions: { code: 'INTERNAL_SERVER_ERROR' } }] })]);
    await expect(new ShopifyClient().fetchAllProductCosts()).rejects.toBeInstanceOf(ShopifyApiError);
  });

  it('pagina: concatena filas y reenvía el endCursor', async () => {
    const fn = mockFetch([
      res(page({ nodes: [node('gid://shopify/Product/1', 'A', '100')], hasNextPage: true, endCursor: 'CURSOR1' })),
      res(page({ nodes: [node('gid://shopify/Product/2', 'B', '200')], hasNextPage: false })),
    ]);
    const { rows } = await new ShopifyClient().fetchAllProductCosts();
    expect(rows.map((r) => r.shopifyProductId)).toEqual(['1', '2']);
    // La 2ª llamada debe llevar el cursor de la 1ª página.
    const secondBody = JSON.parse((fn.mock.calls[1][1] as { body: string }).body);
    expect(secondBody.variables.cursor).toBe('CURSOR1');
  });

  it('THROTTLED (HTTP 200) se reintenta esperando la recarga del bucket, luego avanza', async () => {
    mockFetch([
      res({
        errors: [{ message: 'Throttled', extensions: { code: 'THROTTLED' } }],
        extensions: { cost: { requestedQueryCost: 2, throttleStatus: { currentlyAvailable: 0, restoreRate: 1000 } } },
      }),
      res(page({ nodes: [node('gid://shopify/Product/9', 'Z', '500')] })),
    ]);
    const { rows, missingInventoryScope } = await new ShopifyClient().fetchAllProductCosts();
    expect(missingInventoryScope).toBe(false);
    expect(rows.map((r) => r.unitCost)).toEqual([500]);
  });
});
