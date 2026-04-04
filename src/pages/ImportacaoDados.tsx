import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { SmartImporter } from "@/components/import/SmartImporter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Briefcase, FileText, Receipt, MapPin, Upload } from "lucide-react";

const IMPORT_OPTIONS = [
  { key: "clientes", label: "Clientes", description: "Importe sua base de clientes com dados de contato e endereço", icon: Users },
  { key: "propriedades", label: "Propriedades", description: "Importe propriedades com localização e documentação", icon: MapPin },
  { key: "servicos", label: "Projetos", description: "Importe projetos com datas, clientes e status", icon: Briefcase },
  { key: "orcamentos", label: "Orçamentos", description: "Importe orçamentos e propostas comerciais", icon: FileText },
  { key: "despesas", label: "Despesas", description: "Importe despesas com categorias e valores", icon: Receipt },
] as const;

type EntityType = typeof IMPORT_OPTIONS[number]["key"];

export default function ImportacaoDados() {
  const [importOpen, setImportOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<EntityType>("clientes");

  const handleSelect = (entity: EntityType) => {
    setSelectedEntity(entity);
    setImportOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Importação de Dados"
          subtitle="Importe dados do Excel ou CSV para o sistema de forma rápida e inteligente"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {IMPORT_OPTIONS.map((opt) => (
            <Card
              key={opt.key}
              className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group"
              onClick={() => handleSelect(opt.key)}
            >
              <CardContent className="flex items-start gap-4 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0 group-hover:bg-primary/20 transition-colors">
                  <opt.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </div>
                <Upload className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary shrink-0 mt-1 transition-colors" />
              </CardContent>
            </Card>
          ))}
        </div>

        <SmartImporter
          open={importOpen}
          onOpenChange={setImportOpen}
          entityType={selectedEntity}
          onSuccess={() => {}}
        />
      </div>
    </AppLayout>
  );
}
