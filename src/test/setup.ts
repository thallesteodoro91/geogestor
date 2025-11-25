/**
 * @fileoverview Configuração global para testes
 */

import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Estende expect com matchers do testing-library
expect.extend(matchers);

// Limpa após cada teste
afterEach(() => {
  cleanup();
});
