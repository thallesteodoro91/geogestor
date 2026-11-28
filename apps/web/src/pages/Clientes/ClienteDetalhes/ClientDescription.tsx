import { useId, useLayoutEffect, useRef, useState } from 'react';
import { secondarySmallActionButtonClass } from '../../../utils/actionStyles';

export function ClientDescription({ text }: { text?: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);
  const paragraph = useRef<HTMLParagraphElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    const element = paragraph.current;
    if (!element || expanded) return;
    const measure = () => setClipped(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, expanded]);
  return <div className="mt-3 min-w-0"><p ref={paragraph} id={id} className={`whitespace-pre-wrap text-sm leading-relaxed text-zinc-600 dark:text-zinc-300 ${expanded ? '' : 'line-clamp-2'}`}>{text || 'Sem descrição cadastrada.'}</p>{clipped && <button type="button" aria-expanded={expanded} aria-controls={id} onClick={()=>setExpanded(value=>!value)} className={secondarySmallActionButtonClass + ' mt-2'}>{expanded ? 'Recolher descrição' : 'Mostrar descrição completa'}</button>}</div>;
}
