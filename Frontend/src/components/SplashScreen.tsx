import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface SplashScreenProps {
  isLoading?: boolean;
  onFinish?: () => void;
}

export function SplashScreen({ isLoading = true, onFinish }: SplashScreenProps) {
  const shouldReduceMotion = useReducedMotion();
  const [minTimerDone, setMinTimerDone] = useState(false);

  // Smooth entrance threshold (200ms) and safety timeout (2500ms)
  useEffect(() => {
    const minTimer = window.setTimeout(() => {
      setMinTimerDone(true);
    }, 200);

    const safetyTimer = window.setTimeout(() => {
      if (onFinish) onFinish();
    }, 2500);

    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(safetyTimer);
    };
  }, [onFinish]);

  useEffect(() => {
    if (!isLoading && minTimerDone && onFinish) {
      onFinish();
    }
  }, [isLoading, minTimerDone, onFinish]);

  return (
    <motion.div
      key="nutritrack-splash-screen"
      role="status"
      aria-live="polite"
      aria-label="NutriTrack AI is loading"
      initial={{ opacity: 1 }}
      exit={
        shouldReduceMotion
          ? { opacity: 0, transition: { duration: 0.25 } }
          : {
              opacity: 0,
              scale: 1.03,
              filter: 'blur(6px)',
              transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
            }
      }
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden select-none"
      style={{
        backgroundColor: '#F8F6EF',
        paddingTop: 'max(24px, env(safe-area-inset-top))',
        paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(20px, env(safe-area-inset-left))',
        paddingRight: 'max(20px, env(safe-area-inset-right))',
        minHeight: '100dvh',
      }}
    >
      {/* Refined multi-layered ambient background for depth and premium organic feeling */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Soft Sage radial glow top-right */}
        <div
          className="absolute -top-28 -right-28 rounded-full pointer-events-none"
          style={{
            width: '380px',
            height: '380px',
            background: 'radial-gradient(circle, rgba(168,197,160,0.38) 0%, rgba(168,197,160,0) 70%)',
            filter: 'blur(50px)',
          }}
        />
        {/* Deep Forest glow bottom-left */}
        <div
          className="absolute -bottom-32 -left-32 rounded-full pointer-events-none"
          style={{
            width: '420px',
            height: '420px',
            background: 'radial-gradient(circle, rgba(36,76,58,0.22) 0%, rgba(36,76,58,0) 72%)',
            filter: 'blur(55px)',
          }}
        />
        {/* Coral warmth accent lower-right */}
        <div
          className="absolute bottom-1/5 right-1/6 rounded-full pointer-events-none"
          style={{
            width: '260px',
            height: '260px',
            background: 'radial-gradient(circle, rgba(240,138,112,0.18) 0%, rgba(240,138,112,0) 70%)',
            filter: 'blur(45px)',
          }}
        />
        {/* Subtle radial center highlight for warm ivory canvas */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 50% 38%, rgba(255,255,255,0.75) 0%, rgba(248,246,239,0.3) 55%, rgba(242,238,228,0.85) 100%)',
          }}
        />
      </div>

      {/* Top Brand Category Pill */}
      <motion.div
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05 }}
        className="relative z-10 w-full flex justify-center pt-2"
        aria-hidden="true"
      >
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full shadow-xs backdrop-blur-md"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            border: '1px solid rgba(36, 76, 58, 0.12)',
          }}
        >
          <span
            className="rounded-full animate-pulse"
            style={{ width: '6px', height: '6px', backgroundColor: '#244C3A' }}
          />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#315C47',
            }}
          >
            Nutrition &amp; Wellbeing
          </span>
        </div>
      </motion.div>

      {/* Center Hero Brand Block */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 -mt-2">
        {/* Animated Container with Logo */}
        <div className="relative mb-6">
          {/* Breathing ambient halo */}
          {!shouldReduceMotion ? (
            <motion.div
              animate={{
                scale: [1, 1.14, 1],
                opacity: [0.35, 0.65, 0.35],
              }}
              transition={{
                duration: 3.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute -inset-3.5 rounded-[36px] pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle, rgba(168,197,160,0.55) 0%, rgba(36,76,58,0.25) 55%, transparent 75%)',
                filter: 'blur(16px)',
              }}
              aria-hidden="true"
            />
          ) : (
            <div
              className="absolute -inset-3.5 rounded-[36px] pointer-events-none"
              style={{
                background: 'rgba(168,197,160,0.3)',
                filter: 'blur(16px)',
              }}
              aria-hidden="true"
            />
          )}

          {/* Elevated Logo Card Container */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.85, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              duration: 0.55,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="relative flex items-center justify-center"
            style={{
              width: '106px',
              height: '106px',
              borderRadius: '28px',
              padding: '10px',
              background: 'linear-gradient(180deg, #FFFFFF 0%, #F5F8F3 100%)',
              border: '1.5px solid rgba(168, 197, 160, 0.45)',
              boxShadow:
                '0 20px 45px -10px rgba(36, 76, 58, 0.22), 0 6px 18px rgba(36, 76, 58, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.95)',
            }}
          >
            {/* Preserved NutriTrack Leaf SVG Logo */}
            <svg
              style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 2px 4px rgba(36,76,58,0.12))' }}
              viewBox="0 0 128 128"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-label="NutriTrack AI Logo"
            >
              <rect width="128" height="128" rx="34" fill="#244C3A" />
              <path
                d="M92 27C63 29 39 40 31 61c-7 18 3 37 21 39 27 4 46-23 40-73Z"
                fill="#A8C5A0"
              />
              <path
                d="M32 96c12-18 29-33 53-48"
                fill="none"
                stroke="#FFFDF8"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M50 73c2 8 8 14 17 17M61 60c8 1 15 5 20 11"
                fill="none"
                stroke="#FFFDF8"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <circle cx="91" cy="28" r="5" fill="#F08A70" />
            </svg>
          </motion.div>

          {/* Floating Subtle Moving Leaf Accent */}
          {!shouldReduceMotion && (
            <motion.div
              animate={{
                y: [0, -6, 0],
                rotate: [0, 8, -4, 0],
              }}
              transition={{
                duration: 3.8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute flex items-center justify-center pointer-events-none"
              style={{
                top: '-8px',
                right: '-8px',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 4px 12px rgba(36, 76, 58, 0.14)',
                border: '1px solid rgba(168, 197, 160, 0.45)',
              }}
              aria-hidden="true"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"
                  fill="#315C47"
                />
                <path d="M2 21c0-3 1.85-5.36 5.08-6" stroke="#A8C5A0" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </motion.div>
          )}
        </div>

        {/* Brand Name Typography */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: 0.15,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="flex items-center justify-center gap-2 mb-2"
        >
          <h1
            style={{
              fontFamily: "'Manrope', 'DM Sans', sans-serif",
              fontSize: '1.75rem',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              color: '#244C3A',
              margin: 0,
            }}
          >
            Nutri<span style={{ color: '#315C47' }}>Track</span>
          </h1>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              backgroundColor: '#EBF3E8',
              color: '#244C3A',
              border: '1px solid rgba(168, 197, 160, 0.65)',
              boxShadow: '0 1px 3px rgba(36, 76, 58, 0.08)',
            }}
          >
            AI
          </span>
        </motion.div>

        {/* Brand Tagline */}
        <motion.p
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: 0.28,
            ease: [0.16, 1, 0.3, 1],
          }}
          style={{
            fontSize: '0.9375rem',
            fontWeight: 500,
            color: '#4A5C4C',
            letterSpacing: '0.01em',
            margin: 0,
            maxWidth: '280px',
          }}
        >
          Eat smarter. Live healthier.
        </motion.p>
      </div>

      {/* Bottom Loading Indicator & Status */}
      <div className="relative z-10 w-full max-w-xs mx-auto flex flex-col items-center pb-2">
        {isLoading ? (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.36 }}
            className="w-full flex flex-col items-center gap-3"
          >
            {/* Sleek indeterminate loading progress bar */}
            <div
              style={{
                width: '210px',
                height: '5px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(215, 228, 212, 0.75)',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: 'inset 0 1px 2px rgba(36, 76, 58, 0.08)',
              }}
              role="progressbar"
              aria-label="Loading application"
            >
              {!shouldReduceMotion ? (
                <motion.div
                  animate={{
                    x: ['-100%', '100%'],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  style={{
                    width: '50%',
                    height: '100%',
                    borderRadius: '9999px',
                    background: 'linear-gradient(90deg, #A8C5A0 0%, #244C3A 50%, #F08A70 100%)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#244C3A',
                    opacity: 0.8,
                  }}
                />
              )}
            </div>

            {/* Preparation status text */}
            <motion.p
              animate={
                !shouldReduceMotion
                  ? {
                      opacity: [0.75, 1, 0.75],
                    }
                  : {}
              }
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{
                fontSize: '12.5px',
                fontWeight: 500,
                color: '#5C6F5D',
                letterSpacing: '0.015em',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Preparing your nutrition dashboard…</span>
            </motion.p>
          </motion.div>
        ) : (
          <div style={{ height: '42px' }} />
        )}

        {/* Subtle footer privacy / security assurance */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-6 flex items-center justify-center gap-2"
          style={{
            fontSize: '11px',
            color: '#768777',
            letterSpacing: '0.01em',
          }}
        >
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: '#A8C5A0',
            }}
          />
          <span>Private &amp; Secure Health Companion</span>
        </motion.div>
      </div>
    </motion.div>
  );
}
