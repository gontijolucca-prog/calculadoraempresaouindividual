import React, { createContext, useContext, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

// Detecta se o utilizador prefere movimento reduzido
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const ReducedMotionContext = createContext(false);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const reduced = useMemo(() => prefersReducedMotion(), []);
  return (
    <ReducedMotionContext.Provider value={reduced}>
      {children}
    </ReducedMotionContext.Provider>
  );
}

function useReducedMotion() {
  return useContext(ReducedMotionContext);
}

// Wrapper base que respeita prefers-reduced-motion
function MotionWrapper({
  children,
  className,
  initial,
  animate,
  exit,
  transition,
  ...props
}: React.ComponentPropsWithoutRef<typeof motion.div>) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      initial={initial}
      animate={animate}
      exit={exit}
      transition={transition}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// FadeIn — entrada suave com slide
export function FadeIn({
  children,
  delay = 0,
  duration = 0.35,
  direction = 'up',
  className,
  ...props
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<typeof motion.div>, 'children'>) {
  const offset = {
    up: { y: 24 },
    down: { y: -24 },
    left: { x: 24 },
    right: { x: -24 },
  }[direction];

  return (
    <MotionWrapper
      className={className}
      initial={{ opacity: 0, ...offset }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration, delay, ease: PREMIUM_EASE }}
      {...props}
    >
      {children}
    </MotionWrapper>
  );
}

// StaggerChildren — anima filhos com delay escalonado
export function StaggerChildren({
  children,
  staggerDelay = 0.05,
  initialDelay = 0,
  className,
}: {
  children: React.ReactNode;
  staggerDelay?: number;
  initialDelay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  const childArray = React.Children.toArray(children);
  return (
    <div className={className}>
      {childArray.map((child, i) => (
        <FadeIn key={i} delay={initialDelay + i * staggerDelay} duration={0.3}>
          {child}
        </FadeIn>
      ))}
    </div>
  );
}

// ScaleFade — entrada com scale (ideal para cards, badges)
export function ScaleFade({
  children,
  delay = 0,
  duration = 0.4,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  return (
    <MotionWrapper
      className={className}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration, delay, type: 'spring', stiffness: 200, damping: 20 }}
    >
      {children}
    </MotionWrapper>
  );
}

// HoverScale — micro-interação em cards/botões
export function HoverScale({
  children,
  className,
  scale = 1.02,
  tapScale = 0.97,
}: {
  children: React.ReactNode;
  className?: string;
  scale?: number;
  tapScale?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      whileHover={{ scale }}
      whileTap={{ scale: tapScale }}
      transition={{ duration: 0.15, ease: PREMIUM_EASE }}
    >
      {children}
    </motion.div>
  );
}

// AnimatedButton — botão com micro-interações
export function AnimatedButton({
  children,
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const reduced = useReducedMotion();
  if (reduced) {
    return (
      <button className={className} onClick={onClick} {...props}>
        {children}
      </button>
    );
  }
  return (
    <motion.button
      className={className}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15, ease: PREMIUM_EASE }}
      {...props}
    >
      {children}
    </motion.button>
  );
}

// PageTransition — wrapper para transições entre páginas
export function PageTransition({
  children,
  pageKey,
}: {
  children: React.ReactNode;
  pageKey: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <>{children}</>;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pageKey}
        className="h-full"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.35, ease: PREMIUM_EASE }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// AnimatedCard — card com hover suave
export function AnimatedCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <HoverScale className={className}>
      <motion.div
        whileHover={{ y: -3, boxShadow: '0 12px 40px -12px rgba(15, 23, 42, 0.12)' }}
        transition={{ duration: 0.25, ease: PREMIUM_EASE }}
      >
        {children}
      </motion.div>
    </HoverScale>
  );
}

// Hook reutilizável para gerir estado do flow mode
export function useFlowMode() {
  const [flowMode, setFlowMode] = React.useState(true);
  const [currentStep, setCurrentStep] = React.useState(0);

  const enterFlow = React.useCallback(() => {
    setFlowMode(true);
    setCurrentStep(0);
  }, []);

  const exitFlow = React.useCallback(() => {
    setFlowMode(false);
    setCurrentStep(0);
  }, []);

  return { flowMode, enterFlow, exitFlow, currentStep, setCurrentStep };
}
