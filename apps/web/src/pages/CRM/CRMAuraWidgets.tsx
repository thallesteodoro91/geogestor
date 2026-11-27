import { useId } from 'react';
import { MagnifyingGlass, Plus } from '@phosphor-icons/react';
import { AuraAttentionWidget, AuraWidget } from '../../components/AuraWidget';
import { formatDateKey } from '../../utils/localDate';
import type { Contato } from '../Contatos/Contatos';
import './crm-aura.css';

export function CRMRecentContactsWidget({ contacts, loading, failed, onCreate, onOpen, onSearch, onRetry }: {
  contacts: Contato[];
  loading: boolean;
  failed: boolean;
  onCreate: () => void;
  onOpen: (contact: Contato) => void;
  onSearch: () => void;
  onRetry: () => void;
}) {
  const headingId = useId();

  return (
    <AuraWidget as="section" tone="teal" className="crm-aura crm-aura--recent" aria-labelledby={headingId}>
      <header className="crm-aura__recent-heading">
        <h2 id={headingId}>Contatos recentes</h2>
        <button type="button" className="geo-focus-ring crm-aura__recent-add" aria-label="Cadastrar novo lead" onClick={onCreate}>
          <Plus size={15} aria-hidden="true" />
        </button>
      </header>
      {loading ? (
        <p role="status" className="crm-aura__detail">Carregando contatos recentes…</p>
      ) : failed ? (
        <div className="crm-aura__recent-error">
          <p role="status" className="crm-aura__detail">Falha ao carregar os contatos recentes.</p>
          <button type="button" className="geo-focus-ring" onClick={onRetry}>Tentar novamente</button>
        </div>
      ) : contacts.length > 0 ? (
        <ul className="crm-aura__recent-list">
          {contacts.map(contact => {
            const names = contact.nome.trim().split(/\s+/u);
            const firstName = names[0] || contact.nome;
            const initials = [names[0], names.length > 1 ? names.at(-1) : undefined]
              .map(name => Array.from(name ?? '')[0] ?? '')
              .join('').toLocaleUpperCase('pt-BR');
            return (
              <li key={contact.id}>
                <button type="button" className="geo-focus-ring crm-aura__recent-item" onClick={() => onOpen(contact)} aria-label={`Abrir ficha de ${contact.nome}`} title={contact.nome}>
                  <span className="crm-aura__recent-avatar" aria-hidden="true">{initials}</span>
                  <span className="crm-aura__recent-name" data-long-name={Array.from(firstName).length > 7 || undefined}>{firstName}</span>
                </button>
              </li>
            );
          })}
          <li>
            <button type="button" className="geo-focus-ring crm-aura__recent-item crm-aura__recent-search" onClick={onSearch} aria-label="Ir para a busca de leads">
              <span className="crm-aura__recent-avatar"><MagnifyingGlass size={19} aria-hidden="true" /></span>
              <span className="crm-aura__recent-name">Buscar</span>
            </button>
          </li>
        </ul>
      ) : (
        <p className="crm-aura__detail">Nenhum contato cadastrado.</p>
      )}
    </AuraWidget>
  );
}

export function CRMNextActionWidget({ title, action, date, overdue, onOpen }: {
  title: string;
  action: string;
  date: string;
  overdue: boolean;
  onOpen: () => void;
}) {
  return (
    <AuraAttentionWidget
      headingAs="h2"
      headingId="crm-next-priority"
      className="crm-aura--next w-full max-w-[260px]"
      label={overdue ? 'Ação atrasada' : 'Próxima ação'}
      value={<p className="aura-attention__text">{action}</p>}
      detail={title}
      date={{ iso: date.slice(0, 10), label: formatDateKey(date) }}
      action={<button type="button" className="geo-focus-ring aura-attention__overlay" aria-label={`Abrir oportunidade ${title}`} onClick={onOpen} />}
    />
  );
}
