# Fluxo e fronteiras de confiança

```mermaid
flowchart LR
  U[Usuário] --> R[Renderer React]
  R -->|token local + sessão| E[Preload / IPC Electron]
  E -->|seleção nativa + HMAC com TTL/nonce| A[API Fastify loopback]
  R -->|HTTP autenticado| A
  A --> C[Maintenance Coordinator]
  C --> B[Backup Service]
  B --> W[Workers isolados]
  W --> DB[(libSQL criptografado)]
  B --> FS[(Documentos e bundles)]
  B --> H[(Histórico operacional)]
  A -->|202 somente após preflight + teste + fingerprint| X[Encerrar API]
  X --> RW[Worker de restauração]
  RW --> S[before-restore + instalação + validação]
  S -->|75 sucesso / 76 falha| E
  E -->|reinicia API e recarrega renderer| R
```

## Fronteiras

- O renderer nunca recebe chave de banco ou chave de recuperação persistente.
- A seleção nativa emite autorização HMAC ligada ao caminho, nonce e prazo.
- Depois da correção A19-02, o nonce testado também é ligado ao fingerprint SHA-256 do bundle validado; o worker revalida o fingerprint.
- A API aceita operações somente por loopback/token e recusa restauração real fora do desktop gerenciado.
- A troca física preserva `before-restore`; rollback remove instalação parcial e recoloca banco/documentos anteriores.
- Pasta sincronizada é apenas destino local observável. O produto não confirma upload, imutabilidade, versionamento ou restauração do provedor.
