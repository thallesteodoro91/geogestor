CREATE TABLE IF NOT EXISTS `propriedades` (
	`id` text PRIMARY KEY NOT NULL,
	`cliente_id` text NOT NULL REFERENCES `clientes`(`id`) ON DELETE cascade,
	`nome` text NOT NULL,
	`area_ha` real,
	`matricula` text,
	`car` text,
	`ccir` text,
	`itr` text,
	`cidade` text,
	`municipio` text,
	`situacao_imovel` text,
	`latitude` real,
	`longitude` real,
	`observacoes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_propriedades_cliente_id` ON `propriedades` (`cliente_id`);
--> statement-breakpoint
ALTER TABLE `projetos` ADD `propriedade_id` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `grupo_id` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `substitui_orcamento_id` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `versao` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `propriedade_id` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `observacoes_cliente` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `termos_condicoes` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `data_emissao` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `validade_ate` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `responsavel_tecnico` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `origem` text DEFAULT 'manual';
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `servico_tipo` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `imovel_tipo` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `imovel_nome` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `municipio` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `uf` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `metodologia` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `entregaveis` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `prazo_execucao_dias` integer;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `caracterizacao_json` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `cliente_snapshot_json` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `imovel_snapshot_json` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `desconto_global_tipo` text DEFAULT 'fixo';
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `desconto_global_valor` text DEFAULT '0';
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `acrescimo_global_tipo` text DEFAULT 'fixo';
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `acrescimo_global_valor` text DEFAULT '0';
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `subtotal_servicos` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `subtotal_despesas` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `subtotal_taxas` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `custo_total_estimado` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `impostos_previstos` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `honorarios_brutos` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `honorarios_liquidos` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `lucro_estimado` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `margem_pontos_base` integer;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `markup_pontos_base` integer;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `valor_reembolsavel` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `valor_nao_tributavel` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `emitido_em` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `enviado_em` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `visualizado_em` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `aprovado_em` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `aprovado_por` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `rejeitado_em` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `cancelado_em` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `motivo_status` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `bloqueado_em` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `chave_idempotencia_aprovacao` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `efeitos_aprovacao_json` text;
--> statement-breakpoint
ALTER TABLE `orcamentos` ADD `deleted_at` text;
--> statement-breakpoint
CREATE TABLE `orcamento_itens` (
	`id` text PRIMARY KEY NOT NULL,
	`orcamento_id` text NOT NULL REFERENCES `orcamentos`(`id`),
	`descricao` text NOT NULL,
	`quantidade` real NOT NULL,
	`quantidade_decimal` text DEFAULT '1' NOT NULL,
	`valor_unitario` integer NOT NULL,
	`custo_unitario` integer DEFAULT 0 NOT NULL,
	`codigo` text,
	`grupo` text,
	`etapa` text,
	`categoria` text DEFAULT 'Serviços',
	`unidade` text DEFAULT 'serviço' NOT NULL,
	`componente_financeiro` text DEFAULT 'servico' NOT NULL,
	`desconto_tipo` text DEFAULT 'fixo' NOT NULL,
	`desconto_valor` text DEFAULT '0' NOT NULL,
	`acrescimo_tipo` text DEFAULT 'fixo' NOT NULL,
	`acrescimo_valor` text DEFAULT '0' NOT NULL,
	`tributavel` integer DEFAULT true NOT NULL,
	`margem_pontos_base` integer,
	`observacoes` text,
	`ordem` integer DEFAULT 0 NOT NULL,
	`opcional` integer DEFAULT false NOT NULL,
	`obrigatorio` integer DEFAULT true NOT NULL,
	`total` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_orcamento_itens_orcamento_id` ON `orcamento_itens` (`orcamento_id`);
--> statement-breakpoint
CREATE TABLE `orcamento_despesas` (
	`id` text PRIMARY KEY NOT NULL,
	`orcamento_id` text NOT NULL REFERENCES `orcamentos`(`id`),
	`descricao` text NOT NULL,
	`valor` integer NOT NULL,
	`categoria` text DEFAULT 'Outros custos' NOT NULL,
	`classificacao` text DEFAULT 'custo_proprio' NOT NULL,
	`tributavel` integer DEFAULT false NOT NULL,
	`observacoes` text,
	`ordem` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_orcamento_despesas_orcamento_id` ON `orcamento_despesas` (`orcamento_id`);
--> statement-breakpoint
ALTER TABLE `parcelas` ADD `numero` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `parcelas` ADD `valor_pago` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `parcelas` ADD `tipo_valor` text DEFAULT 'recebivel_previsto' NOT NULL;
--> statement-breakpoint
ALTER TABLE `parcelas` ADD `origem_versao` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `parcelas` ADD `chave_origem` text;
--> statement-breakpoint
ALTER TABLE `parcelas` ADD `categoria_financeira` text;
--> statement-breakpoint
ALTER TABLE `parcelas` ADD `conta_financeira` text;
--> statement-breakpoint
ALTER TABLE `parcelas` ADD `meio_pagamento` text;
--> statement-breakpoint
ALTER TABLE `parcelas` ADD `data_competencia` text;
--> statement-breakpoint
ALTER TABLE `parcelas` ADD `juros` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `parcelas` ADD `multa` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `parcelas` ADD `desconto_antecipacao` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `parcelas` ADD `imposto_previsto` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `parcelas` ADD `cancelada_em` text;
--> statement-breakpoint
ALTER TABLE `parcelas` ADD `motivo_cancelamento` text;
--> statement-breakpoint
ALTER TABLE `parcelas` ADD `deleted_at` text;
--> statement-breakpoint
CREATE TABLE `perfis_tributarios` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`descricao` text,
	`ativo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `tributos` (
	`id` text PRIMARY KEY NOT NULL,
	`perfil_id` text NOT NULL REFERENCES `perfis_tributarios`(`id`) ON DELETE cascade,
	`nome` text NOT NULL,
	`sigla` text NOT NULL,
	`aliquota_pontos_base` integer NOT NULL,
	`base_calculo` text DEFAULT 'tributavel' NOT NULL,
	`incluso_no_preco` integer DEFAULT false NOT NULL,
	`cumulativo` integer DEFAULT false NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`categoria_financeira` text,
	`conta_financeira` text,
	`vigencia_inicio` text,
	`vigencia_fim` text,
	`observacoes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_tributos_perfil` ON `tributos` (`perfil_id`,`ativo`);
--> statement-breakpoint
CREATE TABLE `orcamento_impostos` (
	`id` text PRIMARY KEY NOT NULL,
	`orcamento_id` text NOT NULL REFERENCES `orcamentos`(`id`) ON DELETE cascade,
	`tributo_id` text REFERENCES `tributos`(`id`),
	`nome` text NOT NULL,
	`sigla` text NOT NULL,
	`aliquota_pontos_base` integer NOT NULL,
	`base_calculo` text DEFAULT 'tributavel' NOT NULL,
	`incluso_no_preco` integer DEFAULT false NOT NULL,
	`cumulativo` integer DEFAULT false NOT NULL,
	`base_valor` integer DEFAULT 0 NOT NULL,
	`valor_previsto` integer DEFAULT 0 NOT NULL,
	`ajuste_manual` integer DEFAULT 0 NOT NULL,
	`justificativa_ajuste` text,
	`ordem` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_orcamento_impostos_orcamento` ON `orcamento_impostos` (`orcamento_id`);
--> statement-breakpoint
CREATE TABLE `orcamento_condicoes_pagamento` (
	`id` text PRIMARY KEY NOT NULL,
	`orcamento_id` text NOT NULL REFERENCES `orcamentos`(`id`) ON DELETE cascade,
	`tipo` text DEFAULT 'parcelas' NOT NULL,
	`descricao` text,
	`parcelas_json` text NOT NULL,
	`meio_pagamento` text,
	`conta_financeira` text,
	`juros_pontos_base` integer DEFAULT 0 NOT NULL,
	`multa_pontos_base` integer DEFAULT 0 NOT NULL,
	`desconto_antecipacao_pontos_base` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_orcamento_condicao_pagamento` ON `orcamento_condicoes_pagamento` (`orcamento_id`);
--> statement-breakpoint
CREATE TABLE `orcamento_status_historico` (
	`id` text PRIMARY KEY NOT NULL,
	`orcamento_id` text NOT NULL REFERENCES `orcamentos`(`id`) ON DELETE cascade,
	`status_anterior` text,
	`status_novo` text NOT NULL,
	`motivo` text,
	`usuario_id` text DEFAULT 'admin' NOT NULL,
	`metadata_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_orcamento_status_historico` ON `orcamento_status_historico` (`orcamento_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `orcamento_versoes` (
	`id` text PRIMARY KEY NOT NULL,
	`orcamento_id` text NOT NULL REFERENCES `orcamentos`(`id`) ON DELETE cascade,
	`grupo_id` text NOT NULL,
	`versao` integer NOT NULL,
	`status` text NOT NULL,
	`valor_total` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`motivo` text,
	`usuario_id` text DEFAULT 'admin' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_orcamento_versoes_orcamento` ON `orcamento_versoes` (`orcamento_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_orcamento_versoes_grupo_versao_status` ON `orcamento_versoes` (`grupo_id`,`versao`,`status`);
--> statement-breakpoint
CREATE TABLE `orcamento_modelos` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`servico_tipo` text,
	`descricao` text,
	`conteudo_json` text NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_orcamento_modelos_servico` ON `orcamento_modelos` (`servico_tipo`,`ativo`);
--> statement-breakpoint
CREATE TABLE `parametros_precificacao` (
	`id` text PRIMARY KEY NOT NULL,
	`chave` text NOT NULL UNIQUE,
	`nome` text NOT NULL,
	`categoria` text NOT NULL,
	`unidade` text,
	`valor_centavos` integer,
	`valor_decimal` text,
	`ativo` integer DEFAULT true NOT NULL,
	`observacoes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `orcamento_projetos` (
	`id` text PRIMARY KEY NOT NULL,
	`orcamento_id` text NOT NULL REFERENCES `orcamentos`(`id`) ON DELETE cascade,
	`projeto_id` text NOT NULL REFERENCES `projetos`(`id`),
	`tipo_vinculo` text DEFAULT 'aprovacao' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_orcamento_projeto` ON `orcamento_projetos` (`orcamento_id`,`projeto_id`);
--> statement-breakpoint
UPDATE `orcamentos` SET `grupo_id` = coalesce(`grupo_id`, `id`), `versao` = coalesce(`versao`, 1), `origem` = coalesce(`origem`, 'manual');
--> statement-breakpoint
UPDATE `orcamentos` SET `data_emissao` = coalesce(`data_emissao`, `data_orcamento`) WHERE `data_orcamento` IS NOT NULL;
--> statement-breakpoint
UPDATE `orcamentos` SET `validade_ate` = date(`data_emissao`, '+15 days') WHERE `validade_ate` IS NULL AND `data_emissao` IS NOT NULL;
--> statement-breakpoint
UPDATE `orcamentos` SET `status` = CASE lower(trim(`status`))
	WHEN 'aprovado' THEN 'aprovado'
	WHEN 'pago' THEN 'aprovado'
	WHEN 'rejeitado' THEN 'rejeitado'
	WHEN 'expirado' THEN 'expirado'
	WHEN 'cancelado' THEN 'cancelado'
	WHEN 'emitido' THEN 'emitido'
	WHEN 'enviado' THEN 'enviado'
	WHEN 'em negociação' THEN 'em_negociacao'
	WHEN 'em negociacao' THEN 'em_negociacao'
	ELSE 'rascunho'
END;
--> statement-breakpoint
UPDATE `parcelas` SET `valor_pago` = `valor` WHERE `status_pagamento` = 'Pago';
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_orcamentos_grupo_versao` ON `orcamentos` (`grupo_id`,`versao`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_orcamentos_aprovacao_idempotencia` ON `orcamentos` (`chave_idempotencia_aprovacao`) WHERE `chave_idempotencia_aprovacao` IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_parcelas_chave_origem` ON `parcelas` (`chave_origem`) WHERE `chave_origem` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `idx_orcamentos_emissao_status` ON `orcamentos` (`data_emissao`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_orcamentos_validade_status` ON `orcamentos` (`validade_ate`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_orcamentos_filtros` ON `orcamentos` (`cliente_id`,`servico_tipo`,`municipio`,`imovel_tipo`,`status`);
