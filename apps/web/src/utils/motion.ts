import type { Transition } from 'framer-motion';

export const geoEase = [0.4, 0, 0.2, 1] as const;

export const geoMotion = {
  fast: 0.18,
  standard: 0.24,
  modal: 0.28,
};

export const geoViewTransition: Transition = {
  duration: geoMotion.standard,
  ease: geoEase,
};

export const geoModalTransition: Transition = {
  duration: geoMotion.modal,
  ease: geoEase,
};

export const geoHoverTransition: Transition = {
  duration: geoMotion.fast,
  ease: geoEase,
};
