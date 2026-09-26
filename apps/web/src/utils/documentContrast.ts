const DARK_DOCUMENT_TEXT = '#18181b';
const LIGHT_DOCUMENT_TEXT = '#ffffff';

function normalizeHex(hex: string) {
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : '#4f46e5';
}

function relativeLuminance(hex: string) {
  const normalized = normalizeHex(hex);
  const channels = normalized.slice(1).match(/.{2}/g)!.map((channel) => Number.parseInt(channel, 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function documentContrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function documentTextColorForBackground(background: string) {
  return documentContrastRatio(DARK_DOCUMENT_TEXT, background) >= documentContrastRatio(LIGHT_DOCUMENT_TEXT, background)
    ? DARK_DOCUMENT_TEXT
    : LIGHT_DOCUMENT_TEXT;
}

export function accessibleAccentOnWhite(accent: string, minimumRatio = 4.5) {
  const normalized = normalizeHex(accent);
  if (documentContrastRatio(normalized, LIGHT_DOCUMENT_TEXT) >= minimumRatio) return normalized;

  const channels = normalized.slice(1).match(/.{2}/g)!.map((channel) => Number.parseInt(channel, 16));
  for (let factor = 0.96; factor >= 0.35; factor -= 0.02) {
    const candidate = `#${channels
      .map((channel) => Math.round(channel * factor).toString(16).padStart(2, '0'))
      .join('')}`;
    if (documentContrastRatio(candidate, LIGHT_DOCUMENT_TEXT) >= minimumRatio) return candidate;
  }
  return DARK_DOCUMENT_TEXT;
}

export const DOCUMENT_ACCENT_OPTIONS = [
  { name: 'verde esmeralda', hex: '#059669' },
  { name: 'índigo', hex: '#4f46e5' },
  { name: 'azul', hex: '#2563eb' },
  { name: 'âmbar', hex: '#d97706' },
  { name: 'rosa', hex: '#e11d48' },
  { name: 'grafite', hex: '#27272a' }
] as const;
