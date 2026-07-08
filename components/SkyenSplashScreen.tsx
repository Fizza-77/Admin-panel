import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

type SkyenSplashScreenProps = {
  shouldShow: boolean;
  triggerKey: number;
};

export default function SkyenSplashScreen({ shouldShow, triggerKey }: SkyenSplashScreenProps) {
  const reduceMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (!shouldShow) {
      setIsVisible(false);
      setIsLeaving(false);
      return;
    }

    setIsVisible(true);
    setIsLeaving(false);

    const exitTimer = window.setTimeout(() => {
      setIsLeaving(true);
    }, 2000);

    return () => window.clearTimeout(exitTimer);
  }, [shouldShow, triggerKey]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          aria-label="Skyen Systems loading"
          role="status"
          className="fixed inset-0 z-[10050] flex items-center justify-center overflow-hidden bg-[#17172f]"
          initial={reduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
          animate={
            isLeaving
              ? reduceMotion
                ? { opacity: 0 }
                : { y: '-105%', opacity: 0.98 }
              : { y: 0, opacity: 1 }
          }
          exit={{ opacity: 0 }}
          transition={
            reduceMotion
              ? { duration: 0.2, ease: 'easeOut' }
              : { duration: isLeaving ? 0.85 : 0.4, ease: [0.76, 0, 0.24, 1] }
          }
          onAnimationComplete={() => {
            if (!isLeaving) {
              return;
            }

            setIsVisible(false);
          }}
        >
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/16 blur-[120px]" />
            <div className="absolute -left-20 top-0 h-80 w-80 rounded-full bg-indigo-500/20 blur-[100px]" />
            <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-teal-400/14 blur-[120px]" />
            <div
              className="absolute inset-0 opacity-[0.18]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
                backgroundSize: '54px 54px',
              }}
            />
          </div>

          <motion.div
            className="relative flex flex-col items-center"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="absolute h-56 w-56 rounded-[3rem] bg-cyan-300/20 blur-3xl sm:h-72 sm:w-72"
              aria-hidden
              animate={reduceMotion ? undefined : { scale: [1, 1.08, 1], opacity: [0.55, 0.85, 0.55] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="relative rounded-[2.25rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-cyan-950/40 backdrop-blur-md sm:p-5">
              <Image
                src="/skyen-systems.png"
                alt="Skyen Systems"
                width={240}
                height={240}
                priority
                sizes="(max-width: 640px) 176px, 240px"
                className="h-44 w-44 rounded-[1.75rem] object-cover shadow-2xl shadow-black/30 sm:h-60 sm:w-60"
              />
            </div>
            <p className="mt-7 text-sm font-medium uppercase tracking-[0.38em] text-cyan-100/80">
              Admin Panel
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
