import { useState } from 'react';
import { apiClient } from '../services/apiClient';

export function ConfiguracaoInicial() {
  const [empresaNome, setEmpresaNome] = useState('');
  const [dadosPasta, setDadosPasta] = useState('~/GeoGestor');
  const [adminNome, setAdminNome] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminSenha, setAdminSenha] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await apiClient.post('/api/configuracoes', {
        empresaNome, dadosPasta, adminNome, adminEmail, adminSenha
      });
      window.location.href = '/';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro de conexão com o servidor local.';
      alert(message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-zinc-900 p-8 rounded-lg shadow-md border border-gray-100 dark:border-zinc-800">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Bem-vindo ao GeoGestor
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-zinc-400">
            Configuração inicial do ambiente local
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="empresaNome" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Nome da Empresa</label>
              <input id="empresaNome" type="text" required value={empresaNome} onChange={e => setEmpresaNome(e.target.value)} className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 placeholder-gray-500 dark:placeholder-zinc-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm mt-1" />
            </div>
            <div>
              <label htmlFor="dadosPasta" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Pasta de Dados (Armazenamento)</label>
              <input id="dadosPasta" type="text" required value={dadosPasta} onChange={e => setDadosPasta(e.target.value)} className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 placeholder-gray-500 dark:placeholder-zinc-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm mt-1" />
            </div>
            <hr className="my-4" />
            <div>
              <label htmlFor="adminNome" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Nome do Administrador</label>
              <input id="adminNome" type="text" required value={adminNome} onChange={e => setAdminNome(e.target.value)} className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 placeholder-gray-500 dark:placeholder-zinc-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm mt-1" />
            </div>
            <div>
              <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">E-mail</label>
              <input id="adminEmail" type="email" required value={adminEmail} onChange={e => setAdminEmail(e.target.value)} className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 placeholder-gray-500 dark:placeholder-zinc-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm mt-1" />
            </div>
            <div>
              <label htmlFor="adminSenha" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Senha Local</label>
              <input id="adminSenha" type="password" required minLength={8} value={adminSenha} onChange={e => setAdminSenha(e.target.value)} className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 placeholder-gray-500 dark:placeholder-zinc-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm mt-1" />
              <p className="mt-1 text-xs font-medium text-gray-500 dark:text-zinc-400">Use pelo menos 8 caracteres.</p>
            </div>
          </div>

          <div>
            <button type="submit" disabled={loading} className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              {loading ? 'Salvando...' : 'Concluir Configuração'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
