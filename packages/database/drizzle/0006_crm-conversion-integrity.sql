ALTER TABLE `contatos` ADD `cliente_convertido_id` text REFERENCES `clientes`(`id`);
--> statement-breakpoint
ALTER TABLE `contatos` ADD `convertido_em` text;
--> statement-breakpoint
CREATE INDEX `idx_contatos_cliente_convertido_id` ON `contatos` (`cliente_convertido_id`);
--> statement-breakpoint
CREATE INDEX `idx_contatos_status` ON `contatos` (`status`);
