import { db } from '../db';
import { schema } from '@geogestor/database';
import { and, eq, like } from 'drizzle-orm';
import crypto from 'crypto';
import { OperationalLogService } from './operational-log.service';

type JornadaEventInput = {
  clienteId: string;
  projetoId?: string | null;
  orcamentoId?: string | null;
  tipo: string;
  titulo: string;
  categoria?: string | null;
  descricao: string;
  data?: string;
  manual?: boolean;
};

type DocumentoAgrupadoInput = {
  clienteId: string;
  projetoId?: string | null;
  nomeArquivo: string;
  categoria: string;
  data?: string;
};

export class JornadaService {
  static async logClienteEvento(input: JornadaEventInput, dbOrTx?: any) {
    try {
      const eventDate = input.data || new Date().toISOString();

      await (dbOrTx ?? db).insert(schema.interacoes_cliente).values({
        id: crypto.randomUUID(),
        clienteId: input.clienteId,
        projetoId: input.projetoId || null,
        orcamentoId: input.orcamentoId || null,
        tipo: input.tipo,
        titulo: input.titulo,
        categoria: input.categoria || input.tipo,
        manual: input.manual !== undefined ? input.manual : false,
        data: eventDate,
        descricao: input.descricao
      });
    } catch (err) {
      await OperationalLogService.error('journey-write-failed', { type: input.tipo, error: err });
      if (dbOrTx) throw err;
    }
  }

  static async logDocumentoAgrupado(input: DocumentoAgrupadoInput, dbOrTx?: any) {
    try {
      const eventDateIso = input.data || new Date().toISOString();
      const diaPrefix = eventDateIso.slice(0, 10); // YYYY-MM-DD
      const cat = input.categoria || 'Documentos';

      // Busca se já existe um evento na jornada de hoje para essa tag/categoria
      const existentes = await (dbOrTx || db)
        .select()
        .from(schema.interacoes_cliente)
        .where(
          and(
            eq(schema.interacoes_cliente.clienteId, input.clienteId),
            eq(schema.interacoes_cliente.tipo, 'Documento'),
            eq(schema.interacoes_cliente.categoria, cat),
            like(schema.interacoes_cliente.data, `${diaPrefix}%`)
          )
        )
        .limit(1);

      if (existentes.length > 0) {
        const interacao = existentes[0];
        const descAtual = interacao.descricao || '';

        // Se o arquivo ainda não estiver listado nessa caixa, adiciona
        if (!descAtual.includes(input.nomeArquivo)) {
          const linhas = descAtual
            .split('\n')
            .map((l: string) => l.trim())
            .filter((l: string) => l.startsWith('- '));

          linhas.push(`- ${input.nomeArquivo}`);
          const contagem = linhas.length;

          const novoTitulo = `Documentos adicionados: ${cat} (${contagem} arquivos)`;
          const dataFormatada = new Date(eventDateIso).toLocaleDateString('pt-BR');
          const cabecalho = `Arquivos anexados em ${dataFormatada} [${cat}]:`;
          const novaDescricao = `${cabecalho}\n${linhas.join('\n')}`;

          await (dbOrTx || db)
            .update(schema.interacoes_cliente)
            .set({
              titulo: novoTitulo,
              descricao: novaDescricao,
              data: eventDateIso // Sobe o cartão para o topo da jornada de hoje
            })
            .where(eq(schema.interacoes_cliente.id, interacao.id));
        }
        return;
      }

      // Se não existe, cria a primeira caixa do dia para a tag
      const dataFormatada = new Date(eventDateIso).toLocaleDateString('pt-BR');
      const tituloInicial = `Documentos adicionados: ${cat} (1 arquivo)`;
      const cabecalhoInicial = `Arquivos anexados em ${dataFormatada} [${cat}]:`;
      const descInicial = `${cabecalhoInicial}\n- ${input.nomeArquivo}`;

      await (dbOrTx || db).insert(schema.interacoes_cliente).values({
        id: crypto.randomUUID(),
        clienteId: input.clienteId,
        projetoId: input.projetoId || null,
        tipo: 'Documento',
        titulo: tituloInicial,
        categoria: cat,
        manual: false,
        data: eventDateIso,
        descricao: descInicial
      });
    } catch (err) {
      await OperationalLogService.error('journey-document-write-failed', { category: input.categoria, error: err });
      if (dbOrTx) throw err;
    }
  }
}
