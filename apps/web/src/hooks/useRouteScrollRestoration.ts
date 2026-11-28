import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

interface PageScrollPosition {
  windowY: number;
  mainY: number;
}

const positions = new Map<string, PageScrollPosition>();

function readPosition(): PageScrollPosition {
  return {
    windowY: window.scrollY,
    mainY: document.getElementById('main-content')?.scrollTop ?? 0
  };
}

export function useRouteScrollRestoration() {
  const { key, pathname, state } = useLocation();
  const navigationType = useNavigationType();
  const activeRoute = useRef({ key, pathname });
  const restoring = useRef(false);

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const main = document.getElementById('main-content');
    const savePosition = () => {
      if (!restoring.current) positions.set(activeRoute.current.key, readPosition());
    };
    window.addEventListener('scroll', savePosition, { passive: true });
    main?.addEventListener('scroll', savePosition, { passive: true });
    return () => {
      savePosition();
      window.removeEventListener('scroll', savePosition);
      main?.removeEventListener('scroll', savePosition);
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    const previous = activeRoute.current;
    if (previous.key === key && previous.pathname === pathname) return;
    if (!positions.has(previous.key)) positions.set(previous.key, readPosition());
    activeRoute.current = { key, pathname };

    const main = document.getElementById('main-content');
    const saved = navigationType === 'POP' ? positions.get(key) : undefined;
    if (!saved || !main) {
      if (pathname !== previous.pathname || (state as { scrollToTopFromSidebar?: boolean } | null)?.scrollToTopFromSidebar) {
        window.scrollTo(0, 0);
        main?.scrollTo(0, 0);
      }
      return;
    }

    restoring.current = true;
    let finished = false;
    let frame = 0;
    let timeout = 0;
    const finish = () => {
      if (finished) return;
      finished = true;
      restoring.current = false;
      observer.disconnect();
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      window.removeEventListener('wheel', finish);
      window.removeEventListener('pointerdown', finish);
      window.removeEventListener('keydown', finish);
    };
    const restore = () => {
      if (main.querySelector('[data-route-pathname]')?.getAttribute('data-route-pathname') !== pathname) return;
      window.scrollTo(0, saved.windowY);
      main.scrollTop = saved.mainY;
      if (Math.abs(window.scrollY - saved.windowY) <= 2 && Math.abs(main.scrollTop - saved.mainY) <= 2) finish();
    };

    const observer = new MutationObserver(restore);
    observer.observe(main, { childList: true, subtree: true });
    const resizeObserver = new ResizeObserver(restore);
    resizeObserver.observe(main);
    frame = window.requestAnimationFrame(restore);
    timeout = window.setTimeout(finish, 5000);
    window.addEventListener('wheel', finish, { once: true });
    window.addEventListener('pointerdown', finish, { once: true });
    window.addEventListener('keydown', finish, { once: true });
    return finish;
  }, [key, navigationType, pathname, state]);
}
