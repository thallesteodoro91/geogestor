import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accessibleAccentOnWhite,
  DOCUMENT_ACCENT_OPTIONS,
  documentContrastRatio,
  documentTextColorForBackground
} from './documentContrast';

test('todas as cores corporativas recebem texto com contraste AA para conteúdo pequeno', () => {
  for (const option of DOCUMENT_ACCENT_OPTIONS) {
    const text = documentTextColorForBackground(option.hex);
    assert.ok(documentContrastRatio(text, option.hex) >= 4.5, `${option.name} não alcançou contraste AA.`);
  }
});

test('cores usadas como texto sobre branco são escurecidas quando necessário', () => {
  for (const option of DOCUMENT_ACCENT_OPTIONS) {
    const accessibleAccent = accessibleAccentOnWhite(option.hex);
    assert.ok(documentContrastRatio(accessibleAccent, '#ffffff') >= 4.5, `${option.name} não alcançou contraste AA sobre branco.`);
  }
});

test('cores personalizadas intermediárias também garantem contraste AA nos cabeçalhos', () => {
  for (let r = 0; r <= 255; r += 17) {
    for (let g = 0; g <= 255; g += 17) {
      for (let b = 0; b <= 255; b += 17) {
        const background = `#${[r, g, b].map(value => value.toString(16).padStart(2, '0')).join('')}`;
        assert.ok(documentContrastRatio(documentTextColorForBackground(background), background) >= 4.5, background);
      }
    }
  }
});
