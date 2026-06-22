import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractReceipt, IngestaError, parseStatement } from './ingesta';

const FILE = new File(['x'], 'r.jpg', { type: 'image/jpeg' });
const OK_RECEIPT = {
  amount: 1234.5,
  currency: 'ARS',
  date: '2026-05-01',
  merchant: 'Coto',
  confidence: 0.8,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(impl: typeof fetch) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

describe('extractReceipt', () => {
  it('postea multipart con el Bearer token y devuelve el JSON', async () => {
    stubFetch(async (url, init) => {
      expect(String(url)).toBe('https://micro.test/v1/receipts:extract');
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
      expect(init?.body).toBeInstanceOf(FormData);
      return new Response(JSON.stringify(OK_RECEIPT), { status: 200 });
    });

    const res = await extractReceipt(FILE, {
      baseUrl: 'https://micro.test',
      accessToken: 'tok',
    });
    expect(res).toEqual(OK_RECEIPT);
  });

  it('normaliza la barra final de baseUrl', async () => {
    stubFetch(async (url) => {
      expect(String(url)).toBe('https://micro.test/v1/receipts:extract');
      return new Response(JSON.stringify(OK_RECEIPT), { status: 200 });
    });
    await extractReceipt(FILE, { baseUrl: 'https://micro.test/', accessToken: 'tok' });
  });

  it('falla con IngestaError si falta la baseUrl', async () => {
    await expect(extractReceipt(FILE, { baseUrl: undefined, accessToken: 'tok' })).rejects.toThrow(
      IngestaError,
    );
  });

  it('falla con 401 si no hay token', async () => {
    await expect(
      extractReceipt(FILE, { baseUrl: 'https://micro.test', accessToken: undefined }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('propaga el status en respuestas no-2xx', async () => {
    stubFetch(async () => new Response('nope', { status: 500 }));
    await expect(
      extractReceipt(FILE, { baseUrl: 'https://micro.test', accessToken: 'tok' }),
    ).rejects.toMatchObject({ status: 500 });
  });
});

describe('parseStatement', () => {
  it('incluye la password en el form cuando se pasa', async () => {
    stubFetch(async (_url, init) => {
      const body = init?.body as FormData;
      expect(body.get('password')).toBe('12345678');
      return new Response(JSON.stringify({ account_hint: {}, rows: [] }), { status: 200 });
    });
    await parseStatement(FILE, {
      baseUrl: 'https://micro.test',
      accessToken: 'tok',
      password: '12345678',
    });
  });
});
