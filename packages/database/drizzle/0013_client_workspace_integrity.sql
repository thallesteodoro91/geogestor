ALTER TABLE `clientes` ADD `endereco_legado` text;
--> statement-breakpoint
ALTER TABLE `clientes` ADD `categoria_legada` text;
--> statement-breakpoint
ALTER TABLE `clientes` ADD `endereco_validacao` text DEFAULT 'nao_validado';
--> statement-breakpoint
ALTER TABLE `clientes` ADD `revisao_cadastral` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `clientes` ADD `revisao_motivos` text;
--> statement-breakpoint
ALTER TABLE `propriedades` ADD `uf` text;
--> statement-breakpoint
CREATE INDEX `idx_documentos_active_cliente` ON `documentos` (`cliente_id`,`updated_at`) WHERE status = 'ativo' AND deleted_at IS NULL;
