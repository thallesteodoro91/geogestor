# Release, candidato e instalação

## Estado da origem

- Branch observada: `main`.
- HEAD inicial: `a16551a8b63e73f42d826297df893488e5ab88ca`.
- Versão canônica: `1.0.4`.
- Worktree: amplamente sujo antes e depois da sessão; alterações preexistentes preservadas.
- `release:verify-source`: bloqueado por origem suja.
- Não foram usados `reset`, `clean`, `restore`, `checkout --`, stash ou comandos Git mutáveis.

## Estado do candidato

Nenhum candidato foi gerado. A configuração do próximo nome está correta (`GeoGestor Setup 1.0.4.exe` por interpolação de versão), mas isso não comprova o conteúdo de um pacote. Os instaladores existentes em `dist/` foram apenas inventariados em modo leitura e antecedem o fechamento desta auditoria.

## Instalação e atualização

- Instalação limpa: não executada.
- Atualização preservando dados: não executada.
- Desinstalação: não executada.
- Smoke da API empacotada no estado final: não executado.
- Verificação Authenticode no estado final: inconclusiva por indisponibilidade do módulo PowerShell no ambiente; a fonte declara ausência de assinatura.
- Banco real do usuário: não aberto, copiado ou modificado.

## Inventário de artefatos históricos observado

| Artefato | Tamanho | SHA-256 (prefixo) | Classificação |
|---|---:|---|---|
| GeoGestor Setup 1.0.2.exe | 89.918.588 bytes | `A7557…` | histórico |
| GeoGestor Setup 1.0.3.exe | 89.918.886 bytes | `E1561…` | histórico |
| GeoGestor Setup 1.0.4.exe | 89.989.237 bytes | `DE1C0…` | histórico, não representa o estado final |
| `artifact-hashes.json` | inventariado | `FF38…` | evidência anterior |
| `release-gate-report.json` | inventariado | `6367…` | evidência anterior |
| `release-verification.json` | inventariado | `53EF…` | evidência anterior |
| SBOMs observados | inventariados | `74F50…` | evidência anterior |

Os prefixos servem apenas para diferenciar os arquivos já existentes; não são substitutos do hash integral exigido para homologação.

## Decisão

- Candidato técnico: **BLOQUEADO**.
- Publicação: **NÃO EXECUTADA**.

Assinatura digital: não implementada por decisão do proprietário — risco residual aceito.

## Sequência autorizável futura

Após revisão do proprietário: consolidar origem limpa, rodar gates integrais, gerar candidato isolado, produzir SBOM/hashes, executar smoke empacotado, homologar os 19 itens e somente então decidir sobre tag e publicação. Esta sessão não concede essa autorização.
