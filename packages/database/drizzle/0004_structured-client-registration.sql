ALTER TABLE `clientes` ADD `tipo_pessoa` text;
--> statement-breakpoint
ALTER TABLE `clientes` ADD `rg` text;
--> statement-breakpoint
ALTER TABLE `clientes` ADD `inscricao_estadual` text;
--> statement-breakpoint
ALTER TABLE `clientes` ADD `celular_whatsapp` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `clientes` ADD `sem_numero` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `clientes` ADD `complemento` text;
--> statement-breakpoint
ALTER TABLE `clientes` ADD `municipio` text;
--> statement-breakpoint
ALTER TABLE `clientes` ADD `uf` text;
--> statement-breakpoint
ALTER TABLE `clientes` ADD `cep` text;
--> statement-breakpoint
ALTER TABLE `clientes` ADD `origem_principal` text;
--> statement-breakpoint
ALTER TABLE `clientes` ADD `origem_detalhe` text;
--> statement-breakpoint
ALTER TABLE `clientes` ADD `indicado_por` text;
--> statement-breakpoint
ALTER TABLE `clientes` ADD `perfis` text;
--> statement-breakpoint
UPDATE `clientes`
SET `tipo_pessoa` = CASE
  WHEN coalesce(`cnpj`, '') <> ''
    OR `categoria` LIKE '%Pessoa Jurídica%'
    OR `categoria` LIKE '%Empresa%'
    OR length(replace(replace(replace(replace(coalesce(`documento`, ''), '.', ''), '/', ''), '-', ''), ' ', '')) = 14
  THEN 'PJ'
  ELSE 'PF'
END
WHERE `tipo_pessoa` IS NULL OR `tipo_pessoa` = '';
--> statement-breakpoint
UPDATE `clientes`
SET `origem_principal` = CASE
  WHEN trim(substr(`origem`, 1, CASE WHEN instr(`origem`, ',') > 0 THEN instr(`origem`, ',') - 1 ELSE length(`origem`) END))
    IN ('Site', 'Indicação', 'Instagram', 'Google', 'WhatsApp', 'Outro')
  THEN trim(substr(`origem`, 1, CASE WHEN instr(`origem`, ',') > 0 THEN instr(`origem`, ',') - 1 ELSE length(`origem`) END))
  ELSE 'Outro'
END,
`origem_detalhe` = CASE
  WHEN `origem` IS NOT NULL AND `origem` <> ''
    AND trim(substr(`origem`, 1, CASE WHEN instr(`origem`, ',') > 0 THEN instr(`origem`, ',') - 1 ELSE length(`origem`) END))
      NOT IN ('Site', 'Indicação', 'Instagram', 'Google', 'WhatsApp', 'Outro')
  THEN `origem`
  ELSE `origem_detalhe`
END
WHERE (`origem_principal` IS NULL OR `origem_principal` = '') AND `origem` IS NOT NULL AND `origem` <> '';
