CREATE TABLE `alerta_configuracao` (
  `id` text PRIMARY KEY NOT NULL,
  `habilitado` integer DEFAULT true NOT NULL,
  `notificacao_nativa` integer DEFAULT true NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `alerta_categoria_configuracao` (
  `categoria` text PRIMARY KEY NOT NULL,
  `habilitado` integer DEFAULT true NOT NULL,
  `dias_antecedencia` integer DEFAULT 7 NOT NULL,
  `recorrencia` text DEFAULT 'daily' NOT NULL,
  `intervalo_dias` integer DEFAULT 1 NOT NULL,
  `alertar_no_vencimento` integer DEFAULT true NOT NULL,
  `manter_vencidos` integer DEFAULT true NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `alerta_ocorrencias` (
  `id` text PRIMARY KEY NOT NULL,
  `chave_ocorrencia` text NOT NULL,
  `categoria` text NOT NULL,
  `origem_id` text NOT NULL,
  `data_vencimento` text NOT NULL,
  `ciclo` text NOT NULL,
  `lida_em` text,
  `ocultada_em` text,
  `notificada_nativamente_em` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_alerta_categoria_habilitado` ON `alerta_categoria_configuracao` (`habilitado`,`categoria`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_alerta_ocorrencias_chave` ON `alerta_ocorrencias` (`chave_ocorrencia`);
--> statement-breakpoint
CREATE INDEX `idx_alerta_ocorrencias_origem` ON `alerta_ocorrencias` (`categoria`,`origem_id`,`data_vencimento`);
--> statement-breakpoint
CREATE INDEX `idx_alerta_ocorrencias_estado` ON `alerta_ocorrencias` (`ocultada_em`,`lida_em`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_projetos_alerta_prazo` ON `projetos` (`data_entrega`,`status`) WHERE `deleted_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_clientes_alerta_servico` ON `clientes` (`previsao_entrega`,`situacao`) WHERE `deleted_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_tarefas_alerta_prazo` ON `tarefas` (`data_limite`,`status`) WHERE `deleted_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_parcelas_alerta_prazo` ON `parcelas` (`data_vencimento`,`status_pagamento`) WHERE `deleted_at` IS NULL AND `cancelada_em` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_despesas_alerta_prazo` ON `despesas` (`data`,`status`) WHERE `deleted_at` IS NULL AND `cancelada_em` IS NULL AND `estornada_em` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_orcamentos_alerta_validade` ON `orcamentos` (`validade_ate`,`status`) WHERE `deleted_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_compromissos_alerta_data` ON `compromissos` (`data`) WHERE `deleted_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_oportunidades_alerta_acao` ON `oportunidades` (`proxima_acao_em`,`estagio`) WHERE `deleted_at` IS NULL;
