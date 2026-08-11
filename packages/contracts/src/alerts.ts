import { z } from 'zod';

export const AlertCategorySchema = z.enum([
  'project',
  'task',
  'receivable',
  'payable',
  'budget',
  'license',
  'condition',
  'appointment',
  'crm'
]);

export const AlertRecurrenceSchema = z.enum(['daily', 'interval', 'once']);
export const AlertSeveritySchema = z.enum(['info', 'warning', 'critical']);

export type AlertCategory = z.infer<typeof AlertCategorySchema>;
export type AlertRecurrence = z.infer<typeof AlertRecurrenceSchema>;
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;

export const ALERT_CATEGORY_LABELS: Record<AlertCategory, string> = {
  project: 'Projetos e serviços',
  task: 'Tarefas',
  receivable: 'Contas a receber',
  payable: 'Contas a pagar',
  budget: 'Orçamentos',
  license: 'Licenças ambientais',
  condition: 'Condicionantes',
  appointment: 'Agenda',
  crm: 'CRM'
};

export const AlertCategoryConfigSchema = z.object({
  category: AlertCategorySchema,
  enabled: z.boolean(),
  daysBefore: z.number().int().min(0).max(365),
  recurrence: AlertRecurrenceSchema,
  intervalDays: z.number().int().min(1).max(90),
  alertOnDueDate: z.boolean(),
  keepOverdue: z.boolean()
});

export const AlertSettingsSchema = z.object({
  enabled: z.boolean(),
  nativeEnabled: z.boolean(),
  categories: z.array(AlertCategoryConfigSchema)
});

export type AlertCategoryConfig = z.infer<typeof AlertCategoryConfigSchema>;
export type AlertSettings = z.infer<typeof AlertSettingsSchema>;

export interface DeadlineAlert {
  id: string;
  occurrenceKey: string;
  category: AlertCategory;
  categoryLabel: string;
  sourceId: string;
  title: string;
  description: string;
  dueDate: string;
  daysUntilDue: number;
  timingLabel: string;
  severity: AlertSeverity;
  link: string;
  readAt: string | null;
  nativeNotifiedAt: string | null;
  createdAt: string;
}

export interface DeadlineAlertResponse {
  items: DeadlineAlert[];
  settings: AlertSettings;
  generatedAt: string;
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  enabled: true,
  nativeEnabled: true,
  categories: AlertCategorySchema.options.map((category) => ({
    category,
    enabled: true,
    daysBefore: 7,
    recurrence: 'daily' as const,
    intervalDays: 1,
    alertOnDueDate: true,
    keepOverdue: true
  }))
};

