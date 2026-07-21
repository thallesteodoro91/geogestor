PRAGMA foreign_keys = OFF;
--> statement-breakpoint
ALTER TABLE `oportunidades` ADD `deleted_at` text;
--> statement-breakpoint
CREATE TABLE `oportunidades_subjects_v2` (
  `id` text PRIMARY KEY NOT NULL,
  `cliente_id` text,
  `lead_id` text,
  `titulo` text NOT NULL,
  `valor_estimado` integer,
  `estagio` text DEFAULT 'Prospectado' NOT NULL,
  `ordem` integer DEFAULT 0 NOT NULL,
  `responsavel` text,
  `origem` text,
  `servico_tipo` text,
  `proxima_acao` text,
  `proxima_acao_em` text,
  `previsao_fechamento` text,
  `probabilidade_pontos_base` integer DEFAULT 1000 NOT NULL,
  `observacoes` text,
  `motivo_perda` text,
  `encerrado_em` text,
  `ultimo_contato_em` text,
  `orcamento_id` text,
  `projeto_id` text,
  `estagio_alterado_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `deleted_at` text,
  FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`lead_id`) REFERENCES `contatos`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`orcamento_id`) REFERENCES `orcamentos`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `oportunidades_subjects_v2` (
  `id`, `cliente_id`, `lead_id`, `titulo`, `valor_estimado`, `estagio`, `ordem`, `responsavel`,
  `origem`, `servico_tipo`, `proxima_acao`, `proxima_acao_em`, `previsao_fechamento`,
  `probabilidade_pontos_base`, `observacoes`, `motivo_perda`, `encerrado_em`, `ultimo_contato_em`,
  `orcamento_id`, `projeto_id`, `estagio_alterado_em`, `created_at`, `updated_at`, `deleted_at`
)
SELECT
  `id`, `cliente_id`, NULL, `titulo`, `valor_estimado`, `estagio`, `ordem`, `responsavel`,
  `origem`, `servico_tipo`, `proxima_acao`, `proxima_acao_em`, `previsao_fechamento`,
  `probabilidade_pontos_base`, `observacoes`, `motivo_perda`, `encerrado_em`, `ultimo_contato_em`,
  `orcamento_id`, `projeto_id`, coalesce(`estagio_alterado_em`, `updated_at`, `created_at`, CURRENT_TIMESTAMP),
  `created_at`, `updated_at`, `deleted_at`
FROM `oportunidades`;
--> statement-breakpoint
DROP TABLE `oportunidades`;
--> statement-breakpoint
ALTER TABLE `oportunidades_subjects_v2` RENAME TO `oportunidades`;
--> statement-breakpoint
CREATE INDEX `idx_oportunidades_cliente_id` ON `oportunidades` (`cliente_id`);
--> statement-breakpoint
CREATE INDEX `idx_oportunidades_lead_id` ON `oportunidades` (`lead_id`);
--> statement-breakpoint
CREATE INDEX `idx_oportunidades_estagio` ON `oportunidades` (`estagio`);
--> statement-breakpoint
CREATE INDEX `idx_oportunidades_proxima_acao` ON `oportunidades` (`proxima_acao_em`);
--> statement-breakpoint
CREATE INDEX `idx_oportunidades_previsao_fechamento` ON `oportunidades` (`previsao_fechamento`);
--> statement-breakpoint
CREATE INDEX `idx_oportunidades_orcamento_id` ON `oportunidades` (`orcamento_id`);
--> statement-breakpoint
PRAGMA foreign_keys = ON;
