CREATE TABLE IF NOT EXISTS `ciclos_estrategicos` (
  `id` text PRIMARY KEY NOT NULL,
  `nome` text NOT NULL,
  `data_inicio` text NOT NULL,
  `data_fim` text NOT NULL,
  `visao` text NOT NULL,
  `status` text DEFAULT 'rascunho' NOT NULL,
  `proxima_revisao` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `deleted_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `pilares_estrategicos` (
  `id` text PRIMARY KEY NOT NULL,
  `ciclo_id` text NOT NULL REFERENCES `ciclos_estrategicos`(`id`) ON DELETE cascade,
  `nome` text NOT NULL,
  `descricao` text,
  `ordem` integer DEFAULT 0 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `deleted_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `objetivos_estrategicos` (
  `id` text PRIMARY KEY NOT NULL,
  `ciclo_id` text NOT NULL REFERENCES `ciclos_estrategicos`(`id`) ON DELETE cascade,
  `pilar_id` text NOT NULL REFERENCES `pilares_estrategicos`(`id`) ON DELETE restrict,
  `titulo` text NOT NULL,
  `descricao` text,
  `responsavel` text NOT NULL,
  `data_limite` text NOT NULL,
  `status` text DEFAULT 'nao_iniciado' NOT NULL,
  `prioridade` text DEFAULT 'media' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `deleted_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `resultados_chave` (
  `id` text PRIMARY KEY NOT NULL,
  `objetivo_id` text NOT NULL REFERENCES `objetivos_estrategicos`(`id`) ON DELETE cascade,
  `titulo` text NOT NULL,
  `descricao` text,
  `linha_base` real NOT NULL,
  `meta` real NOT NULL,
  `valor_atual` real,
  `unidade` text NOT NULL,
  `direcao` text DEFAULT 'aumentar' NOT NULL,
  `fonte_tipo` text DEFAULT 'manual' NOT NULL,
  `fonte_codigo` text,
  `fonte_regra` text,
  `fonte_periodo` text,
  `fonte_rota` text,
  `frequencia` text DEFAULT 'mensal' NOT NULL,
  `ultima_atualizacao` text,
  `confianca` text DEFAULT 'media' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `deleted_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `iniciativas_estrategicas` (
  `id` text PRIMARY KEY NOT NULL,
  `objetivo_id` text NOT NULL REFERENCES `objetivos_estrategicos`(`id`) ON DELETE cascade,
  `titulo` text NOT NULL,
  `descricao` text,
  `responsavel` text NOT NULL,
  `data_limite` text NOT NULL,
  `progresso` real DEFAULT 0 NOT NULL,
  `status` text DEFAULT 'planejada' NOT NULL,
  `orcamento_centavos` integer,
  `dependencias` text,
  `proximo_marco` text,
  `projeto_id` text REFERENCES `projetos`(`id`) ON DELETE set null,
  `tarefa_id` text REFERENCES `tarefas`(`id`) ON DELETE set null,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `deleted_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `checkins_estrategicos` (
  `id` text PRIMARY KEY NOT NULL,
  `ciclo_id` text NOT NULL REFERENCES `ciclos_estrategicos`(`id`) ON DELETE cascade,
  `objetivo_id` text REFERENCES `objetivos_estrategicos`(`id`) ON DELETE set null,
  `data` text NOT NULL,
  `status` text NOT NULL,
  `narrativa` text NOT NULL,
  `confianca` text NOT NULL,
  `bloqueios` text,
  `decisoes` text,
  `decisoes_pendentes` text,
  `proximos_passos` text,
  `proxima_revisao` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `deleted_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `riscos_estrategicos` (
  `id` text PRIMARY KEY NOT NULL,
  `ciclo_id` text NOT NULL REFERENCES `ciclos_estrategicos`(`id`) ON DELETE cascade,
  `objetivo_id` text REFERENCES `objetivos_estrategicos`(`id`) ON DELETE set null,
  `iniciativa_id` text REFERENCES `iniciativas_estrategicas`(`id`) ON DELETE set null,
  `descricao` text NOT NULL,
  `impacto` text NOT NULL,
  `probabilidade` text NOT NULL,
  `mitigacao` text,
  `responsavel` text NOT NULL,
  `status` text DEFAULT 'aberto' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `deleted_at` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ciclos_estrategicos_status_periodo` ON `ciclos_estrategicos` (`status`,`data_inicio`,`data_fim`);
CREATE INDEX IF NOT EXISTS `idx_pilares_estrategicos_ciclo_ordem` ON `pilares_estrategicos` (`ciclo_id`,`ordem`);
CREATE INDEX IF NOT EXISTS `idx_objetivos_estrategicos_ciclo_status` ON `objetivos_estrategicos` (`ciclo_id`,`status`,`data_limite`);
CREATE INDEX IF NOT EXISTS `idx_objetivos_estrategicos_pilar` ON `objetivos_estrategicos` (`pilar_id`);
CREATE INDEX IF NOT EXISTS `idx_resultados_chave_objetivo` ON `resultados_chave` (`objetivo_id`);
CREATE INDEX IF NOT EXISTS `idx_resultados_chave_fonte` ON `resultados_chave` (`fonte_tipo`,`fonte_codigo`);
CREATE INDEX IF NOT EXISTS `idx_iniciativas_estrategicas_objetivo_status` ON `iniciativas_estrategicas` (`objetivo_id`,`status`,`data_limite`);
CREATE INDEX IF NOT EXISTS `idx_iniciativas_estrategicas_projeto` ON `iniciativas_estrategicas` (`projeto_id`);
CREATE INDEX IF NOT EXISTS `idx_iniciativas_estrategicas_tarefa` ON `iniciativas_estrategicas` (`tarefa_id`);
CREATE INDEX IF NOT EXISTS `idx_checkins_estrategicos_ciclo_data` ON `checkins_estrategicos` (`ciclo_id`,`data`);
CREATE INDEX IF NOT EXISTS `idx_checkins_estrategicos_objetivo` ON `checkins_estrategicos` (`objetivo_id`);
CREATE INDEX IF NOT EXISTS `idx_riscos_estrategicos_ciclo_status` ON `riscos_estrategicos` (`ciclo_id`,`status`);
CREATE INDEX IF NOT EXISTS `idx_riscos_estrategicos_objetivo` ON `riscos_estrategicos` (`objetivo_id`);
CREATE INDEX IF NOT EXISTS `idx_riscos_estrategicos_iniciativa` ON `riscos_estrategicos` (`iniciativa_id`);
