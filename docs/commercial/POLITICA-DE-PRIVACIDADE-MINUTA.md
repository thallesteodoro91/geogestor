# Política de privacidade do GeoGestor — minuta

> **MINUTA TÉCNICA — REVISÃO JURÍDICA OBRIGATÓRIA ANTES DA PUBLICAÇÃO**

Versão técnica de referência: 1.0.0 (GeoGestor 1.0)  
Controlador/responsável legal: **A DEFINIR**  
Canal do titular e contato de privacidade: **A DEFINIR**

## Escopo e funcionamento local

O GeoGestor é um aplicativo desktop para gestão de serviços de topografia, georreferenciamento e gestão territorial. Os dados operacionais e o banco principal permanecem no computador do usuário. O produto não deve prometer sincronização em nuvem como comportamento padrão.

O aplicativo pode realizar conexões externas quando o usuário utiliza recursos que delas dependem, como mapas-base do OpenStreetMap e integração opcional com Google Agenda. A revisão jurídica deve identificar controladores, operadores, transferências, bases legais e políticas desses terceiros antes da publicação.

## Categorias de dados

- Dados de clientes e contatos, inclusive CPF/CNPJ, endereço, telefone e e-mail quando cadastrados.
- Dados de imóveis, projetos, levantamentos, documentos e atividades técnicas.
- Dados financeiros, comerciais, agenda, tarefas e histórico de auditoria.
- Configurações locais, registros técnicos de erro e diagnósticos solicitados pelo usuário.
- Tokens de integrações opcionais, quando configuradas, protegidos pelos controles locais aplicáveis.

O produto não deve coletar dados desnecessários nem incluir bancos, documentos, credenciais ou backups em relatórios de suporte.

## Finalidades e bases legais

As finalidades técnicas são executar os comandos do usuário, persistir a operação local, gerar documentos, realizar backup/recuperação, integrar serviços opcionais e diagnosticar falhas. As bases legais da LGPD, os papéis das partes e eventuais consentimentos devem ser definidos pelo responsável jurídico conforme o modelo comercial efetivamente adotado. Esta minuta não escolhe base legal.

## Armazenamento, segurança e retenção

O banco local usa criptografia de páginas; a chave da instalação é protegida pelo mecanismo `safeStorage`/DPAPI do Windows. A sessão local, o token Electron/API, os backups protegidos e o kit de recuperação possuem controles próprios. Esses controles reduzem riscos, mas não substituem senha do Windows, atualizações do sistema, cópias externas protegidas e controle físico do equipamento.

Prazos de retenção, descarte, portabilidade e exclusão devem ser definidos pelo contratante e pelo responsável jurídico. A exclusão no aplicativo não garante eliminação de backups externos mantidos pelo usuário.

## Direitos, solicitações e incidentes

O procedimento para confirmação, acesso, correção, anonimização, portabilidade, oposição, revisão e eliminação deve ser publicado junto ao canal do titular. Incidentes devem ser comunicados pelo canal **A DEFINIR**, com preservação de evidências e sem envio de dados reais em canais inseguros.

## Pendências obrigatórias antes da publicação

- Identificar controlador, operador, encarregado/canal e endereço de contato.
- Definir bases legais, retenção, descarte, resposta a titulares e incidentes.
- Revisar Google Agenda, OpenStreetMap, suporte remoto e eventuais transferências.
- Conferir se a interface e o contrato comercial correspondem exatamente a esta política.
