CREATE TABLE IF NOT EXISTS `licencas` (
	`id` text PRIMARY KEY NOT NULL,
	`projeto_id` text NOT NULL,
	`cliente_id` text,
	`numero` text NOT NULL,
	`protocolo` text,
	`orgao` text NOT NULL,
	`tipo_licenca` text,
	`data_emissao` text,
	`data_vencimento` text NOT NULL,
	`status` text DEFAULT 'VÃ¡lida' NOT NULL,
	`observacoes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_licencas_projeto_id` ON `licencas` (`projeto_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_licencas_cliente_id` ON `licencas` (`cliente_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_licencas_status` ON `licencas` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_licencas_vencimento` ON `licencas` (`data_vencimento`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `condicionantes_ambientais` (
	`id` text PRIMARY KEY NOT NULL,
	`licenca_id` text NOT NULL,
	`titulo` text NOT NULL,
	`descricao` text,
	`data_limite` text,
	`periodicidade` text,
	`responsavel` text,
	`status` text DEFAULT 'Pendente' NOT NULL,
	`data_cumprimento` text,
	`observacoes` text,
	`comprovante` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`licenca_id`) REFERENCES `licencas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_condicionantes_licenca_id` ON `condicionantes_ambientais` (`licenca_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_condicionantes_status` ON `condicionantes_ambientais` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_condicionantes_data_limite` ON `condicionantes_ambientais` (`data_limite`);
