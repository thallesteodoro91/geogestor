import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DatePickerField } from '../../../apps/web/src/components/form-controls/DatePickerField';
import { FormSelect } from '../../../apps/web/src/components/form-controls/SelectField';
import { Modal } from '../../../apps/web/src/components/Modal';

function Fixture() {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({ empty: '', stored: '2026-12-31', required: '2026-02-28', limits: '2026-10-20', readonly: '2026-10-20', disabled: '2026-10-20', noclear: '2026-10-20' });
  const fields = Object.keys(values).map(key => <div key={key} className="space-y-2">
    <label htmlFor={'fixture-' + key} className="block text-sm text-text-primary">EXEMPLO FICTÍCIO — {key}</label>
    <DatePickerField id={'fixture-' + key} name={key} value={values[key]} required={key === 'required'} readOnly={key === 'readonly'} disabled={key === 'disabled'} min={key === 'limits' ? '2026-10-18' : undefined} max={key === 'limits' ? '2026-10-22' : undefined} allowClear={key === 'noclear' ? false : undefined} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} className="min-h-11 w-full px-3 text-sm" />
  </div>);
  const content = <form onSubmit={event => event.preventDefault()} className="space-y-5"><p className="text-sm text-text-primary">EXEMPLO FICTÍCIO — Teste isolado do componente, sem gravação.</p>{fields}<div><label htmlFor="fixture-default">EXEMPLO FICTÍCIO — defaultValue</label><DatePickerField id="fixture-default" name="uncontrolled" defaultValue="2026-10-21" className="min-h-11 px-3" /></div><div><label htmlFor="fixture-select">EXEMPLO FICTÍCIO — seletor preservado</label><FormSelect id="fixture-select" defaultValue="1"><option value="1">EXEMPLO FICTÍCIO — opção 1</option><option value="2">EXEMPLO FICTÍCIO — opção 2</option></FormSelect></div></form>;
  return <main className="min-h-screen bg-brand-bg p-4 text-text-primary"><h1 className="mb-4 text-xl">EXEMPLO FICTÍCIO — Calendário isolado</h1><button className="geo-button-base geo-button-secondary px-4" onClick={() => setOpen(true)}>Abrir formulário fictício</button>{new URLSearchParams(location.search).get('mode') === 'page' ? content : <Modal isOpen={open} onClose={() => setOpen(false)} title="EXEMPLO FICTÍCIO — Formulário" initialFocusId="fixture-stored" footer={<button className="geo-button-base geo-button-secondary px-4" onClick={() => setOpen(false)}>Fechar formulário fictício</button>}>{content}</Modal>}</main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
