UPDATE `oportunidades` SET `estagio` = 'Prospectado' WHERE `estagio` = 'Prospect';
--> statement-breakpoint
ALTER TABLE `oportunidades` ADD `responsavel` text;
--> statement-breakpoint
ALTER TABLE `oportunidades` ADD `origem` text;
--> statement-breakpoint
ALTER TABLE `oportunidades` ADD `servico_tipo` text;
--> statement-breakpoint
ALTER TABLE `oportunidades` ADD `proxima_acao` text;
--> statement-breakpoint
ALTER TABLE `oportunidades` ADD `proxima_acao_em` text;
--> statement-breakpoint
ALTER TABLE `oportunidades` ADD `previsao_fechamento` text;
--> statement-breakpoint
ALTER TABLE `oportunidades` ADD `probabilidade_pontos_base` integer DEFAULT 1000 NOT NULL;
--> statement-breakpoint
ALTER TABLE `oportunidades` ADD `observacoes` text;
--> statement-breakpoint
ALTER TABLE `oportunidades` ADD `motivo_perda` text;
--> statement-breakpoint
ALTER TABLE `oportunidades` ADD `encerrado_em` text;
--> statement-breakpoint
ALTER TABLE `oportunidades` ADD `ultimo_contato_em` text;
--> statement-breakpoint
ALTER TABLE `oportunidades` ADD `orcamento_id` text REFERENCES `orcamentos`(`id`);
--> statement-breakpoint
ALTER TABLE `oportunidades` ADD `projeto_id` text REFERENCES `projetos`(`id`);
--> statement-breakpoint
ALTER TABLE `oportunidades` ADD `estagio_alterado_em` text;
--> statement-breakpoint
UPDATE `oportunidades`
SET `probabilidade_pontos_base` = CASE `estagio`
  WHEN 'Contato' THEN 3000
  WHEN 'Proposta' THEN 6500
  WHEN 'Ganho' THEN 10000
  WHEN 'Perdido' THEN 0
  ELSE 1000
END,
`estagio_alterado_em` = coalesce(`updated_at`, `created_at`, CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE TABLE `oportunidade_estagios_historico` (
  `id` text PRIMARY KEY NOT NULL,
  `oportunidade_id` text NOT NULL,
  `estagio_anterior` text,
  `estagio_novo` text NOT NULL,
  `motivo` text,
  `usuario_id` text DEFAULT 'admin' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`oportunidade_id`) REFERENCES `oportunidades`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `oportunidade_estagios_historico` (`id`, `oportunidade_id`, `estagio_anterior`, `estagio_novo`, `motivo`, `usuario_id`, `created_at`)
SELECT lower(hex(randomblob(16))), `id`, NULL, `estagio`, 'Migração do funil comercial', 'admin', coalesce(`estagio_alterado_em`, CURRENT_TIMESTAMP)
FROM `oportunidades`;
--> statement-breakpoint
CREATE INDEX `idx_oportunidades_proxima_acao` ON `oportunidades` (`proxima_acao_em`);
--> statement-breakpoint
CREATE INDEX `idx_oportunidades_previsao_fechamento` ON `oportunidades` (`previsao_fechamento`);
--> statement-breakpoint
CREATE INDEX `idx_oportunidades_orcamento_id` ON `oportunidades` (`orcamento_id`);
--> statement-breakpoint
CREATE INDEX `idx_oportunidade_estagios_historico` ON `oportunidade_estagios_historico` (`oportunidade_id`, `created_at`);
