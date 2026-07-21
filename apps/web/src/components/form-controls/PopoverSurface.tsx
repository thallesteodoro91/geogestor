import { forwardRef, useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';

interface PopoverSurfaceProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
  minWidth?: number;
  maxWidth?: number;
  maxHeight?: number;
  role?: 'dialog' | 'listbox';
  id?: string;
  ariaLabel?: string;
}

interface PopoverPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  above: boolean;
  ready: boolean;
}

export const PopoverSurface = forwardRef<HTMLDivElement, PopoverSurfaceProps>(function PopoverSurface({
  open,
  anchorRef,
  children,
  className,
  minWidth = 180,
  maxWidth = 420,
  maxHeight = 352,
  role,
  id,
  ariaLabel
}, forwardedRef) {
  const [position, setPosition] = useState<PopoverPosition>({ left: 8, top: 8, width: minWidth, maxHeight, above: false, ready: false });

  useLayoutEffect(() => {
    if (!open) return;

    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const viewportPadding = 8;
      const gap = 8;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.min(Math.max(rect.width, minWidth), maxWidth, viewportWidth - viewportPadding * 2);
      const left = Math.max(viewportPadding, Math.min(rect.left, viewportWidth - width - viewportPadding));
      const availableBelow = viewportHeight - rect.bottom - gap - viewportPadding;
      const availableAbove = rect.top - gap - viewportPadding;
      const above = availableBelow < Math.min(240, maxHeight) && availableAbove > availableBelow;
      const available = above ? availableAbove : availableBelow;

      setPosition({
        left,
        top: above ? rect.top - gap : rect.bottom + gap,
        width,
        maxHeight: Math.max(144, Math.min(maxHeight, available)),
        above,
        ready: true
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, maxHeight, maxWidth, minWidth, open]);

  if (!open || typeof document === 'undefined') return null;

  const style: CSSProperties = {
    left: position.left,
    top: position.top,
    width: position.width,
    maxHeight: position.maxHeight,
    opacity: position.ready ? 1 : 0,
    transform: position.above ? 'translateY(-100%)' : undefined
  };

  return createPortal(
    <div
      ref={forwardedRef}
      id={id}
      role={role}
      aria-label={ariaLabel}
      style={style}
      className={cn(
        'geo-popover-surface fixed z-[140] overflow-hidden overscroll-contain motion-safe:animate-[geo-popover-in_150ms_ease-out]',
        className
      )}
    >
      {children}
    </div>,
    document.body
  );
});
