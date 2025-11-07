import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { useState } from "react";

const clientesMock = [
  { id: 1, nome: "João Silva", cpf: "123.456.789-00", email: "joao@email.com", telefone: "(11) 99999-9999" },
  { id: 2, nome: "Maria Santos", cpf: "987.654.321-00", email: "maria@email.com", telefone: "(11) 98888-8888" },
  { id: 3, nome: "Pedro Oliveira", cpf: "456.789.123-00", email: "pedro@email.com", telefone: "(11) 97777-7777" },
];

const empresasMock = [
  { id: 1, nome: "Empresa ABC Ltda", cnpj: "12.345.678/0001-90", razaoSocial: "ABC Serviços Ltda" },
  { id: 2, nome: "XYZ Construções", cnpj: "98.765.432/0001-10", razaoSocial: "XYZ Construções S.A." },
];

const propriedadesMock = [
  { id: 1, nome: "Fazenda São José", area: "250 ha", localizacao: "Rural - Interior SP" },
  { id: 2, nome: "Terreno Urbano Central", area: "1.200 m²", localizacao: "Centro - São Paulo" },
  { id: 3, nome: "Loteamento Jardins", area: "85 ha", localizacao: "Subúrbio - Grande SP" },
];

const tiposDespesaMock = [
  { id: 1, categoria: "Equipamentos", subcategoria: "Manutenção", descricao: "Manutenção de equipamentos topográficos" },
  { id: 2, categoria: "Pessoal", subcategoria: "Salários", descricao: "Folha de pagamento" },
  { id: 3, categoria: "Transporte", subcategoria: "Combustível", descricao: "Combustível para deslocamentos" },
];

export default function Cadastros() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-heading font-bold text-foreground">Cadastros</h1>
          <p className="text-muted-foreground mt-2">Gerenciar clientes, empresas, propriedades e tipos de despesa</p>
        </div>

        <Tabs defaultValue="clientes" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="empresas">Empresas</TabsTrigger>
            <TabsTrigger value="propriedades">Propriedades</TabsTrigger>
            <TabsTrigger value="despesas">Tipos de Despesa</TabsTrigger>
          </TabsList>

          <TabsContent value="clientes" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Lista de Clientes</CardTitle>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar Cliente
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, CPF ou email..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientesMock.map((cliente) => (
                        <TableRow key={cliente.id}>
                          <TableCell className="font-medium">{cliente.nome}</TableCell>
                          <TableCell>{cliente.cpf}</TableCell>
                          <TableCell>{cliente.email}</TableCell>
                          <TableCell>{cliente.telefone}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="empresas" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Lista de Empresas</CardTitle>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar Empresa
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou CNPJ..."
                    className="pl-9"
                  />
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome Fantasia</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Razão Social</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {empresasMock.map((empresa) => (
                        <TableRow key={empresa.id}>
                          <TableCell className="font-medium">{empresa.nome}</TableCell>
                          <TableCell>{empresa.cnpj}</TableCell>
                          <TableCell>{empresa.razaoSocial}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="propriedades" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Lista de Propriedades</CardTitle>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar Propriedade
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou localização..."
                    className="pl-9"
                  />
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Área</TableHead>
                        <TableHead>Localização</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {propriedadesMock.map((prop) => (
                        <TableRow key={prop.id}>
                          <TableCell className="font-medium">{prop.nome}</TableCell>
                          <TableCell>{prop.area}</TableCell>
                          <TableCell>{prop.localizacao}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="despesas" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Lista de Tipos de Despesa</CardTitle>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar Tipo
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por categoria ou subcategoria..."
                    className="pl-9"
                  />
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Subcategoria</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tiposDespesaMock.map((tipo) => (
                        <TableRow key={tipo.id}>
                          <TableCell className="font-medium">{tipo.categoria}</TableCell>
                          <TableCell>{tipo.subcategoria}</TableCell>
                          <TableCell>{tipo.descricao}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
