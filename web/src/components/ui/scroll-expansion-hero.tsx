'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';

import { PathBackdrop } from '@/components/ui/background-paths';
import Balatro, { type BalatroProps } from '@/components/ui/balatro';
import { LoadingScreen } from '@/components/ui/loading-screen';
import SplashCursor from '@/components/ui/splash-cursor';
import type { ModelMetalPreset } from '@/components/ui/hero-gltf-coin';

const HeroGltfCoin = dynamic(
  () =>
    import('@/components/ui/hero-gltf-coin').then((mod) => mod.HeroGltfCoin),
  { ssr: false }
);

interface ScrollExpandMediaProps {
  mediaType?: 'video' | 'image' | 'model';
  mediaSrc: string;
  posterSrc?: string;
  /** Remote/local hero photo. Omit for solid black / Balatro + path backdrop. */
  bgImageSrc?: string;
  title?: string;
  date?: string;
  scrollToExpand?: string;
  textBlend?: boolean;
  /** WebGL Balatro shader when there is no bgImageSrc */
  showBalatroBackdrop?: boolean;
  /** Overrides for Balatro (colors, spin, pixelFilter, …) */
  balatroProps?: Partial<BalatroProps>;
  /** Animated SVG paths between background and hero content */
  showPathBackdrop?: boolean;
  /** When mediaType is model: rad/s around Y */
  modelRotationSpeed?: number;
  /** When mediaType is model: scale after centering */
  modelScale?: number;
  /** When mediaType is model: GLB materials vs silver PBR */
  modelMetalPreset?: ModelMetalPreset;
  children?: ReactNode;
}

const ESCROW_RISE_START = 0.55;

const DEFAULT_BALATRO: Partial<BalatroProps> = {
  spinRotation: -2,
  spinSpeed: 7,
  color1: '#4f4a4a',
  color2: '#5c5757',
  color3: '#000000',
  contrast: 4.5,
  lighting: 0.4,
  spinAmount: 0.3,
  pixelFilter: 1090,
  mouseInteraction: false,
};

