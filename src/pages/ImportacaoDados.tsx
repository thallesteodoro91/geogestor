import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { SmartImporter } from "@/components/import/SmartImporter";
import { Upload } from "lucide-react";

export default function ImportacaoDados() {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Importação de Dados"
          subtitle="Importe dados do Excel ou CSV — o sistema detecta automaticamente o tipo de dado"
        />

        <div
          className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-16 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onClick={() => setImportOpen(true)}
        >
          <Upload className="h-14 w-14 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground">
            Clique aqui para importar sua planilha
          </p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Aceita CSV, XLS e XLSX — não precisa seguir modelo. O sistema identifica
            automaticamente se são clientes, propriedades, projetos, orçamentos ou despesas.
          </p>
        </div>

        <SmartImporter
          open={importOpen}
          onOpenChange={setImportOpen}
          entityType="completo"
          onSuccess={() => {}}
        />
      </div>
    </AppLayout>
  );
}
