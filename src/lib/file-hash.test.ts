import { describe, expect, it } from 'vitest';
import { sha256Hex } from './file-hash';

function bytesOf(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

describe('sha256Hex', () => {
  it('hash conocido para entrada vacía', async () => {
    expect(await sha256Hex(new ArrayBuffer(0))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('hash conocido para "abc"', async () => {
    expect(await sha256Hex(bytesOf('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('mismo contenido → mismo hash; distinto → distinto', async () => {
    const a = await sha256Hex(bytesOf('mismo comprobante'));
    const b = await sha256Hex(bytesOf('mismo comprobante'));
    const c = await sha256Hex(bytesOf('otro'));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