const ScrollExpandMedia = ({
  mediaType = 'video',
  mediaSrc,
  posterSrc,
  bgImageSrc,
  title,
  date,
  scrollToExpand,
  textBlend,
  showBalatroBackdrop = true,
  balatroProps,
  showPathBackdrop = true,
  modelRotationSpeed = 0.85,
  modelScale = 1,
  modelMetalPreset = 'silver',
  children,
}: ScrollExpandMediaProps) => {
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [showContent, setShowContent] = useState<boolean>(false);
  const [mediaFullyExpanded, setMediaFullyExpanded] = useState<boolean>(false);
  const [touchStartY, setTouchStartY] = useState<number>(0);
  const [isMobileState, setIsMobileState] = useState<boolean>(false);
  const [viewportWidth, setViewportWidth] = useState<number>(1200);
  const [viewportHeight, setViewportHeight] = useState<number>(800);
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);
  const mediaFullyExpandedRef = useRef(false);
  const touchStartYRef = useRef(0);
  const prefersReducedMotion = useReducedMotion();

  const handleModelLoad = () => setModelLoaded(true);

  useEffect(() => {
    setScrollProgress(0);
    setShowContent(false);
    setMediaFullyExpanded(false);
  }, [mediaType, mediaSrc]);

  useEffect(() => {
    mediaFullyExpandedRef.current = mediaFullyExpanded;
  }, [mediaFullyExpanded]);

  useEffect(() => {
    touchStartYRef.current = touchStartY;
  }, [touchStartY]);

  useEffect(() => {
    const handleWheel = (e: globalThis.WheelEvent) => {
      if (mediaFullyExpandedRef.current && e.deltaY < 0 && window.scrollY <= 5) {
        setMediaFullyExpanded(false);
        setShowContent(false);
        setScrollProgress((prev) => Math.min(prev, 0.999));
        e.preventDefault();
      } else if (!mediaFullyExpandedRef.current) {
        e.preventDefault();
        const scrollDelta = e.deltaY * 0.00062;
        setScrollProgress((prev) => {
          const next = Math.min(Math.max(prev + scrollDelta, 0), 1);
          if (next >= 1) {
            setMediaFullyExpanded(true);
            setShowContent(true);
          } else if (next < ESCROW_RISE_START) {
            setShowContent(false);
          }
          return next;
        });
      }
    };

    const handleTouchStart = (e: globalThis.TouchEvent) => {
      setTouchStartY(e.touches[0].clientY);
    };

    const handleTouchMove = (e: globalThis.TouchEvent) => {
      if (!touchStartYRef.current) return;

      const touchY = e.touches[0].clientY;
      const deltaY = touchStartYRef.current - touchY;

      if (mediaFullyExpandedRef.current && deltaY < -20 && window.scrollY <= 5) {
        setMediaFullyExpanded(false);
        setShowContent(false);
        setScrollProgress((prev) => Math.min(prev, 0.999));
        e.preventDefault();
      } else if (!mediaFullyExpandedRef.current) {
        e.preventDefault();
        const scrollFactor = deltaY < 0 ? 0.0065 : 0.004;
        const scrollDelta = deltaY * scrollFactor;
        setScrollProgress((prev) => {
          const next = Math.min(Math.max(prev + scrollDelta, 0), 1);
          if (next >= 1) {
            setMediaFullyExpanded(true);
            setShowContent(true);
          } else if (next < ESCROW_RISE_START) {
            setShowContent(false);
          }
          return next;
        });

        setTouchStartY(touchY);
      }
    };

    const handleTouchEnd = (): void => {
      setTouchStartY(0);
    };

    const handleScroll = (): void => {
      if (!mediaFullyExpandedRef.current) {
        window.scrollTo(0, 0);
      }
    };

    window.addEventListener('wheel', handleWheel, {
      passive: false,
    });
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('touchstart', handleTouchStart, {
      passive: false,
    });
    window.addEventListener('touchmove', handleTouchMove, {
      passive: false,
    });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  useEffect(() => {
    const syncViewport = (): void => {
      const w = window.innerWidth;
      setIsMobileState(w < 768);
      setViewportWidth(w);
      setViewportHeight(window.innerHeight);
    };
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  const isModel = mediaType === 'model';
  /** Balatro + fluid sim + R3F: cap Balatro DPR on model path to keep frame time stable. */
  const showBalatroNow = showBalatroBackdrop;
  const mediaWidth = 300 + scrollProgress * (isMobileState ? 650 : 1250);
  const mediaHeight = 400 + scrollProgress * (isMobileState ? 200 : 400);
  const textTranslateX = scrollProgress * (isMobileState ? 180 : 150);
  const textShiftPx = (textTranslateX / 100) * viewportWidth;

  const firstWord = title ? title.split(' ')[0] : '';
  const restOfTitle = title ? title.split(' ').slice(1).join(' ') : '';

  const isCompactMobileViewport = isMobileState && viewportHeight < 760;
  const MODEL_W = isMobileState
    ? Math.min(viewportWidth * (isCompactMobileViewport ? 0.66 : 0.74), isCompactMobileViewport ? 290 : 340)
    : 480;
  const MODEL_H = isMobileState
    ? Math.min(viewportHeight * (isCompactMobileViewport ? 0.42 : 0.5), isCompactMobileViewport ? 250 : 320)
    : Math.min(viewportHeight * 0.82, 620);
  const modelXShift = isMobileState ? 0 : -scrollProgress * viewportWidth * 0.25;
  const modelYShift = isMobileState
    ? -Math.round(viewportHeight * (isCompactMobileViewport ? 0.22 : 0.15))
    : 0;
  const modelTransformX = modelXShift - MODEL_W / 2;
  const modelTransformY = -MODEL_H / 2 + modelYShift;
  const effectiveModelRotationSpeed = isMobileState ? modelRotationSpeed * 0.75 : modelRotationSpeed;
  const effectiveModelScale = isMobileState ? modelScale * 0.86 : modelScale;
  const titleOpacity = Math.max(0, Math.min(1, 1 - scrollProgress * 1.1));
  const escrowRevealT = showContent
    ? 1
    : Math.max(
        0,
        Math.min(1, (scrollProgress - ESCROW_RISE_START) / (1 - ESCROW_RISE_START))
      );
  const escrowY = (1 - escrowRevealT) * viewportHeight;
  const escrowPanelLeft = isMobileState ? 0 : viewportWidth / 2;
  const escrowPanelWidth = isMobileState ? viewportWidth : viewportWidth / 2;

  const reducedTween = { type: 'tween' as const, duration: 0.2, ease: 'easeOut' as const };
  const textSpring = prefersReducedMotion
    ? reducedTween
    : { type: 'spring' as const, stiffness: 120, damping: 30, mass: 0.85 };
  const modelSpring = prefersReducedMotion
    ? reducedTween
    : {
        type: 'spring' as const,
        stiffness: 140,
        damping: 32,
        mass: 0.55,
        restDelta: 0.5,
      };
  const escrowSpring = prefersReducedMotion
    ? reducedTween
    : {
        type: 'spring' as const,
        stiffness: 120,
        damping: 30,
        mass: 0.65,
        restDelta: 0.5,
      };

  return (
    <div className="overflow-x-hidden bg-black">
      {isModel && (
        <SplashCursor
          maxPixelRatio={1.2}
          SIM_RESOLUTION={48}
          DYE_RESOLUTION={384}
          CAPTURE_RESOLUTION={192}
          DENSITY_DISSIPATION={4.8}
          VELOCITY_DISSIPATION={2.1}
          PRESSURE={0.07}
          PRESSURE_ITERATIONS={6}
          CURL={1.6}
          SPLAT_RADIUS={0.005}
          SPLAT_FORCE={420}
          SHADING={false}
          COLOR_UPDATE_SPEED={0.25}
          RAINBOW_MODE={false}
          COLOR="#2d3748"
        />
      )}
      {isModel && <LoadingScreen visible={!modelLoaded} />}
      <section className="relative flex flex-col items-center justify-start min-h-screen bg-black">
        <div className="relative w-full flex flex-col items-center min-h-screen bg-black">
          <div className="absolute inset-0 z-0 h-full w-full bg-black">
            {bgImageSrc ? (
              <>
                <Image
                  src={bgImageSrc}
                  alt=""
                  width={1920}
                  height={1080}
                  className="h-screen w-screen"
                  style={{
                    objectFit: 'cover',
                    objectPosition: 'center',
                  }}
                  priority
                />
                <div className="absolute inset-0 bg-black/10" />
              </>
            ) : (
              <>
                {showBalatroNow && (
                  <div
                    className="absolute inset-x-0 top-0 z-[1] h-screen w-full bg-black isolate"
                    style={{ contain: 'strict' }}
                  >
                    <Balatro
                      {...DEFAULT_BALATRO}
                      {...balatroProps}
                      maxDpr={balatroProps?.maxDpr ?? (isModel ? 1.25 : 2)}
                      className="h-full w-full"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {showPathBackdrop && (
            <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
              <PathBackdrop />
            </div>
          )}

          {isModel ? (
            <div className="relative z-10 w-full min-h-screen bg-transparent">
              <motion.div
                className="absolute pointer-events-none z-20"
                style={{ top: '50%', left: '50%', width: MODEL_W, height: MODEL_H }}
                initial={false}
                animate={{ x: modelTransformX, y: modelTransformY }}
                transition={modelSpring}
                transformTemplate={({ x, y }) => `translate3d(${x}, ${y}, 0)`}
              >
                <div className="relative h-full w-full">
                  <HeroGltfCoin
                    modelSrc={mediaSrc}
                    rotationSpeed={effectiveModelRotationSpeed}
                    modelScale={effectiveModelScale}
                    metalPreset={modelMetalPreset}
                    onLoad={handleModelLoad}
                  />
                </div>
              </motion.div>

              {showContent ? (
                <div className="relative flex min-h-screen w-full flex-col bg-transparent md:flex-row md:items-stretch">
                  <aside className="flex flex-1 flex-col items-center justify-center border-transparent py-8 md:min-h-screen md:border-r md:border-border/15 md:py-12">
                    <div className="pointer-events-none" style={{ width: MODEL_W, height: MODEL_H }} />
                  </aside>
                  <main className="flex flex-1 flex-col justify-center bg-transparent px-6 py-10 md:px-10 lg:px-14">
                    {children}
                  </main>
                </div>
              ) : (
                <div className="relative w-full overflow-hidden" style={{ height: '100vh' }}>
                  <motion.div
                    className={`pointer-events-none absolute inset-x-0 bottom-[10%] z-10 flex w-full flex-col items-center justify-center gap-3 px-4 text-center md:bottom-[14%] md:gap-4 ${
                      textBlend ? 'mix-blend-difference' : 'mix-blend-normal'
                    }`}
                    initial={false}
                    animate={{ opacity: titleOpacity, y: (1 - titleOpacity) * 24 }}
                    transition={modelSpring}
                  >
                    {date && <p className="text-2xl text-white">{date}</p>}
                    {scrollToExpand && (
                      <p className="text-center font-medium text-white">{scrollToExpand}</p>
                    )}
                    <h2 className="text-4xl font-bold text-white md:text-5xl lg:text-6xl">
                      {firstWord}
                    </h2>
                    <h2 className="text-center text-4xl font-bold text-white md:text-5xl lg:text-6xl">
                      {restOfTitle}
                    </h2>
                  </motion.div>

                  <motion.div
                    className="absolute flex flex-col justify-center bg-transparent"
                    style={{
                      left: escrowPanelLeft,
                      top: 0,
                      width: escrowPanelWidth,
                      height: '100%',
                      paddingLeft: '1.5rem',
                      paddingRight: '1.5rem',
                      paddingTop: '2.5rem',
                      paddingBottom: '2.5rem',
                    }}
                    initial={false}
                    animate={{ y: escrowY }}
                    transition={escrowSpring}
                    transformTemplate={({ y }) => `translate3d(0, ${y}, 0)`}
                  >
                    {children}
                  </motion.div>
                </div>
              )}
            </div>
          ) : (
            <div className="container mx-auto flex flex-col items-center justify-start relative z-10">
              <div className="flex flex-col items-center justify-center w-full h-screen relative">
              <div
                className="absolute z-0 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 transition-none rounded-2xl"
                style={{
                  width: `${mediaWidth}px`,
                  height: `${mediaHeight}px`,
                  maxWidth: '95vw',
                  maxHeight: '85vh',
                  boxShadow: '0px 0px 50px rgba(0, 0, 0, 0.3)',
                }}
              >
                {mediaType === 'video' ? (
                  mediaSrc.includes('youtube.com') ? (
                    <div className="relative w-full h-full pointer-events-none">
                      <iframe
                        width="100%"
                        height="100%"
                        src={
                          mediaSrc.includes('embed')
                            ? mediaSrc +
                              (mediaSrc.includes('?') ? '&' : '?') +
                              'autoplay=1&mute=1&loop=1&controls=0&showinfo=0&rel=0&disablekb=1&modestbranding=1'
                            : mediaSrc.replace('watch?v=', 'embed/') +
                              '?autoplay=1&mute=1&loop=1&controls=0&showinfo=0&rel=0&disablekb=1&modestbranding=1&playlist=' +
                              mediaSrc.split('v=')[1]
                        }
                        className="w-full h-full rounded-xl"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                      <div
                        className="absolute inset-0 z-10"
                        style={{ pointerEvents: 'none' }}
                      />

                      <motion.div
                        className="absolute inset-0 bg-black/30 rounded-xl"
                        initial={{ opacity: 0.7 }}
                        animate={{ opacity: 0.5 - scrollProgress * 0.3 }}
                        transition={{ duration: 0.2 }}
                      />
                    </div>
                  ) : (
                    <div className="relative w-full h-full pointer-events-none">
                      <video
                        src={mediaSrc}
                        poster={posterSrc}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="auto"
                        className="w-full h-full object-cover rounded-xl"
                        controls={false}
                        disablePictureInPicture
                        disableRemotePlayback
                      />
                      <div
                        className="absolute inset-0 z-10"
                        style={{ pointerEvents: 'none' }}
                      />

                      <motion.div
                        className="absolute inset-0 bg-black/30 rounded-xl"
                        initial={{ opacity: 0.7 }}
                        animate={{ opacity: 0.5 - scrollProgress * 0.3 }}
                        transition={{ duration: 0.2 }}
                      />
                    </div>
                  )
                ) : (
                  <div className="relative w-full h-full">
                    <Image
                      src={mediaSrc}
                      alt={title || 'Media content'}
                      width={1280}
                      height={720}
                      className="w-full h-full object-cover rounded-xl"
                    />

                    <motion.div
                      className="absolute inset-0 bg-black/50 rounded-xl"
                      initial={{ opacity: 0.7 }}
                      animate={{ opacity: 0.7 - scrollProgress * 0.3 }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                )}

                <div className="flex flex-col items-center text-center relative z-10 mt-4 transition-none">
                  {date && (
                    <motion.p
                      className="text-2xl text-white"
                      initial={false}
                      animate={{ x: -textShiftPx }}
                      transition={textSpring}
                    >
                      {date}
                    </motion.p>
                  )}
                  {scrollToExpand && (
                    <motion.p
                      className="text-white font-medium text-center"
                      initial={false}
                      animate={{ x: textShiftPx }}
                      transition={textSpring}
                    >
                      {scrollToExpand}
                    </motion.p>
                  )}
                </div>
              </div>

              <div
                className={`flex items-center justify-center text-center gap-4 w-full relative z-10 transition-none flex-col ${
                  textBlend ? 'mix-blend-difference' : 'mix-blend-normal'
                }`}
              >
                <motion.h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white" initial={false} animate={{ x: -textShiftPx }} transition={textSpring}>
                  {firstWord}
                </motion.h2>
                <motion.h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-center text-white" initial={false} animate={{ x: textShiftPx }} transition={textSpring}>
                  {restOfTitle}
                </motion.h2>
              </div>
            </div>

            <motion.section
              className="flex flex-col w-full bg-background px-8 py-10 md:px-16 lg:py-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: showContent ? 1 : 0 }}
              transition={{ duration: 0.7 }}
            >
              {children}
            </motion.section>
          </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default ScrollExpandMedia;
