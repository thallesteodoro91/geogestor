import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export const colorOptions = [
  { name: 'green', hex: '#22c55e', label: 'Verde' },
  { name: 'emerald', hex: '#10b981', label: 'Esmeralda' },
  { name: 'teal', hex: '#14b8a6', label: 'Teal' },
  { name: 'cyan', hex: '#06b6d4', label: 'Ciano' },
  { name: 'blue', hex: '#3b82f6', label: 'Azul' },
  { name: 'indigo', hex: '#6366f1', label: 'Índigo' },
  { name: 'purple', hex: '#a855f7', label: 'Roxo' },
  { name: 'pink', hex: '#ec4899', label: 'Rosa' },
  { name: 'rose', hex: '#f43f5e', label: 'Rose' },
  { name: 'red', hex: '#ef4444', label: 'Vermelho' },
  { name: 'orange', hex: '#f97316', label: 'Laranja' },
  { name: 'amber', hex: '#f59e0b', label: 'Âmbar' },
  { name: 'yellow', hex: '#eab308', label: 'Amarelo' },
  { name: 'slate', hex: '#64748b', label: 'Cinza' },
];

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const selectedColor = colorOptions.find((c) => c.name === value) || colorOptions[4]; // default blue

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('w-[120px] justify-start gap-2', className)}
        >
          <div
            className="h-4 w-4 rounded-full border border-border"
            style={{ backgroundColor: selectedColor.hex }}
          />
          <span className="text-xs truncate">Cor</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-3" align="start">
        <div className="grid grid-cols-7 gap-2">
          {colorOptions.map((color) => {
            const isSelected = value === color.name;
            return (
              <button
                key={color.name}
                type="button"
                onClick={() => {
                  onChange(color.name);
                  setOpen(false);
                }}
                className={cn(
                  'relative flex h-7 w-7 items-center justify-center rounded-full transition-transform',
                  'hover:scale-110',
                  isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                )}
                style={{ backgroundColor: color.hex }}
                title={color.label}
              >
                {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
