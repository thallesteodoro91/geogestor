import { useEffect, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook de autenticação resiliente a refresh de token.
 *
 * Importante: o Supabase faz refresh automático do token a cada ~50min,
 * o que dispara `onAuthStateChange` mesmo sem login/logout real. Antes,
 * cada refresh criava uma NOVA referência de `user`, gerando re-render
 * em toda a árvore e fazendo formulários/filtros perderem estado local.
 *
 * Agora só atualizamos o estado quando o `user.id` realmente muda
 * (login, logout ou troca de conta). O objeto `session` mais recente
 * fica disponível via ref para quem precisar do token atualizado.
 */
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      sessionRef.current = session;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        sessionRef.current = session;
        const nextUser = session?.user ?? null;
        // Só dispara re-render quando o identity efetivamente muda.
        setUser((prev) => {
          if (prev?.id === nextUser?.id) return prev;
          return nextUser;
        });
      },
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, loading, signOut, sessionRef };
};
