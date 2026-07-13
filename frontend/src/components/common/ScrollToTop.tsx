import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const getHashTargetId = (hash: string) => {
  const targetId = hash.slice(1);

  try {
    return decodeURIComponent(targetId);
  } catch {
    return targetId;
  }
};

export const ScrollToTop = () => {
  const { hash, key, pathname, search } = useLocation();

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    if (hash) {
      const animationFrameId = requestAnimationFrame(() => {
        const targetElement = document.getElementById(getHashTargetId(hash));

        if (targetElement) {
          targetElement.scrollIntoView();
          return;
        }

        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      });

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.history.scrollRestoration = previousScrollRestoration;
      };
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, [hash, key, pathname, search]);

  return null;
};
