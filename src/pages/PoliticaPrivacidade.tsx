import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PoliticaPrivacidade() {
  const navigate = useNavigate();
  const lastUpdated = "21 de março de 2026";

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

            <p>
              A <strong>GeoGestor</strong> ("nós", "nosso") opera a plataforma de gestão para topografia
              disponível em <em>geogestor.lovable.app</em>. Esta Política de Privacidade descreve como
              coletamos, usamos, armazenamos e protegemos suas informações pessoais.
            </p>

            <h2 className="text-lg font-semibold text-foreground mt-8">1. Informações que Coletamos</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li><strong>Dados de cadastro:</strong> nome, email e senha ao criar sua conta.</li>
              <li><strong>Dados de perfil:</strong> foto de perfil, nome completo e configurações pessoais.</li>
              <li><strong>Dados operacionais:</strong> clientes, propriedades, serviços, orçamentos, despesas e demais informações inseridas na plataforma.</li>
              <li><strong>Dados de uso:</strong> logs de acesso, páginas visitadas e interações com a plataforma.</li>
              <li><strong>Dados de integrações:</strong> informações obtidas via integrações autorizadas por você (ex.: Google Calendar).</li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground mt-8">2. Como Usamos suas Informações</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Fornecer, manter e melhorar os serviços da plataforma.</li>
              <li>Autenticar sua identidade e gerenciar sua conta.</li>
              <li>Enviar notificações relevantes sobre seus serviços e compromissos.</li>
              <li>Gerar relatórios e análises para sua gestão empresarial.</li>
              <li>Cumprir obrigações legais e regulatórias.</li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground mt-8">3. Integração com Google Calendar</h2>
            <p className="text-muted-foreground">
              Quando você conecta sua conta do Google Calendar, acessamos os seguintes dados mediante sua autorização explícita:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li><strong>Leitura de eventos:</strong> para exibir seus compromissos na plataforma.</li>
              <li><strong>Criação e edição de eventos:</strong> para sincronizar serviços e compromissos criados na GeoGestor com seu calendário.</li>
            </ul>
            <p className="text-muted-foreground">
              Não compartilhamos seus dados do Google Calendar com terceiros. Os tokens de acesso são armazenados
              de forma segura e criptografada. Você pode revogar o acesso a qualquer momento nas configurações da plataforma
              ou diretamente na sua conta Google em{" "}
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                myaccount.google.com/permissions
              </a>.
            </p>
            <p className="text-muted-foreground">
              O uso das informações recebidas das APIs do Google está em conformidade com a{" "}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Política de Dados de Usuário dos Serviços de API do Google
              </a>, incluindo os requisitos de Uso Limitado.
            </p>

            <h2 className="text-lg font-semibold text-foreground mt-8">4. Armazenamento e Segurança</h2>
            <p className="text-muted-foreground">
              Seus dados são armazenados em servidores seguros com criptografia em trânsito (TLS/SSL) e em repouso.
              Implementamos medidas técnicas e organizacionais para proteger suas informações contra acesso não autorizado,
              alteração, divulgação ou destruição.
            </p>

            <h2 className="text-lg font-semibold text-foreground mt-8">5. Compartilhamento de Dados</h2>
            <p className="text-muted-foreground">
              Não vendemos, alugamos ou compartilhamos suas informações pessoais com terceiros, exceto:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Quando necessário para fornecer os serviços (ex.: provedores de infraestrutura).</li>
              <li>Para cumprir obrigações legais ou ordens judiciais.</li>
              <li>Com seu consentimento explícito.</li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground mt-8">6. Seus Direitos (LGPD)</h2>
            <p className="text-muted-foreground">
              Em conformidade com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Acessar seus dados pessoais.</li>
              <li>Corrigir dados incompletos ou desatualizados.</li>
              <li>Solicitar a exclusão de seus dados.</li>
              <li>Revogar consentimentos concedidos.</li>
              <li>Solicitar portabilidade de dados.</li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground mt-8">7. Cookies</h2>
            <p className="text-muted-foreground">
              Utilizamos cookies essenciais para o funcionamento da plataforma (autenticação e preferências).
              Não utilizamos cookies de rastreamento de terceiros para publicidade.
            </p>

            <h2 className="text-lg font-semibold text-foreground mt-8">8. Alterações nesta Política</h2>
            <p className="text-muted-foreground">
              Podemos atualizar esta política periodicamente. Notificaremos sobre mudanças significativas
              por email ou por aviso na plataforma. O uso continuado após as alterações constitui aceitação.
            </p>

            <h2 className="text-lg font-semibold text-foreground mt-8">9. Contato</h2>
            <p className="text-muted-foreground">
              Para dúvidas, solicitações ou exercício de seus direitos, entre em contato conosco
              pelo email: <a href="mailto:privacidade@geogestor.com.br" className="text-primary underline">privacidade@geogestor.com.br</a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
