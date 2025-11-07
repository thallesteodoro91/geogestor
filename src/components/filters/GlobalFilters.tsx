import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface GlobalFiltersProps {
  clientes?: Array<{ id: string; nome: string }>;
  empresas?: Array<{ id: string; nome: string }>;
  onFilterChange?: (filters: FilterState) => void;
  showEmpresa?: boolean;
}

export interface FilterState {
  dataInicio: string;
  dataFim: string;
  clienteId: string;
  empresaId: string;
  categoria: string;
  situacao: string;
}

export const GlobalFilters = ({ 
  clientes = [], 
  empresas = [],
  onFilterChange,
  showEmpresa = true 
}: GlobalFiltersProps) => {
  const [filters, setFilters] = useState<FilterState>({
    dataInicio: "",
    dataFim: "",
    clienteId: "",
    empresaId: "",
    categoria: "",
    situacao: "",
  });

  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const clearFilters = () => {
    const emptyFilters: FilterState = {
      dataInicio: "",
      dataFim: "",
      clienteId: "",
      empresaId: "",
      categoria: "",
      situacao: "",
    };
    setFilters(emptyFilters);
    onFilterChange?.(emptyFilters);
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== "").length;

  return (
    <Card className="mb-6">
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Filtros</CardTitle>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary">{activeFiltersCount} ativos</Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
            {isExpanded ? "Ocultar" : "Expandir"}
          </Button>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Período */}
            <div className="space-y-2">
              <Label htmlFor="dataInicio" className="flex items-center gap-1">
                <CalendarIcon className="h-4 w-4" />
                Data Início
              </Label>
              <Input
                id="dataInicio"
                type="date"
                value={filters.dataInicio}
                onChange={(e) => handleFilterChange("dataInicio", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataFim" className="flex items-center gap-1">
                <CalendarIcon className="h-4 w-4" />
                Data Fim
              </Label>
              <Input
                id="dataFim"
                type="date"
                value={filters.dataFim}
                onChange={(e) => handleFilterChange("dataFim", e.target.value)}
              />
            </div>

            {/* Cliente */}
            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente</Label>
              <Select value={filters.clienteId} onValueChange={(v) => handleFilterChange("clienteId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Categoria */}
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select value={filters.categoria} onValueChange={(v) => handleFilterChange("categoria", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  <SelectItem value="Topografia">Topografia</SelectItem>
                  <SelectItem value="Ambiental">Ambiental</SelectItem>
                  <SelectItem value="Jurídico">Jurídico</SelectItem>
                  <SelectItem value="Especial">Especial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Situação */}
            <div className="space-y-2">
              <Label htmlFor="situacao">Situação</Label>
              <Select value={filters.situacao} onValueChange={(v) => handleFilterChange("situacao", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as situações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  <SelectItem value="Concluído">Concluído</SelectItem>
                  <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Empresa (opcional) */}
            {showEmpresa && empresas.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="empresa">Empresa</Label>
                <Select value={filters.empresaId} onValueChange={(v) => handleFilterChange("empresaId", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as empresas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Botão Limpar */}
          {activeFiltersCount > 0 && (
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};