import { SelectField } from './form-controls/SelectField';
import type { ChangeEvent } from 'react';
import { cn } from '../utils/cn';
import { filterActiveControlClass, filterControlClass } from '../utils/filterStyles';

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  placeholder: string;
  id?: string;
  name?: string;
  ariaLabel?: string;
  className?: string;
  buttonClassName?: string;
}

export function CustomSelect({ value, onChange, options, placeholder, id, name, ariaLabel, className, buttonClassName }: CustomSelectProps) {
  const isActiveValue = Boolean(value && !['Todos', 'Todas', 'ALL', 'all'].includes(value));
  return (
    <SelectField
      id={id}
      name={name}
      aria-label={ariaLabel || placeholder}
      value={value}
      onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
      searchable={options.length > 12}
      searchPlaceholder={`Pesquisar ${placeholder.toLocaleLowerCase('pt-BR')}`}
      wrapperClassName={cn('min-w-[150px]', className)}
      className={cn(filterControlClass, isActiveValue && filterActiveControlClass, buttonClassName)}
    >
      {!options.some((option) => option.value === '') && !value && <option value="">{placeholder}</option>}
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </SelectField>
  );
}
