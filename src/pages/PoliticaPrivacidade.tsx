import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PoliticaPrivacidade() {
  const navigate = useNavigate();
  const lastUpdated = "22 de março de 2026";

  const sectionClass = "text-lg font-semibold text-foreground mt-8";
  const textClass = "text-muted-foreground";
  const listClass = "list-disc pl-5 space-y-1 text-muted-foreground";

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <Card>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none p-6 md:p-10">
            <h1 className="text-2xl font-bold text-foreground mb-1">Política de Privacidade</h1>
            <p className="text-muted-foreground text-sm mb-8">Última atualização: {lastUpdated}</p>

            <p className={textClass}>
              Esta Política de Privacidade descreve como a <strong>GeoGestor</strong> coleta, usa, armazena,
              compartilha e protege suas informações pessoais, em conformidade com a{" "}
              <strong>Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018)</strong> e demais
              normas aplicáveis.
            </p>

            {/* 1. Controlador */}
            <h2 className={sectionClass}>1. Identificação do Controlador</h2>
            <p className={textClass}>
              O controlador responsável pelo tratamento dos seus dados pessoais é:
            </p>
            <ul className={listClass}>
              <li><strong>Razão social:</strong> GeoGestor Tecnologia Ltda.</li>
              <li><strong>CNPJ:</strong> [a ser preenchido]</li>
              <li><strong>Endereço:</strong> [a ser preenchido]</li>
              <li><strong>E-mail de contato:</strong>{" "}
                <a href="mailto:privacidade@geogestor.com.br" className="text-primary underline">privacidade@geogestor.com.br</a>
              </li>
            </ul>

            {/* 2. DPO */}
            <h2 className={sectionClass}>2. Encarregado de Proteção de Dados (DPO)</h2>
            <p className={textClass}>
              Em conformidade com o Art. 41 da LGPD, o Encarregado pelo Tratamento de Dados Pessoais pode ser
              contatado pelo e-mail:{" "}
              <a href="mailto:dpo@geogestor.com.br" className="text-primary underline">dpo@geogestor.com.br</a>.
            </p>

            {/* 3. Dados coletados */}
            <h2 className={sectionClass}>3. Dados Pessoais Coletados</h2>
            <p className={textClass}>Coletamos as seguintes categorias de dados pessoais:</p>
            <ul className={listClass}>
              <li><strong>Dados de cadastro:</strong> nome completo, endereço de e-mail e senha (armazenada de forma criptografada).</li>
              <li><strong>Dados de perfil:</strong> foto de perfil, nome de exibição e preferências de configuração.</li>
              <li><strong>Dados operacionais:</strong> informações de clientes, propriedades rurais, serviços, orçamentos, despesas e demais registros inseridos por você na plataforma.</li>
              <li><strong>Dados de uso:</strong> endereço IP, tipo de navegador, páginas acessadas, data/hora de acesso e interações com a plataforma.</li>
              <li><strong>Dados de integrações:</strong> informações obtidas de serviços terceiros autorizados por você (ex.: Google Calendar).</li>
              <li><strong>Dados de pagamento:</strong> processados diretamente pelo provedor de pagamento (Stripe), sem armazenamento de dados de cartão em nossos servidores.</li>
            </ul>

            {/* 4. Base Legal */}
            <h2 className={sectionClass}>4. Base Legal para o Tratamento (Art. 7, LGPD)</h2>
            <p className={textClass}>O tratamento dos seus dados pessoais se fundamenta nas seguintes bases legais:</p>
            <ul className={listClass}>
              <li><strong>Execução de contrato</strong> (Art. 7, V): para fornecer os serviços contratados na plataforma, gerenciar sua conta e processar pagamentos.</li>
              <li><strong>Consentimento</strong> (Art. 7, I): para integrações opcionais (como Google Calendar), envio de comunicações de marketing e uso de cookies não essenciais.</li>
              <li><strong>Legítimo interesse</strong> (Art. 7, IX): para melhorar a plataforma, realizar análises de uso e prevenir fraudes, desde que não prejudiquem seus direitos fundamentais.</li>
              <li><strong>Cumprimento de obrigação legal</strong> (Art. 7, II): para atender exigências legais, regulatórias e fiscais.</li>
            </ul>

            {/* 5. Finalidades */}
            <h2 className={sectionClass}>5. Finalidades do Tratamento (Art. 6, I)</h2>
            <p className={textClass}>Seus dados pessoais são tratados para as seguintes finalidades específicas:</p>
            <ul className={listClass}>
              <li>Criação, autenticação e gerenciamento da sua conta na plataforma.</li>
              <li>Prestação dos serviços de gestão topográfica, incluindo cadastro de clientes, propriedades, serviços e orçamentos.</li>
              <li>Geração de relatórios, dashboards e análises financeiras e operacionais.</li>
              <li>Envio de notificações relevantes sobre seus serviços, compromissos e prazos.</li>
              <li>Sincronização de eventos com serviços de calendário, quando autorizado.</li>
              <li>Processamento de pagamentos e gestão de assinaturas.</li>
              <li>Melhoria contínua da plataforma e correção de problemas técnicos.</li>
              <li>Cumprimento de obrigações legais e regulatórias.</li>
            </ul>

            {/* 6. Google Calendar */}
            <h2 className={sectionClass}>6. Integração com Google Calendar</h2>
            <p className={textClass}>
              Quando você opta por conectar sua conta do Google Calendar, acessamos os seguintes dados
              mediante seu <strong>consentimento explícito</strong>:
            </p>
            <ul className={listClass}>
              <li><strong>Leitura de eventos:</strong> para exibir seus compromissos na plataforma.</li>
              <li><strong>Criação e edição de eventos:</strong> para sincronizar serviços e compromissos criados na GeoGestor com seu calendário.</li>
            </ul>
            <p className={textClass}>
              <strong>Não</strong> compartilhamos seus dados do Google Calendar com terceiros. Os tokens de acesso são armazenados
              de forma segura e criptografada. Você pode revogar o acesso a qualquer momento nas configurações da plataforma
              ou diretamente na sua conta Google em{" "}
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                myaccount.google.com/permissions
              </a>.
            </p>
            <p className={textClass}>
              O uso das informações recebidas das APIs do Google está em conformidade com a{" "}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Política de Dados de Usuário dos Serviços de API do Google
              </a>, incluindo os requisitos de Uso Limitado.
            </p>

            {/* 7. Compartilhamento */}
            <h2 className={sectionClass}>7. Compartilhamento de Dados</h2>
            <p className={textClass}>
              Não vendemos, alugamos ou comercializamos suas informações pessoais. O compartilhamento ocorre apenas nas seguintes hipóteses:
            </p>
            <ul className={listClass}>
              <li><strong>Provedores de infraestrutura:</strong> serviços de hospedagem, banco de dados e processamento de pagamentos, estritamente necessários à operação da plataforma.</li>
              <li><strong>Obrigações legais:</strong> quando exigido por lei, regulamentação ou ordem judicial.</li>
              <li><strong>Com seu consentimento:</strong> quando você autorizar expressamente.</li>
            </ul>

            {/* 8. Transferência Internacional */}
            <h2 className={sectionClass}>8. Transferência Internacional de Dados (Art. 33-36)</h2>
            <p className={textClass}>
              Seus dados podem ser armazenados e processados em servidores localizados fora do Brasil,
              utilizados pelos nossos provedores de infraestrutura. A transferência internacional de dados é
              realizada com base no Art. 33, II da LGPD (cláusulas contratuais específicas) e somente para
              países ou organizações que proporcionem grau adequado de proteção de dados ou mediante adoção
              de garantias apropriadas.
            </p>

            {/* 9. Retenção */}
            <h2 className={sectionClass}>9. Retenção de Dados (Art. 15 e 16)</h2>
            <p className={textClass}>
              Seus dados pessoais são mantidos enquanto sua conta estiver ativa ou pelo tempo necessário para
              cumprir as finalidades descritas nesta política. Após o encerramento da conta, os dados serão:
            </p>
            <ul className={listClass}>
              <li>Eliminados no prazo de <strong>30 dias</strong>, salvo obrigação legal de retenção.</li>
              <li>Mantidos por prazo superior apenas quando necessário para cumprimento de obrigação legal ou regulatória (ex.: registros fiscais por 5 anos).</li>
              <li>Anonimizados para fins estatísticos, caso aplicável.</li>
            </ul>

            {/* 10. Segurança */}
            <h2 className={sectionClass}>10. Segurança dos Dados</h2>
            <p className={textClass}>
              Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados pessoais, incluindo:
            </p>
            <ul className={listClass}>
              <li>Criptografia em trânsito (TLS/SSL) e em repouso.</li>
              <li>Controle de acesso baseado em funções (RBAC).</li>
              <li>Isolamento de dados por organização (multi-tenant).</li>
              <li>Monitoramento e registro de acessos (logs de auditoria).</li>
              <li>Backups regulares com recuperação de desastres.</li>
            </ul>

            {/* 11. Incidentes */}
            <h2 className={sectionClass}>11. Incidentes de Segurança (Art. 48)</h2>
            <p className={textClass}>
              Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares,
              a GeoGestor se compromete a:
            </p>
            <ul className={listClass}>
              <li>Comunicar a <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong> em prazo razoável, conforme regulamentação vigente.</li>
              <li>Notificar os titulares afetados, informando a natureza dos dados, os riscos e as medidas adotadas.</li>
              <li>Adotar providências para mitigar os efeitos do incidente.</li>
            </ul>

            {/* 12. Direitos do Titular */}
            <h2 className={sectionClass}>12. Seus Direitos como Titular (Art. 18)</h2>
            <p className={textClass}>
              A LGPD garante a você os seguintes direitos, que podem ser exercidos a qualquer momento:
            </p>
            <ul className={listClass}>
              <li><strong>Confirmação e acesso:</strong> confirmar a existência de tratamento e acessar seus dados.</li>
              <li><strong>Correção:</strong> solicitar a correção de dados incompletos, inexatos ou desatualizados.</li>
              <li><strong>Anonimização, bloqueio ou eliminação:</strong> de dados desnecessários, excessivos ou tratados em desconformidade.</li>
              <li><strong>Portabilidade:</strong> solicitar a transferência dos seus dados a outro fornecedor de serviço.</li>
              <li><strong>Eliminação:</strong> solicitar a exclusão dos dados tratados com base no consentimento.</li>
              <li><strong>Informação sobre compartilhamento:</strong> saber com quais entidades públicas e privadas seus dados foram compartilhados.</li>
              <li><strong>Revogação do consentimento:</strong> revogar o consentimento a qualquer momento, sem prejudicar o tratamento anterior.</li>
              <li><strong>Oposição:</strong> opor-se ao tratamento quando realizado com base em hipótese diversa do consentimento e houver descumprimento da LGPD.</li>
              <li><strong>Revisão de decisões automatizadas:</strong> solicitar a revisão de decisões tomadas unicamente com base em tratamento automatizado de dados (Art. 20).</li>
            </ul>
            <p className={textClass}>
              Para exercer seus direitos, entre em contato pelo e-mail{" "}
              <a href="mailto:privacidade@geogestor.com.br" className="text-primary underline">privacidade@geogestor.com.br</a>.
              Responderemos sua solicitação em até <strong>15 dias úteis</strong>.
            </p>

            {/* 13. Menores */}
            <h2 className={sectionClass}>13. Dados de Crianças e Adolescentes (Art. 14)</h2>
            <p className={textClass}>
              A plataforma GeoGestor <strong>não é destinada</strong> a menores de 18 anos. Não coletamos
              intencionalmente dados de crianças ou adolescentes. Caso tome conhecimento de que coletamos
              dados de um menor sem o devido consentimento, entre em contato conosco para que possamos
              providenciar a exclusão imediata.
            </p>

            {/* 14. Cookies */}
            <h2 className={sectionClass}>14. Cookies</h2>
            <p className={textClass}>
              Utilizamos apenas <strong>cookies essenciais</strong> para o funcionamento da plataforma
              (autenticação de sessão e preferências de interface). Não utilizamos cookies de rastreamento
              de terceiros para fins publicitários.
            </p>

            {/* 15. Alterações */}
            <h2 className={sectionClass}>15. Alterações nesta Política</h2>
            <p className={textClass}>
              Esta política pode ser atualizada periodicamente. Notificaremos sobre mudanças significativas
              por e-mail ou por aviso na plataforma. A versão atualizada sempre estará disponível nesta página
              com a data da última revisão. O uso continuado da plataforma após as alterações constitui
              aceitação dos novos termos.
            </p>

            {/* 16. Contato */}
            <h2 className={sectionClass}>16. Contato e Canal de Atendimento</h2>
            <p className={textClass}>
              Para dúvidas, solicitações, reclamações ou exercício de seus direitos previstos na LGPD,
              entre em contato conosco:
            </p>
            <ul className={listClass}>
              <li><strong>E-mail geral:</strong>{" "}
                <a href="mailto:privacidade@geogestor.com.br" className="text-primary underline">privacidade@geogestor.com.br</a>
              </li>
              <li><strong>Encarregado (DPO):</strong>{" "}
                <a href="mailto:dpo@geogestor.com.br" className="text-primary underline">dpo@geogestor.com.br</a>
              </li>
            </ul>
            <p className={textClass}>
              Caso não obtenha resposta satisfatória, você pode apresentar reclamação à{" "}
              <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong> pelo site{" "}
              <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                www.gov.br/anpd
              </a>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
