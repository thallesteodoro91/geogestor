import { useEffect, useState, useRef } from "react";
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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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
      
      const overdueNotifications = notifications.filter(n => n.tipo === 'vencido' && n.id_referencia);
      
      if (overdueNotifications.length > 0) {
        const dismissals = overdueNotifications.map(n => ({
          tenant_id: tenantId,
          id_referencia: n.id_referencia,
          tipo: 'vencido',
          dismissed_at: new Date().toISOString()
        }));
        
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
      
      // O Realtime INSERT handler já adiciona na lista local
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
      
      await fetchNotifications();
    } catch (error: any) {
      console.error('Erro ao verificar pagamentos pendentes:', error);
    }
  };

  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      await fetchNotifications();

      const tenantId = await getCurrentTenantId();
      if (!tenantId || !mounted) return;

      // Verificar pagamentos 1x por sessão (max 1x por hora)
      const lastCheck = sessionStorage.getItem('lastPaymentCheck');
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      if (!lastCheck || now - parseInt(lastCheck) > oneHour) {
        checkPendingPayments();
        sessionStorage.setItem('lastPaymentCheck', now.toString());
      }

      // Realtime com filtro por tenant
      const channel = supabase
        .channel('notificacoes-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notificacoes',
            filter: `tenant_id=eq.${tenantId}`
          },
          (payload) => {
            const nova = payload.new as Notification;
            setNotifications(prev => [nova, ...prev].slice(0, 10));
            toast.info(`Nova notificação: ${nova.titulo}`);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'notificacoes',
            filter: `tenant_id=eq.${tenantId}`
          },
          (payload) => {
            const removed = payload.old as any;
            setNotifications(prev =>
              prev.filter(n => n.id_notificacao !== removed.id_notificacao)
            );
          }
        )
        .subscribe();

      channelRef.current = channel;
    };

    setup();

    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
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
    refetch: fetchNotifications
  };
};
