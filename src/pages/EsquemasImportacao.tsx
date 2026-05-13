import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useTenant } from "@/contexts/TenantContext";
import {
  listMappingProfiles,
  renameMappingProfile,
  deleteMappingProfileByKey,
  type MappingProfile,
} from "@/lib/etl/mappingProfiles";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, FileSpreadsheet, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export default function EsquemasImportacao() {
  const { tenant } = useTenant();
  const [profiles, setProfiles] = useState<MappingProfile[]>([]);
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState<MappingProfile | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<MappingProfile | null>(null);
  const [viewing, setViewing] = useState<MappingProfile | null>(null);

  const refresh = () => setProfiles(listMappingProfiles(tenant?.id ?? null));

  useEffect(() => { refresh(); }, [tenant?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(p =>
      (p.fileName ?? "").toLowerCase().includes(q) ||
      p.entity.toLowerCase().includes(q) ||
      p.headers.some(h => h.toLowerCase().includes(q))
    );
  }, [profiles, search]);

  const handleRename = () => {
    if (!renaming) return;
    const ok = renameMappingProfile(renaming.tenantId, renaming.entity, renaming.signature, renameValue);
    if (ok) {
      toast.success("Esquema renomeado");
      refresh();
      setRenaming(null);
    } else {
      toast.error("Não foi possível renomear o esquema");
    }
  };

  const handleDelete = () => {
    if (!deleting) return;
    deleteMappingProfileByKey(deleting.tenantId, deleting.entity, deleting.signature);
    toast.success("Esquema excluído");
    refresh();
    setDeleting(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Esquemas de importação"
          subtitle="Esquemas de mapeamento salvos automaticamente quando você importa planilhas"
        />

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome, entidade ou coluna…"
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="icon" onClick={refresh} title="Recarregar">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileSpreadsheet className="mx-auto h-10 w-10 mb-3 opacity-50" />
                <p>Nenhum esquema salvo {search ? "para essa busca" : "ainda"}.</p>
                <p className="text-xs mt-1">Os esquemas são criados automaticamente ao concluir uma importação.</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Entidade</TableHead>
                      <TableHead>Colunas</TableHead>
                      <TableHead>Campos mapeados</TableHead>
                      <TableHead>Atualizado</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => (
                      <TableRow
                        key={`${p.entity}-${p.signature}`}
                        className="cursor-pointer"
                        onClick={() => setViewing(p)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{p.fileName || <span className="text-muted-foreground italic">Sem nome</span>}</span>
                            <Badge variant="outline" className="text-xs">v{p.version ?? 1}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{p.entity}</Badge>
                        </TableCell>
                        <TableCell>{p.headers.length}</TableCell>
                        <TableCell>{Object.keys(p.mappings).length}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {fmtDate(p.updatedAt)}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => {
                              setRenameValue(p.fileName ?? "");
                              setRenaming(p);
                            }}
                            title="Renomear"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => setDeleting(p)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rename dialog */}
      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear esquema</DialogTitle>
            <DialogDescription>
              Defina um nome para identificar este esquema mais facilmente.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Ex: Planilha clientes ABC"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>Cancelar</Button>
            <Button onClick={handleRename}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View details dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.fileName || "Detalhes do esquema"}</DialogTitle>
            <DialogDescription>
              Entidade: <Badge variant="secondary">{viewing?.entity}</Badge>{" "}
              · Atualizado em {viewing && fmtDate(viewing.updatedAt)}
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2">Mapeamentos ({Object.keys(viewing.mappings).length})</h4>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campo do sistema</TableHead>
                          <TableHead>Coluna da planilha</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(viewing.mappings).map(([field, header]) => (
                          <TableRow key={field}>
                            <TableCell className="font-mono text-xs">{field}</TableCell>
                            <TableCell>{header}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2">Colunas da planilha ({viewing.headers.length})</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {viewing.headers.map((h) => (
                      <Badge key={h} variant="outline" className="text-xs">{h}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esquema?</AlertDialogTitle>
            <AlertDialogDescription>
              O esquema "{deleting?.fileName || "sem nome"}" será removido. Esta ação não pode ser desfeita,
              mas um novo esquema será criado na próxima importação com a mesma estrutura de planilha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
