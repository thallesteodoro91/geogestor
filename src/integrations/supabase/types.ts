export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      dim_cliente: {
        Row: {
          anotacoes: string | null
          categoria: string | null
          celular: string | null
          cnpj: string | null
          cpf: string | null
          created_at: string | null
          data_cadastro: string | null
          email: string | null
          endereco: string | null
          id_cliente: string
          idade: number | null
          nome: string
          origem: string | null
          situacao: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          anotacoes?: string | null
          categoria?: string | null
          celular?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string | null
          data_cadastro?: string | null
          email?: string | null
          endereco?: string | null
          id_cliente?: string
          idade?: number | null
          nome: string
          origem?: string | null
          situacao?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          anotacoes?: string | null
          categoria?: string | null
          celular?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string | null
          data_cadastro?: string | null
          email?: string | null
          endereco?: string | null
          id_cliente?: string
          idade?: number | null
          nome?: string
          origem?: string | null
          situacao?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dim_data: {
        Row: {
          ano: number | null
          created_at: string | null
          data: string
          dia_semana: string | null
          id_data: string
          mes: number | null
          trimestre: number | null
        }
        Insert: {
          ano?: number | null
          created_at?: string | null
          data: string
          dia_semana?: string | null
          id_data?: string
          mes?: number | null
          trimestre?: number | null
        }
        Update: {
          ano?: number | null
          created_at?: string | null
          data?: string
          dia_semana?: string | null
          id_data?: string
          mes?: number | null
          trimestre?: number | null
        }
        Relationships: []
      }
      dim_empresa: {
        Row: {
          created_at: string | null
          custo: number | null
          custos_variaveis: number | null
          despesas: number | null
          id_empresa: string
          lucro_bruto: number | null
          lucro_liquido: number | null
          margem_de_contribuicao: number | null
          nome: string
          ponto_de_equilibrio: number | null
          receita: number | null
          template_config: Json | null
          template_orcamento_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custo?: number | null
          custos_variaveis?: number | null
          despesas?: number | null
          id_empresa?: string
          lucro_bruto?: number | null
          lucro_liquido?: number | null
          margem_de_contribuicao?: number | null
          nome: string
          ponto_de_equilibrio?: number | null
          receita?: number | null
          template_config?: Json | null
          template_orcamento_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custo?: number | null
          custos_variaveis?: number | null
          despesas?: number | null
          id_empresa?: string
          lucro_bruto?: number | null
          lucro_liquido?: number | null
          margem_de_contribuicao?: number | null
          nome?: string
          ponto_de_equilibrio?: number | null
          receita?: number | null
          template_config?: Json | null
          template_orcamento_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dim_propriedade: {
        Row: {
          anotacoes: string | null
          area_ha: number | null
          averbacao: string | null
          car: string | null
          ccir: string | null
          cidade: string | null
          created_at: string | null
          documentacao: string | null
          id_cliente: string | null
          id_propriedade: string
          itr: string | null
          latitude: number | null
          longitude: number | null
          marco: string | null
          matricula: string | null
          memorial_descritivo: string | null
          municipio: string | null
          nome_da_propriedade: string
          observacoes: string | null
          possui_memorial_descritivo: string | null
          situacao: string | null
          situacao_imovel: string | null
          tipo: string | null
          tipo_de_documento: string | null
          updated_at: string | null
          usucapiao: string | null
        }
        Insert: {
          anotacoes?: string | null
          area_ha?: number | null
          averbacao?: string | null
          car?: string | null
          ccir?: string | null
          cidade?: string | null
          created_at?: string | null
          documentacao?: string | null
          id_cliente?: string | null
          id_propriedade?: string
          itr?: string | null
          latitude?: number | null
          longitude?: number | null
          marco?: string | null
          matricula?: string | null
          memorial_descritivo?: string | null
          municipio?: string | null
          nome_da_propriedade: string
          observacoes?: string | null
          possui_memorial_descritivo?: string | null
          situacao?: string | null
          situacao_imovel?: string | null
          tipo?: string | null
          tipo_de_documento?: string | null
          updated_at?: string | null
          usucapiao?: string | null
        }
        Update: {
          anotacoes?: string | null
          area_ha?: number | null
          averbacao?: string | null
          car?: string | null
          ccir?: string | null
          cidade?: string | null
          created_at?: string | null
          documentacao?: string | null
          id_cliente?: string | null
          id_propriedade?: string
          itr?: string | null
          latitude?: number | null
          longitude?: number | null
          marco?: string | null
          matricula?: string | null
          memorial_descritivo?: string | null
          municipio?: string | null
          nome_da_propriedade?: string
          observacoes?: string | null
          possui_memorial_descritivo?: string | null
          situacao?: string | null
          situacao_imovel?: string | null
          tipo?: string | null
          tipo_de_documento?: string | null
          updated_at?: string | null
          usucapiao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dim_propriedade_id_cliente_fkey"
            columns: ["id_cliente"]
            isOneToOne: false
            referencedRelation: "dim_cliente"
            referencedColumns: ["id_cliente"]
          },
        ]
      }
      dim_tipodespesa: {
        Row: {
          categoria: string
          created_at: string | null
          descricao: string | null
          id_tipodespesa: string
          subcategoria: string | null
          updated_at: string | null
        }
        Insert: {
          categoria: string
          created_at?: string | null
          descricao?: string | null
          id_tipodespesa?: string
          subcategoria?: string | null
          updated_at?: string | null
        }
        Update: {
          categoria?: string
          created_at?: string | null
          descricao?: string | null
          id_tipodespesa?: string
          subcategoria?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fato_despesas: {
        Row: {
          created_at: string | null
          data_da_despesa: string
          id_data: string | null
          id_despesas: string
          id_servico: string | null
          id_tipodespesa: string | null
          observacoes: string | null
          updated_at: string | null
          valor_da_despesa: number
        }
        Insert: {
          created_at?: string | null
          data_da_despesa: string
          id_data?: string | null
          id_despesas?: string
          id_servico?: string | null
          id_tipodespesa?: string | null
          observacoes?: string | null
          updated_at?: string | null
          valor_da_despesa: number
        }
        Update: {
          created_at?: string | null
          data_da_despesa?: string
          id_data?: string | null
          id_despesas?: string
          id_servico?: string | null
          id_tipodespesa?: string | null
          observacoes?: string | null
          updated_at?: string | null
          valor_da_despesa?: number
        }
        Relationships: [
          {
            foreignKeyName: "fato_despesas_id_data_fkey"
            columns: ["id_data"]
            isOneToOne: false
            referencedRelation: "dim_data"
            referencedColumns: ["id_data"]
          },
          {
            foreignKeyName: "fato_despesas_id_servico_fkey"
            columns: ["id_servico"]
            isOneToOne: false
            referencedRelation: "fato_servico"
            referencedColumns: ["id_servico"]
          },
          {
            foreignKeyName: "fato_despesas_id_tipodespesa_fkey"
            columns: ["id_tipodespesa"]
            isOneToOne: false
            referencedRelation: "dim_tipodespesa"
            referencedColumns: ["id_tipodespesa"]
          },
        ]
      }
      fato_orcamento: {
        Row: {
          created_at: string | null
          data_do_faturamento: string | null
          data_inicio: string | null
          data_orcamento: string
          data_termino: string | null
          desconto: number | null
          faturamento: boolean | null
          forma_de_pagamento: string | null
          id_cliente: string | null
          id_data: string | null
          id_orcamento: string
          id_propriedade: string | null
          id_servico: string | null
          incluir_marco: boolean | null
          lucro_esperado: number | null
          marco_quantidade: number | null
          marco_valor_total: number | null
          marco_valor_unitario: number | null
          margem_esperada: number | null
          orcamento_convertido: boolean | null
          quantidade: number
          receita_esperada: number | null
          receita_esperada_imposto: number | null
          receita_realizada: number | null
          situacao: string | null
          situacao_do_pagamento: string | null
          updated_at: string | null
          valor_faturado: number | null
          valor_imposto: number | null
          valor_unitario: number
        }
        Insert: {
          created_at?: string | null
          data_do_faturamento?: string | null
          data_inicio?: string | null
          data_orcamento: string
          data_termino?: string | null
          desconto?: number | null
          faturamento?: boolean | null
          forma_de_pagamento?: string | null
          id_cliente?: string | null
          id_data?: string | null
          id_orcamento?: string
          id_propriedade?: string | null
          id_servico?: string | null
          incluir_marco?: boolean | null
          lucro_esperado?: number | null
          marco_quantidade?: number | null
          marco_valor_total?: number | null
          marco_valor_unitario?: number | null
          margem_esperada?: number | null
          orcamento_convertido?: boolean | null
          quantidade?: number
          receita_esperada?: number | null
          receita_esperada_imposto?: number | null
          receita_realizada?: number | null
          situacao?: string | null
          situacao_do_pagamento?: string | null
          updated_at?: string | null
          valor_faturado?: number | null
          valor_imposto?: number | null
          valor_unitario: number
        }
        Update: {
          created_at?: string | null
          data_do_faturamento?: string | null
          data_inicio?: string | null
          data_orcamento?: string
          data_termino?: string | null
          desconto?: number | null
          faturamento?: boolean | null
          forma_de_pagamento?: string | null
          id_cliente?: string | null
          id_data?: string | null
          id_orcamento?: string
          id_propriedade?: string | null
          id_servico?: string | null
          incluir_marco?: boolean | null
          lucro_esperado?: number | null
          marco_quantidade?: number | null
          marco_valor_total?: number | null
          marco_valor_unitario?: number | null
          margem_esperada?: number | null
          orcamento_convertido?: boolean | null
          quantidade?: number
          receita_esperada?: number | null
          receita_esperada_imposto?: number | null
          receita_realizada?: number | null
          situacao?: string | null
          situacao_do_pagamento?: string | null
          updated_at?: string | null
          valor_faturado?: number | null
          valor_imposto?: number | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "fato_orcamento_id_cliente_fkey"
            columns: ["id_cliente"]
            isOneToOne: false
            referencedRelation: "dim_cliente"
            referencedColumns: ["id_cliente"]
          },
          {
            foreignKeyName: "fato_orcamento_id_data_fkey"
            columns: ["id_data"]
            isOneToOne: false
            referencedRelation: "dim_data"
            referencedColumns: ["id_data"]
          },
          {
            foreignKeyName: "fato_orcamento_id_propriedade_fkey"
            columns: ["id_propriedade"]
            isOneToOne: false
            referencedRelation: "dim_propriedade"
            referencedColumns: ["id_propriedade"]
          },
          {
            foreignKeyName: "fato_orcamento_id_servico_fkey"
            columns: ["id_servico"]
            isOneToOne: false
            referencedRelation: "fato_servico"
            referencedColumns: ["id_servico"]
          },
        ]
      }
      fato_orcamento_itens: {
        Row: {
          created_at: string | null
          desconto: number | null
          id_item: string
          id_orcamento: string | null
          id_servico: string | null
          quantidade: number
          updated_at: string | null
          valor_mao_obra: number | null
          valor_unitario: number
        }
        Insert: {
          created_at?: string | null
          desconto?: number | null
          id_item?: string
          id_orcamento?: string | null
          id_servico?: string | null
          quantidade?: number
          updated_at?: string | null
          valor_mao_obra?: number | null
          valor_unitario: number
        }
        Update: {
          created_at?: string | null
          desconto?: number | null
          id_item?: string
          id_orcamento?: string | null
          id_servico?: string | null
          quantidade?: number
          updated_at?: string | null
          valor_mao_obra?: number | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "fato_orcamento_itens_id_orcamento_fkey"
            columns: ["id_orcamento"]
            isOneToOne: false
            referencedRelation: "fato_orcamento"
            referencedColumns: ["id_orcamento"]
          },
          {
            foreignKeyName: "fato_orcamento_itens_id_servico_fkey"
            columns: ["id_servico"]
            isOneToOne: false
            referencedRelation: "fato_servico"
            referencedColumns: ["id_servico"]
          },
        ]
      }
      fato_servico: {
        Row: {
          categoria: string | null
          created_at: string | null
          custo_servico: number | null
          data_do_servico_fim: string | null
          data_do_servico_inicio: string | null
          id_cliente: string | null
          id_data: string | null
          id_empresa: string | null
          id_propriedade: string | null
          id_servico: string
          nome_do_servico: string
          numero_de_servicos_concluidos: number | null
          receita_servico: number | null
          situacao_do_servico: string | null
          updated_at: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          custo_servico?: number | null
          data_do_servico_fim?: string | null
          data_do_servico_inicio?: string | null
          id_cliente?: string | null
          id_data?: string | null
          id_empresa?: string | null
          id_propriedade?: string | null
          id_servico?: string
          nome_do_servico: string
          numero_de_servicos_concluidos?: number | null
          receita_servico?: number | null
          situacao_do_servico?: string | null
          updated_at?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          custo_servico?: number | null
          data_do_servico_fim?: string | null
          data_do_servico_inicio?: string | null
          id_cliente?: string | null
          id_data?: string | null
          id_empresa?: string | null
          id_propriedade?: string | null
          id_servico?: string
          nome_do_servico?: string
          numero_de_servicos_concluidos?: number | null
          receita_servico?: number | null
          situacao_do_servico?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fato_servico_id_cliente_fkey"
            columns: ["id_cliente"]
            isOneToOne: false
            referencedRelation: "dim_cliente"
            referencedColumns: ["id_cliente"]
          },
          {
            foreignKeyName: "fato_servico_id_data_fkey"
            columns: ["id_data"]
            isOneToOne: false
            referencedRelation: "dim_data"
            referencedColumns: ["id_data"]
          },
          {
            foreignKeyName: "fato_servico_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "dim_empresa"
            referencedColumns: ["id_empresa"]
          },
          {
            foreignKeyName: "fato_servico_id_propriedade_fkey"
            columns: ["id_propriedade"]
            isOneToOne: false
            referencedRelation: "dim_propriedade"
            referencedColumns: ["id_propriedade"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string | null
          id_notificacao: string
          id_referencia: string | null
          lida: boolean | null
          link: string | null
          mensagem: string
          prioridade: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string | null
          id_notificacao?: string
          id_referencia?: string | null
          lida?: boolean | null
          link?: string | null
          mensagem: string
          prioridade?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string | null
          id_notificacao?: string
          id_referencia?: string | null
          lida?: boolean | null
          link?: string | null
          mensagem?: string
          prioridade?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      vw_alertas_financeiros: {
        Row: {
          alerta_conversao: Json | null
          alerta_custos: Json | null
          alerta_equilibrio: Json | null
          alerta_margem: Json | null
        }
        Relationships: []
      }
      vw_kpis_financeiros: {
        Row: {
          custo_total: number | null
          custos_variaveis_total: number | null
          despesas_fixas_total: number | null
          desvio_orcamentario_percent: number | null
          lucro_bruto: number | null
          lucro_liquido: number | null
          margem_bruta_percent: number | null
          margem_contribuicao_percent: number | null
          margem_liquida_percent: number | null
          ponto_equilibrio_receita: number | null
          receita_realizada_total: number | null
          receita_total: number | null
          servicos_concluidos: number | null
          taxa_conversao_percent: number | null
          ticket_medio: number | null
          total_clientes: number | null
          total_despesas: number | null
          total_orcamentos: number | null
          total_servicos: number | null
          valor_faturado_total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calcular_kpis: {
        Args: never
        Returns: {
          lucro_bruto: number
          lucro_liquido: number
          margem_bruta: number
          margem_liquida: number
          receita_total: number
          servicos_concluidos: number
          taxa_conversao: number
          ticket_medio: number
          total_despesas: number
          total_servicos: number
        }[]
      }
      calcular_kpis_v2: {
        Args: never
        Returns: {
          custo_total: number
          desvio_orcamentario_percent: number
          lucro_bruto: number
          lucro_liquido: number
          margem_bruta_percent: number
          margem_contribuicao_percent: number
          margem_liquida_percent: number
          ponto_equilibrio_receita: number
          receita_realizada_total: number
          receita_total: number
          servicos_concluidos: number
          taxa_conversao_percent: number
          ticket_medio: number
          total_clientes: number
          total_despesas: number
          total_orcamentos: number
          total_servicos: number
          valor_faturado_total: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      verificar_pagamentos_pendentes: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
