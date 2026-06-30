/**
 * Hash SHA-256 del contenido de un archivo (F2-13), para detectar "ya subiste este
 * comprobante". Puro respecto de Supabase. Usa `crypto.subtle` (Web Crypto), disponible
 * en el navegador y en Node 18+. Si no está disponible, devuelve `null` y el llamador
 * degrada a la detección por datos (monto+fecha), sin romper.
 */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
