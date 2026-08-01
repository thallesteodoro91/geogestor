import { Link, type LinkProps } from 'react-router-dom';
import { preloadRoute } from '../utils/routePreloaders';
import { markNavigationIntent } from '../utils/navigationMetrics';

function getPathname(to: LinkProps['to']) {
  if (typeof to === 'string') return to.split(/[?#]/, 1)[0];
  return to.pathname;
}

export function PreloadLink({
  to,
  onPointerEnter,
  onPointerDown,
  onFocus,
  onClick,
  ...props
}: LinkProps) {
  const pathname = getPathname(to);

  return (
    <Link
      {...props}
      to={to}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) markNavigationIntent(pathname);
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        if (!event.defaultPrevented) preloadRoute(pathname);
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (!event.defaultPrevented) preloadRoute(pathname);
      }}
      onFocus={(event) => {
        onFocus?.(event);
        if (!event.defaultPrevented) preloadRoute(pathname);
      }}
    />
  );
}
