CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`user_id` text DEFAULT 'admin' NOT NULL,
	`old_data` text,
	`new_data` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `compromissos` (
	`id` text PRIMARY KEY NOT NULL,
	`titulo` text NOT NULL,
	`descricao` text,
	`data` text NOT NULL,
	`tipo` text DEFAULT 'Visita de Campo' NOT NULL,
	`cliente_id` text,
	`projeto_id` text,
	`google_event_id` text,
	`ultimo_sync_google` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `contatos` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`email` text,
	`telefone` text,
	`empresa` text,
	`cidade` text,
	`observacoes` text,
	`origem` text,
	`status` text DEFAULT 'ativo' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `despesas` (
	`id` text PRIMARY KEY NOT NULL,
	`cliente_id` text,
	`projeto_id` text,
	`descricao` text NOT NULL,
	`fornecedor` text,
	`numero_documento` text,
	`valor` integer NOT NULL,
	`data` text NOT NULL,
	`data_competencia` text,
	`data_pagamento` text,
	`tipo_custo` text,
	`centro_custo` text,
	`reembolsavel` integer DEFAULT false,
	`comprovante_documento_id` text,
	`categoria` text NOT NULL,
	`observacoes` text,
	`status` text,
	`forma_pagamento` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `documento_categorias` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`pasta_nome` text NOT NULL,
	`icone` text DEFAULT 'FolderSimple' NOT NULL,
	`cor` text DEFAULT 'zinc' NOT NULL,
	`ordem` integer DEFAULT 0 NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documentos` (
	`id` text PRIMARY KEY NOT NULL,
	`cliente_id` text NOT NULL,
	`projeto_id` text,
	`categoria_id` text,
	`categoria` text DEFAULT 'Outros' NOT NULL,
	`nome` text NOT NULL,
	`nome_original` text,
	`extensao` text NOT NULL,
	`caminho` text NOT NULL,
	`caminho_relativo` text,
	`tamanho_bytes` integer DEFAULT 0 NOT NULL,
	`mime_type` text,
	`tags` text,
	`origem` text DEFAULT 'upload' NOT NULL,
	`status` text DEFAULT 'ativo' NOT NULL,
	`criado_em_arquivo` text,
	`modificado_em_arquivo` text,
	`ultimo_sync_em` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`categoria_id`) REFERENCES `documento_categorias`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `interacoes_cliente` (
	`id` text PRIMARY KEY NOT NULL,
	`cliente_id` text NOT NULL,
	`projeto_id` text,
	`orcamento_id` text,
	`titulo` text,
	`categoria` text,
	`manual` integer DEFAULT true,
	`tipo` text NOT NULL,
	`data` text NOT NULL,
	`descricao` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`orcamento_id`) REFERENCES `orcamentos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `oportunidades` (
	`id` text PRIMARY KEY NOT NULL,
	`cliente_id` text NOT NULL,
	`titulo` text NOT NULL,
	`valor_estimado` integer,
	`estagio` text DEFAULT 'Prospect' NOT NULL,
	`ordem` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orcamentos` (
	`id` text PRIMARY KEY NOT NULL,
	`cliente_id` text NOT NULL,
	`projeto_id` text,
	`valor_total` integer NOT NULL,
	`status` text DEFAULT 'Em Análise' NOT NULL,
	`descricao` text,
	`anotacoes` text,
	`forma_de_pagamento` text,
	`desconto` integer,
	`codigo_orcamento` text,
	`data_orcamento` text,
	`data_competencia` text,
	`data_pagamento` text,
	`itens_json` text,
	`possui_marco` integer DEFAULT false,
	`marco_qtd` integer,
	`marco_valor` integer,
	`possui_imposto` integer DEFAULT false,
	`imposto_porcentagem` real,
	`imposto_valor` integer,
	`imposto_retido` integer DEFAULT false,
	`centro_custo` text,
	`possui_art` integer DEFAULT false,
	`art_valor` integer,
	`despesas_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `parcelas` (
	`id` text PRIMARY KEY NOT NULL,
	`orcamento_id` text NOT NULL,
	`valor` integer NOT NULL,
	`data_vencimento` text NOT NULL,
	`data_pagamento` text,
	`status_pagamento` text DEFAULT 'Pendente' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`orcamento_id`) REFERENCES `orcamentos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tarefas` (
	`id` text PRIMARY KEY NOT NULL,
	`cliente_id` text,
	`projeto_id` text,
	`titulo` text NOT NULL,
	`descricao` text,
	`status` text DEFAULT 'A Fazer' NOT NULL,
	`prioridade` text DEFAULT 'Média' NOT NULL,
	`categoria` text DEFAULT 'Interno',
	`contexto_tipo` text DEFAULT 'projeto',
	`data_limite` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `clientes` ADD `celular` text;--> statement-breakpoint
ALTER TABLE `clientes` ADD `cpf` text;--> statement-breakpoint
ALTER TABLE `clientes` ADD `cnpj` text;--> statement-breakpoint
ALTER TABLE `clientes` ADD `origem` text;--> statement-breakpoint
ALTER TABLE `clientes` ADD `categoria` text;--> statement-breakpoint
ALTER TABLE `clientes` ADD `anotacoes` text;--> statement-breakpoint
ALTER TABLE `clientes` ADD `situacao` text;--> statement-breakpoint
ALTER TABLE `clientes` ADD `servicos` text;--> statement-breakpoint
ALTER TABLE `configuracoes` ADD `google_client_id` text;--> statement-breakpoint
ALTER TABLE `configuracoes` ADD `google_client_secret` text;--> statement-breakpoint
ALTER TABLE `configuracoes` ADD `google_refresh_token` text;--> statement-breakpoint
ALTER TABLE `configuracoes` ADD `google_access_token` text;--> statement-breakpoint
ALTER TABLE `configuracoes` ADD `google_sync_active` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `projetos` ADD `area_ha` real;--> statement-breakpoint
ALTER TABLE `projetos` ADD `matricula` text;--> statement-breakpoint
ALTER TABLE `projetos` ADD `car` text;--> statement-breakpoint
ALTER TABLE `projetos` ADD `ccir` text;--> statement-breakpoint
ALTER TABLE `projetos` ADD `itr` text;--> statement-breakpoint
ALTER TABLE `projetos` ADD `cidade` text;--> statement-breakpoint
ALTER TABLE `projetos` ADD `municipio` text;--> statement-breakpoint
ALTER TABLE `projetos` ADD `situacao_imovel` text;--> statement-breakpoint
ALTER TABLE `projetos` ADD `tipo` text;--> statement-breakpoint
ALTER TABLE `projetos` ADD `averbacao` text;--> statement-breakpoint
ALTER TABLE `projetos` ADD `latitude` real;--> statement-breakpoint
ALTER TABLE `projetos` ADD `longitude` real;--> statement-breakpoint
ALTER TABLE `projetos` ADD `possui_memorial_descritivo` text;--> statement-breakpoint
ALTER TABLE `projetos` ADD `observacoes` text;
