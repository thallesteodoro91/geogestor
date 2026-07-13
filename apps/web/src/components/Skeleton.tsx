import { motion, useReducedMotion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0.5 }}
      animate={reduceMotion ? { opacity: 0.72 } : { opacity: [0.48, 0.9, 0.48] }}
      transition={reduceMotion ? { duration: 0 } : { repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
      className={`rounded-md bg-brand-surface-muted/80 dark:bg-brand-grey-700/70 ${className}`}
    />
  );
}
