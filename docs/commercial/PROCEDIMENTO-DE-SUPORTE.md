# Procedimento de suporte do GeoGestor

> **MINUTA TÉCNICA — REVISÃO JURÍDICA OBRIGATÓRIA ANTES DA PUBLICAÇÃO**

Canal oficial, horário, SLA e responsável: **A DEFINIR**

## Abertura segura

Registrar versão do GeoGestor, edição/build do Windows, operação executada, horário, mensagem exibida e passos de reprodução. Enviar somente o diagnóstico sanitizado gerado pelo aplicativo e capturas sem dados pessoais.

Nunca solicitar por e-mail/chat: banco `.db`, arquivos `-wal`/`-shm`, `.env`, senha local, código/kit de recuperação, token, backup completo ou documentos de clientes. Se um caso exigir dados representativos, reproduzir com base sintética ou cópia formalmente anonimizada em canal e ambiente aprovados.

## Classificação e resposta

- **Crítico:** risco de perda/corrupção, falha de restauração, exposição de segredo ou inicialização impossível. Interromper novas mutações, preservar arquivos e escalar.
- **Alto:** função essencial indisponível sem risco imediato de dados. Registrar contorno seguro e versão corretiva.
- **Normal:** defeito localizado, dúvida ou melhoria. Registrar resultado esperado/observado e evidência.

Toda resposta deve indicar próximo passo, versão afetada e se existe risco de dados. Não orientar exclusão manual de banco, sidecars, envelopes ou backups.
