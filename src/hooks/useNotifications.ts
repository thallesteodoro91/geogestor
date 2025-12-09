import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getCurrentTenantId } from "@/services/supabase.service";

export interface Notification {
  id_notificacao: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  created_at: string;
  prioridade: string;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar notificações:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('id_notificacao', id);

      if (error) throw error;
      
      setNotifications(prev => 
        prev.map(n => n.id_notificacao === id ? { ...n, lida: true } : n)
      );
    } catch (error: any) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('lida', false);

      if (error) throw error;
      
      setNotifications(prev => prev.map(n => ({ ...n, lida: true })));
      toast.success("Todas as notificações foram marcadas como lidas");
    } catch (error: any) {
      console.error('Erro ao marcar todas como lidas:', error);
      toast.error("Erro ao marcar notificações");
    }
  };

  const createNotification = async (
    tipo: string,
    titulo: string,
    mensagem: string,
    link: string | null = null,
    prioridade: string = 'normal',
    id_referencia: string | null = null
  ) => {
    try {
      // Obter tenant_id do usuário atual
      const tenantId = await getCurrentTenantId();
      
      if (!tenantId) {
        console.warn('Notificação não criada: tenant_id não encontrado');
        return null;
      }

      const { data, error } = await supabase
        .from('notificacoes')
        .insert({
          tipo,
          titulo,
          mensagem,
          link,
          prioridade,
          id_referencia,
          tenant_id: tenantId
        })
        .select()
        .single();

      if (error) throw error;
      
      // Adicionar na lista local
      setNotifications(prev => [data, ...prev]);
      return data;
    } catch (error: any) {
      console.error('Erro ao criar notificação:', error);
      throw error;
    }
  };

  const checkPendingPayments = async () => {
    try {
      const { error } = await supabase.rpc('verificar_pagamentos_pendentes');
      if (error) throw error;
      
      // Recarregar notificações após verificar pagamentos
      await fetchNotifications();
    } catch (error: any) {
      console.error('Erro ao verificar pagamentos pendentes:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Realtime subscription
    const channel = supabase
      .channel('notificacoes-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes'
        },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.lida).length;

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    createNotification,
    checkPendingPayments,
    refetch: fetchNotifications
  };
};
