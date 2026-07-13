CREATE TABLE `clientes` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`documento` text,
	`email` text,
	`telefone` text,
	`endereco` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `configuracoes` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_nome` text NOT NULL,
	`empresa_cnpj` text,
	`dados_pasta` text NOT NULL,
	`admin_nome` text NOT NULL,
	`admin_email` text NOT NULL,
	`admin_senha_hash` text NOT NULL,
	`setup_concluido` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projetos` (
	`id` text PRIMARY KEY NOT NULL,
	`cliente_id` text NOT NULL,
	`nome` text NOT NULL,
	`descricao` text,
	`status` text DEFAULT 'Em Andamento' NOT NULL,
	`data_inicio` text,
	`data_entrega` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action
);
