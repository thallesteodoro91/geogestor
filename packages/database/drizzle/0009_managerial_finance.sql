CREATE TABLE IF NOT EXISTS `viagens` (
  `id` text PRIMARY KEY NOT NULL,
  `cliente_id` text,
  `projeto_id` text,
  `finalidade` text NOT NULL,
  `destino` text NOT NULL,
  `data_inicio` text NOT NULL,
  `data_fim` text,
  `responsavel` text,
  `adiantamento` integer DEFAULT 0 NOT NULL,
  `quilometragem` real DEFAULT 0 NOT NULL,
  `valor_reembolsavel` integer DEFAULT 0 NOT NULL,
  `status` text DEFAULT 'planejada' NOT NULL,
  `observacoes` text,
  `encerrada_em` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `deleted_at` text,
  FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`),
  FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`)
);
--> statement-breakpoint
ALTER TABLE `despesas` ADD `viagem_id` text REFERENCES viagens(id);
--> statement-breakpoint
ALTER TABLE `despesas` ADD `categoria_codigo` text DEFAULT 'outros' NOT NULL;
--> statement-breakpoint
ALTER TABLE `despesas` ADD `cancelada_em` text;
--> statement-breakpoint
ALTER TABLE `despesas` ADD `motivo_cancelamento` text;
--> statement-breakpoint
ALTER TABLE `despesas` ADD `estornada_em` text;
--> statement-breakpoint
ALTER TABLE `despesas` ADD `motivo_estorno` text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `recebimentos` (
  `id` text PRIMARY KEY NOT NULL,
  `parcela_id` text NOT NULL,
  `valor_principal` integer NOT NULL,
  `juros` integer DEFAULT 0 NOT NULL,
  `multa` integer DEFAULT 0 NOT NULL,
  `desconto` integer DEFAULT 0 NOT NULL,
  `taxas` integer DEFAULT 0 NOT NULL,
  `valor_recebido` integer NOT NULL,
  `data_recebimento` text NOT NULL,
  `meio_pagamento` text,
  `observacoes` text,
  `comprovante_documento_id` text,
  `estornado_em` text,
  `motivo_estorno` text,
  `usuario_id` text DEFAULT 'admin' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `deleted_at` text,
  FOREIGN KEY (`parcela_id`) REFERENCES `parcelas`(`id`),
  FOREIGN KEY (`comprovante_documento_id`) REFERENCES `documentos`(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `despesa_documentos` (
  `id` text PRIMARY KEY NOT NULL,
  `despesa_id` text NOT NULL,
  `documento_id` text NOT NULL,
  `tipo` text DEFAULT 'comprovante' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`despesa_id`) REFERENCES `despesas`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`documento_id`) REFERENCES `documentos`(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `notas_fiscais` (
  `id` text PRIMARY KEY NOT NULL,
  `cliente_id` text NOT NULL,
  `projeto_id` text,
  `orcamento_id` text,
  `documento_id` text,
  `numero` text NOT NULL,
  `codigo_verificacao` text,
  `data_emissao` text NOT NULL,
  `valor` integer NOT NULL,
  `status` text DEFAULT 'emitida' NOT NULL,
  `municipio` text,
  `link` text,
  `substitui_nota_id` text,
  `cancelada_em` text,
  `motivo_cancelamento` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `deleted_at` text,
  FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`),
  FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`),
  FOREIGN KEY (`orcamento_id`) REFERENCES `orcamentos`(`id`),
  FOREIGN KEY (`documento_id`) REFERENCES `documentos`(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `financeiro_eventos` (
  `id` text PRIMARY KEY NOT NULL,
  `tipo` text NOT NULL,
  `entidade` text NOT NULL,
  `entidade_id` text NOT NULL,
  `cliente_id` text,
  `projeto_id` text,
  `valor` integer DEFAULT 0 NOT NULL,
  `data_evento` text NOT NULL,
  `motivo` text,
  `metadata_json` text,
  `usuario_id` text DEFAULT 'admin' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`),
  FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `projeto_financeiro_decisoes` (
  `id` text PRIMARY KEY NOT NULL,
  `projeto_id` text NOT NULL,
  `cliente_id` text NOT NULL,
  `tipo` text NOT NULL,
  `percentual_executado` real,
  `valor_executado` integer,
  `cancelar_parcelas_futuras` integer DEFAULT 0 NOT NULL,
  `motivo` text NOT NULL,
  `usuario_id` text DEFAULT 'admin' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`),
  FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_despesa_documento` ON `despesa_documentos` (`despesa_id`,`documento_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_recebimentos_parcela_id` ON `recebimentos` (`parcela_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_viagens_cliente_id` ON `viagens` (`cliente_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_financeiro_eventos_entidade` ON `financeiro_eventos` (`entidade`,`entidade_id`);
--> statement-breakpoint
INSERT INTO `recebimentos` (
  `id`, `parcela_id`, `valor_principal`, `valor_recebido`,
  `data_recebimento`, `meio_pagamento`, `observacoes`, `usuario_id`
)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  `id`, coalesce(nullif(`valor_pago`, 0), `valor`),
  coalesce(nullif(`valor_pago`, 0), `valor`),
  coalesce(`data_pagamento`, `data_vencimento`), `meio_pagamento`,
  'Recebimento migrado do histórico anterior', 'migration'
FROM `parcelas`
WHERE lower(`status_pagamento`) = 'pago'
  AND `deleted_at` IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM `recebimentos` r WHERE r.`parcela_id` = `parcelas`.`id`
  );
