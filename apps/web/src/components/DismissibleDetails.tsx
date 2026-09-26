import { useEffect, useRef, type DetailsHTMLAttributes } from 'react';

export function DismissibleDetails({ children, onToggle, ...props }: DetailsHTMLAttributes<HTMLDetailsElement>) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeFromOutside = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (!details?.open || details.contains(event.target as Node)) return;
      details.open = false;
    };

    const closeFromKeyboard = (event: KeyboardEvent) => {
      const details = detailsRef.current;
      if (event.key !== 'Escape' || !details?.open) return;
      event.preventDefault();
      details.open = false;
      details.querySelector<HTMLElement>('summary')?.focus();
    };

    document.addEventListener('pointerdown', closeFromOutside, true);
    document.addEventListener('keydown', closeFromKeyboard);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside, true);
      document.removeEventListener('keydown', closeFromKeyboard);
    };
  }, []);

  return (
    <details
      {...props}
      ref={detailsRef}
      data-dismissible-details="true"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          document.querySelectorAll<HTMLDetailsElement>('details[data-dismissible-details="true"][open]').forEach((details) => {
            if (details !== event.currentTarget) details.open = false;
          });
        }
        onToggle?.(event);
      }}
    >
      {children}
    </details>
  );
}
