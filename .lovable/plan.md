

## Plano: Revisão da Política de Privacidade conforme LGPD

### Análise da versão atual

A política atual cobre o básico, mas falta vários elementos exigidos pela LGPD (Lei 13.709/2018). Abaixo as lacunas identificadas e as adições necessárias.

### Mudanças no arquivo `src/pages/PoliticaPrivacidade.tsx`

**Seções a adicionar/expandir:**

1. **Identificação do Controlador** (Art. 23, III) — Nome da empresa, CNPJ, endereço. Atualmente ausente.

2. **Base Legal para Tratamento** (Art. 7) — Especificar as bases legais usadas: execução de contrato, consentimento, legítimo interesse, cumprimento de obrigação legal. Atualmente não mencionado.

3. **Finalidade do Tratamento** (Art. 6, I) — Expandir a seção 2 com finalidades mais específicas e vinculadas às bases legais.

4. **Retenção de Dados** (Art. 15, 16) — Adicionar seção sobre por quanto tempo os dados são mantidos e critérios de eliminação. Atualmente ausente.

5. **Direitos do Titular expandidos** (Art. 18) — A seção 6 lista 5 direitos, mas a LGPD prevê 9. Adicionar:
   - Anonimização, bloqueio ou eliminação de dados desnecessários
   - Informação sobre compartilhamento com entidades públicas/privadas
   - Informação sobre a possibilidade de não fornecer consentimento e consequências
   - Revisão de decisões automatizadas (Art. 20)

6. **Encarregado de Proteção de Dados (DPO)** (Art. 41) — Adicionar identificação e contato do encarregado. Atualmente ausente.

7. **Transferência Internacional de Dados** (Art. 33-36) — Mencionar que os dados podem ser armazenados em servidores fora do Brasil e a base legal para isso.

8. **Dados de Menores** (Art. 14) — Declarar que o serviço não é destinado a menores de 18 anos.

9. **Incidentes de Segurança** (Art. 48) — Adicionar compromisso de notificação à ANPD e aos titulares em caso de incidente.

10. **Atualizar data** para 22 de março de 2026.

### Resumo

Todas as alterações são no arquivo `src/pages/PoliticaPrivacidade.tsx`. Nenhuma mudança de rota ou banco de dados necessária. O conteúdo será reestruturado em ~15 seções para conformidade completa com a LGPD.

