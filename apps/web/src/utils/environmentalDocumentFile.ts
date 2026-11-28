export function environmentalPdfUrl(base64: string) {
  const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
}
export function downloadEnvironmentalPdf(base64: string, fileName: string) {
  const url = environmentalPdfUrl(base64);
  const link = document.createElement('a'); link.href = url; link.download = fileName;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function prepareEnvironmentalDocumentLogo(source: unknown): Promise<{ renderedLogo?: string; sourceLogoHash?: string }> {
  if (typeof source !== 'string' || !source.startsWith('data:image/webp;base64,')) return {};
  const image = new Image();
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Não foi possível ler o logotipo. Revise a imagem da empresa nas configurações.')); image.src = source; });
  const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar o logotipo para o PDF.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  return { renderedLogo: canvas.toDataURL('image/png'), sourceLogoHash: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') };
}
