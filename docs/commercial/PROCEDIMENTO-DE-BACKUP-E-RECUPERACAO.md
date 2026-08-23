# Procedimento de backup e recuperação

> **MINUTA TÉCNICA — REVISÃO JURÍDICA OBRIGATÓRIA ANTES DA PUBLICAÇÃO**

## Rotina de backup

1. Criar backups pelo GeoGestor e conferir o estado “concluído” e o manifesto.
2. Manter ao menos uma cópia externa protegida, desconectada do computador principal.
3. Não renomear, editar ou extrair parcialmente o bundle para simular outra versão.
4. Testar restauração periodicamente em ambiente descartável com dados sintéticos.
5. Proteger e guardar separadamente o kit de recuperação; não o anexar a chamados.

## Antes de restaurar

Fechar outras instâncias, confirmar versão e origem do bundle, registrar contagens/relatórios de referência e preservar o estado atual. A restauração deve ser iniciada somente pela interface/fluxo coordenado; não substituir o arquivo `.db` manualmente enquanto a API estiver aberta.

## Falha ou interrupção

Não remover arquivos `pending`, `before-restore`, `-wal` ou `-shm`. Interromper novas tentativas, preservar o diretório e acionar o suporte com diagnóstico sanitizado. Chave incorreta, corrupção, hash divergente, caminho inseguro ou schema futuro devem produzir recusa segura.

## Homologação humana

Restauração pela interface instalada, interrupção física, recuperação em outro perfil e recuperação em outro computador permanecem `PENDENTE DE HOMOLOGAÇÃO HUMANA` até execução no candidato final.
