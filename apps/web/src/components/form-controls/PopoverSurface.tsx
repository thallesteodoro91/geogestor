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
  /** Calendars can use the viewport when neither side has enough usable height. */
  minimumHeight?: number;
  role?: 'dialog' | 'listbox' | 'menu';
  id?: string;
  ariaLabel?: string;
  portalContainer?: HTMLElement | null;
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
  minimumHeight = 0,
  role,
  id,
  ariaLabel,
  portalContainer
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
      const container = portalContainer?.getBoundingClientRect();
      const boundaryLeft = Math.max(viewportPadding, container ? container.left + viewportPadding : 0);
      const boundaryRight = Math.min(viewportWidth - viewportPadding, container ? container.right - viewportPadding : viewportWidth);
      const boundaryTop = Math.max(viewportPadding, container ? container.top + viewportPadding : 0);
      const boundaryBottom = Math.min(viewportHeight - viewportPadding, container ? container.bottom - viewportPadding : viewportHeight);
      const width = Math.min(Math.max(rect.width, minWidth), maxWidth, boundaryRight - boundaryLeft);
      const left = Math.max(boundaryLeft, Math.min(rect.left, boundaryRight - width));
      const availableBelow = boundaryBottom - rect.bottom - gap;
      const availableAbove = rect.top - gap - boundaryTop;
      const above = availableBelow < Math.min(minimumHeight || 240, maxHeight) && availableAbove > availableBelow;
      const available = above ? availableAbove : availableBelow;
      const viewportHeightAvailable = Math.max(0, boundaryBottom - boundaryTop);
      const useViewport = minimumHeight > 0 && available < Math.min(minimumHeight, maxHeight, viewportHeightAvailable);
      const fittedHeight = Math.min(maxHeight, viewportHeightAvailable);

      setPosition({
        left,
        top: useViewport ? Math.max(boundaryTop, Math.min(rect.bottom + gap, boundaryBottom - fittedHeight)) : above ? rect.top - gap : rect.bottom + gap,
        width,
        maxHeight: useViewport ? fittedHeight : Math.max(container ? 0 : 144, Math.min(maxHeight, available)),
        above: !useViewport && above,
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
  }, [anchorRef, maxHeight, maxWidth, minWidth, minimumHeight, open, portalContainer]);

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
    portalContainer || document.body
  );
});
