ALTER TABLE `clientes` ADD `documento_normalizado` text;
--> statement-breakpoint
UPDATE `clientes`
SET `documento_normalizado` = CASE
  WHEN length(replace(replace(replace(replace(replace(replace(coalesce(`cpf`, ''), '.', ''), '/', ''), '-', ''), ' ', ''), '(', ''), ')', '')) = 11
    THEN replace(replace(replace(replace(replace(replace(coalesce(`cpf`, ''), '.', ''), '/', ''), '-', ''), ' ', ''), '(', ''), ')', '')
  WHEN length(replace(replace(replace(replace(replace(replace(coalesce(`cnpj`, ''), '.', ''), '/', ''), '-', ''), ' ', ''), '(', ''), ')', '')) = 14
    THEN replace(replace(replace(replace(replace(replace(coalesce(`cnpj`, ''), '.', ''), '/', ''), '-', ''), ' ', ''), '(', ''), ')', '')
  WHEN length(replace(replace(replace(replace(replace(replace(coalesce(`documento`, ''), '.', ''), '/', ''), '-', ''), ' ', ''), '(', ''), ')', '')) IN (11, 14)
    THEN replace(replace(replace(replace(replace(replace(coalesce(`documento`, ''), '.', ''), '/', ''), '-', ''), ' ', ''), '(', ''), ')', '')
  ELSE NULL
END;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `cliente_documento_conflitos` (
  `documento_normalizado` text PRIMARY KEY NOT NULL,
  `cliente_ids_json` text NOT NULL,
  `quantidade` integer NOT NULL CHECK (`quantidade` > 1),
  `detectado_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `resolvido_em` text
);
--> statement-breakpoint
INSERT INTO `cliente_documento_conflitos` (`documento_normalizado`, `cliente_ids_json`, `quantidade`)
SELECT `documento_normalizado`, json_group_array(`id`), count(*)
FROM `clientes`
WHERE `deleted_at` IS NULL AND `documento_normalizado` IS NOT NULL
GROUP BY `documento_normalizado`
HAVING count(*) > 1
ON CONFLICT(`documento_normalizado`) DO UPDATE SET
  `cliente_ids_json` = excluded.`cliente_ids_json`,
  `quantidade` = excluded.`quantidade`,
  `detectado_em` = CURRENT_TIMESTAMP,
  `resolvido_em` = NULL;
--> statement-breakpoint
CREATE TRIGGER `trg_clientes_documento_unique_insert`
BEFORE INSERT ON `clientes`
WHEN NEW.`deleted_at` IS NULL AND NEW.`documento_normalizado` IS NOT NULL
  AND EXISTS (SELECT 1 FROM `clientes` WHERE `deleted_at` IS NULL AND `documento_normalizado` = NEW.`documento_normalizado`)
BEGIN
  SELECT RAISE(ABORT, 'CLIENT_DOCUMENT_CONFLICT');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_clientes_documento_unique_update`
BEFORE UPDATE OF `documento_normalizado`, `deleted_at` ON `clientes`
WHEN NEW.`deleted_at` IS NULL AND NEW.`documento_normalizado` IS NOT NULL
  AND EXISTS (SELECT 1 FROM `clientes` WHERE `id` <> OLD.`id` AND `deleted_at` IS NULL AND `documento_normalizado` = NEW.`documento_normalizado`)
BEGIN
  SELECT RAISE(ABORT, 'CLIENT_DOCUMENT_CONFLICT');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_clientes_documento_normalize_insert`
AFTER INSERT ON `clientes`
BEGIN
  UPDATE `clientes` SET `documento_normalizado` = CASE
    WHEN length(replace(replace(replace(replace(replace(replace(coalesce(`cpf`, ''), '.', ''), '/', ''), '-', ''), ' ', ''), '(', ''), ')', '')) = 11
      THEN replace(replace(replace(replace(replace(replace(coalesce(`cpf`, ''), '.', ''), '/', ''), '-', ''), ' ', ''), '(', ''), ')', '')
    WHEN length(replace(replace(replace(replace(replace(replace(coalesce(`cnpj`, ''), '.', ''), '/', ''), '-', ''), ' ', ''), '(', ''), ')', '')) = 14
      THEN replace(replace(replace(replace(replace(replace(coalesce(`cnpj`, ''), '.', ''), '/', ''), '-', ''), ' ', ''), '(', ''), ')', '')
    WHEN length(replace(replace(replace(replace(replace(replace(coalesce(`documento`, ''), '.', ''), '/', ''), '-', ''), ' ', ''), '(', ''), ')', '')) IN (11, 14)
      THEN replace(replace(replace(replace(replace(replace(coalesce(`documento`, ''), '.', ''), '/', ''), '-', ''), ' ', ''), '(', ''), ')', '')
    ELSE NULL
  END WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `trg_clientes_documento_normalize_update`
AFTER UPDATE OF `cpf`, `cnpj`, `documento` ON `clientes`
BEGIN
  UPDATE `clientes` SET `documento_normalizado` = CASE
    WHEN length(replace(replace(replace(replace(replace(replace(coalesce(`cpf`, ''), '.', ''), '/', ''), '-', ''), ' ', ''), '(', ''), ')', '')) = 11
      THEN replace(replace(replace(replace(replace(replace(coalesce(`cpf`, ''), '.', ''), '/', ''), '-', ''), ' ', ''), '(', ''), ')', '')
    WHEN length(replace(replace(replace(replace(replace(replace(coalesce(`cnpj`, ''), '.', ''), '/', ''), '-', ''), ' ', ''), '(', ''), ')', '')) = 14
      THEN replace(replace(replace(replace(replace(replace(coalesce(`cnpj`, ''), '.', ''), '/', ''), '-', ''), ' ', ''), '(', ''), ')', '')
    WHEN length(replace(replace(replace(replace(replace(replace(coalesce(`documento`, ''), '.', ''), '/', ''), '-', ''), ' ', ''), '(', ''), ')', '')) IN (11, 14)
      THEN replace(replace(replace(replace(replace(replace(coalesce(`documento`, ''), '.', ''), '/', ''), '-', ''), ' ', ''), '(', ''), ')', '')
    ELSE NULL
  END WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE INDEX `idx_clientes_documento_normalizado` ON `clientes` (`documento_normalizado`) WHERE `deleted_at` IS NULL;
