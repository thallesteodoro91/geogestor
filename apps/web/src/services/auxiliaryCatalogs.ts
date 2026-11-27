import {
  DEFAULT_EXPENSE_CATALOG,
  DEFAULT_SERVICE_CATALOG,
  coerceExpenseCatalog,
  coerceServiceCatalog,
  EXPENSE_CATALOG_KEY,
  ExpenseCatalogSchema,
  SERVICE_CATALOG_KEY,
  ServiceCatalogSchema,
  type ExpenseCatalogItem,
  type ServiceCatalogItem
} from '@geogestor/contracts/src/auxiliary-catalogs';
import { getOperationalSettings, persistOperationalSettings } from './operationalSettings';

export interface AuxiliaryCatalogs {
  services: ServiceCatalogItem[];
  expenses: ExpenseCatalogItem[];
  source: 'database' | 'cache' | 'defaults';
  degraded: boolean;
}

const cloneServices = () => DEFAULT_SERVICE_CATALOG.map((item) => ({ ...item }));
const cloneExpenses = () => DEFAULT_EXPENSE_CATALOG.map((item) => ({ ...item }));

export function parseServiceCatalog(value: unknown): ServiceCatalogItem[] | null {
  return coerceServiceCatalog(value);
}

export function parseExpenseCatalog(value: unknown): ExpenseCatalogItem[] | null {
  return coerceExpenseCatalog(value);
}

function readCache<T>(key: string, parser: (value: unknown) => T[] | null) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : parser(JSON.parse(raw));
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function writeCache(services: ServiceCatalogItem[], expenses: ExpenseCatalogItem[]) {
  try {
    localStorage.setItem(SERVICE_CATALOG_KEY, JSON.stringify(services));
    localStorage.setItem(EXPENSE_CATALOG_KEY, JSON.stringify(expenses));
  } catch {
    // O SQLite já confirmou a leitura. O cache será reconciliado numa próxima hidratação.
  }
}

function hasExplicitStatus(value: unknown) {
  return Array.isArray(value) && value.every((item) => (
    typeof item === 'object' && item !== null && typeof (item as { ativo?: unknown }).ativo === 'boolean'
  ));
}

export async function loadAuxiliaryCatalogs(): Promise<AuxiliaryCatalogs> {
  try {
    const settings = await getOperationalSettings();
    const databaseServices = parseServiceCatalog(settings[SERVICE_CATALOG_KEY]);
    const databaseExpenses = parseExpenseCatalog(settings[EXPENSE_CATALOG_KEY]);
    const hasCanonicalServices = ServiceCatalogSchema.safeParse(settings[SERVICE_CATALOG_KEY]).success
      && hasExplicitStatus(settings[SERVICE_CATALOG_KEY]);
    const hasCanonicalExpenses = ExpenseCatalogSchema.safeParse(settings[EXPENSE_CATALOG_KEY]).success
      && hasExplicitStatus(settings[EXPENSE_CATALOG_KEY]);
    const cachedServices = readCache(SERVICE_CATALOG_KEY, parseServiceCatalog);
    const cachedExpenses = readCache(EXPENSE_CATALOG_KEY, parseExpenseCatalog);
    const services = databaseServices ?? cachedServices ?? cloneServices();
    const expenses = databaseExpenses ?? cachedExpenses ?? cloneExpenses();
    const repairs: Record<string, unknown> = {};
    if (!hasCanonicalServices) repairs[SERVICE_CATALOG_KEY] = services;
    if (!hasCanonicalExpenses) repairs[EXPENSE_CATALOG_KEY] = expenses;
    if (Object.keys(repairs).length) await persistOperationalSettings(repairs, Object.fromEntries(Object.keys(repairs).map((key) => [key, settings[key] ?? null])));
    writeCache(services, expenses);
    return { services, expenses, source: 'database', degraded: false };
  } catch {
    const cachedServices = readCache(SERVICE_CATALOG_KEY, parseServiceCatalog);
    const cachedExpenses = readCache(EXPENSE_CATALOG_KEY, parseExpenseCatalog);
    return {
      services: cachedServices ?? cloneServices(),
      expenses: cachedExpenses ?? cloneExpenses(),
      source: cachedServices || cachedExpenses ? 'cache' : 'defaults',
      degraded: true
    };
  }
}

export async function saveServiceCatalog(services: ServiceCatalogItem[], expected?: ServiceCatalogItem[]) {
  const parsed = ServiceCatalogSchema.parse(services);
  await persistOperationalSettings({ [SERVICE_CATALOG_KEY]: parsed }, expected ? { [SERVICE_CATALOG_KEY]: expected } : undefined);
  return parsed;
}

export async function saveExpenseCatalog(expenses: ExpenseCatalogItem[], expected?: ExpenseCatalogItem[]) {
  const parsed = ExpenseCatalogSchema.parse(expenses);
  await persistOperationalSettings({ [EXPENSE_CATALOG_KEY]: parsed }, expected ? { [EXPENSE_CATALOG_KEY]: expected } : undefined);
  return parsed;
}
