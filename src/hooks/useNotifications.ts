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
  id_referencia?: string | null;
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

  const clearAllNotifications = async () => {
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) return;
      
      // Registrar dismissal para notificações de vencimento antes de deletar
      // Isso garante que não apareçam novamente por 3 dias
      const overdueNotifications = notifications.filter(n => n.tipo === 'vencido' && n.id_referencia);
      
      if (overdueNotifications.length > 0) {
        const dismissals = overdueNotifications.map(n => ({
          tenant_id: tenantId,
          id_referencia: n.id_referencia,
          tipo: 'vencido',
          dismissed_at: new Date().toISOString()
        }));
        
        // Upsert para atualizar data de dismissal se já existir
        await supabase
          .from('notificacao_dismissals')
          .upsert(dismissals, { 
            onConflict: 'tenant_id,id_referencia,tipo',
            ignoreDuplicates: false 
          });
      }
      
      const { error } = await supabase
        .from('notificacoes')
        .delete()
        .eq('tenant_id', tenantId);

      if (error) throw error;
      
      setNotifications([]);
      toast.success("Notificações limpas com sucesso");
    } catch (error: any) {
      console.error('Erro ao limpar notificações:', error);
      toast.error("Erro ao limpar notificações");
    }
  };

  const dismissNotification = async (id: string) => {
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) return;
      
      const notification = notifications.find(n => n.id_notificacao === id);
      
      // Se for notificação de vencimento, registrar dismissal
      if (notification?.tipo === 'vencido' && notification?.id_referencia) {
        await supabase
          .from('notificacao_dismissals')
          .upsert({
            tenant_id: tenantId,
            id_referencia: notification.id_referencia,
            tipo: 'vencido',
            dismissed_at: new Date().toISOString()
          }, { 
            onConflict: 'tenant_id,id_referencia,tipo',
            ignoreDuplicates: false 
          });
      }
      
      // Deletar a notificação
      const { error } = await supabase
        .from('notificacoes')
        .delete()
        .eq('id_notificacao', id);

      if (error) throw error;
      
      setNotifications(prev => prev.filter(n => n.id_notificacao !== id));
    } catch (error: any) {
      console.error('Erro ao descartar notificação:', error);
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
    clearAllNotifications,
    dismissNotification,
    createNotification,
    checkPendingPayments,
    refetch: fetchNotifications
  };
};
