import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { iconMap, availableIcons, getIconComponent } from '@/lib/iconMap';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function IconPicker({ value, onChange, className }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const SelectedIcon = getIconComponent(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('w-[120px] justify-start gap-2', className)}
        >
          <SelectedIcon className="h-4 w-4" />
          <span className="text-xs truncate">Ícone</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-2" align="start">
        <ScrollArea className="h-[200px]">
          <div className="grid grid-cols-6 gap-1">
            {availableIcons.map((iconName) => {
              const Icon = iconMap[iconName];
              const isSelected = value === iconName;
              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => {
                    onChange(iconName);
                    setOpen(false);
                  }}
                  className={cn(
                    'relative flex h-9 w-9 items-center justify-center rounded-md border transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-transparent'
                  )}
                  title={iconName}
                >
                  <Icon className="h-4 w-4" />
                  {isSelected && (
                    <Check className="absolute -top-1 -right-1 h-3 w-3 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
