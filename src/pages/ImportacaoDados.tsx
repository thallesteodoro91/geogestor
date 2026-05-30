import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { SmartImporter, ImportEntityType } from "@/components/import/SmartImporter";
import { UniversalImporter } from "@/components/import/UniversalImporter";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Upload, ChevronDown, FileSpreadsheet, Users, MapPin, FileText, Briefcase, Receipt, Settings2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export default function ImportacaoDados() {
  const [importOpen, setImportOpen] = useState(false);
  const [universalOpen, setUniversalOpen] = useState(false);
  const [importEntity, setImportEntity] = useState<ImportEntityType>("completo");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const openImporter = (entity: ImportEntityType) => {
    setImportEntity(entity);
    setImportOpen(true);
  };

  const specificImports: { entity: ImportEntityType; label: string; icon: typeof Users }[] = [
    { entity: "clientes", label: "Clientes", icon: Users },
    { entity: "propriedades", label: "Propriedades", icon: MapPin },
    { entity: "orcamentos", label: "Orçamentos", icon: FileText },
    { entity: "servicos", label: "Projetos", icon: Briefcase },
    { entity: "despesas", label: "Despesas", icon: Receipt },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Importação de Dados"
          subtitle="Importe dados do Excel ou CSV — o sistema detecta automaticamente o tipo de dado"
        >
          <Button variant="outline" asChild>
            <Link to="/importacao/esquemas">
              <Settings2 className="h-4 w-4 mr-2" />
              Esquemas salvos
            </Link>
          </Button>
        </PageHeader>

        {/* Modo principal: importador universal */}
        <div
          className="border-2 border-dashed border-primary/40 rounded-lg p-16 text-center hover:border-primary transition-colors cursor-pointer bg-primary/5"
          onClick={() => setUniversalOpen(true)}
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-6 w-6 text-primary" />
            <Upload className="h-14 w-14 text-primary" />
          </div>
          <p className="text-lg font-medium text-foreground">
            Importação universal — clique para enviar sua planilha
          </p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            CSV, XLS ou XLSX. O sistema detecta clientes, propriedades, orçamentos e financeiro
            por conteúdo + cabeçalho, preserva colunas extras como campos personalizados e
            atualiza o Dashboard automaticamente.
          </p>
        </div>


        {/* Modo avançado: por entidade */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Importar entidade específica (avançado)
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="rounded-lg border border-border bg-muted/20 p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Use estes modos quando sua planilha contém apenas um tipo de dado e você quer mais controle sobre o mapeamento.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {specificImports.map(({ entity, label, icon: Icon }) => (
                  <Button
                    key={entity}
                    variant="outline"
                    className="h-auto flex-col gap-2 py-4"
                    onClick={() => openImporter(entity)}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs">{label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <SmartImporter
          open={importOpen}
          onOpenChange={setImportOpen}
          entityType={importEntity}
          onSuccess={() => {}}
        />

        <UniversalImporter
          open={universalOpen}
          onOpenChange={setUniversalOpen}
        />
      </div>
    </AppLayout>
  );
}
