import React, { useEffect } from 'react';
import { motion } from 'motion/react';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [videoError, setVideoError] = React.useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 5000); 

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(20px)" }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="fixed inset-0 z-[1000] flex items-center justify-center overflow-hidden bg-slate-950 cursor-pointer"
      onClick={onComplete}
    >
      {/* Background Video or Animated Gradient */}
      {!videoError ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          onError={() => setVideoError(true)}
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        >
          <source src="/1000013491.mp4" type="video/mp4" />
        </video>
      ) : (
        <div className="absolute inset-0 bg-slate-950">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-500 via-transparent to-transparent animate-pulse" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        </div>
      )}

      {/* Dark Overlay with slight blur */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* Content Container */}
      <div className="relative z-10 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="flex flex-col items-center"
        >
          <motion.h1
            initial={{ opacity: 0, letterSpacing: "-0.05em" }}
            animate={{ opacity: 1, letterSpacing: "0.15em" }}
            transition={{ 
              duration: 2.5, 
              delay: 0.2,
              ease: [0.16, 1, 0.3, 1]
            }}
            className="text-6xl md:text-8xl font-black font-sans uppercase flex items-center"
          >
            <span className="text-white drop-shadow-[0_0_15px_rgba(186,230,253,0.5)]">
              Ambu
            </span>
            <span className="text-[#00E5FF] drop-shadow-[0_0_25px_rgba(0,229,255,0.8)] ml-1">
              Flow
            </span>
          </motion.h1>

          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "100%", opacity: 1 }}
            transition={{ duration: 1.5, delay: 1, ease: "easeInOut" }}
            className="h-px bg-gradient-to-r from-transparent via-[#00E5FF]/50 to-transparent mt-2"
          />

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ 
              duration: 1.2, 
              delay: 1.8,
              ease: "easeOut" 
            }}
            className="mt-6 text-[10px] md:text-xs font-black text-white/60 uppercase tracking-[0.4em] font-sans"
          >
            Pilotez votre journée
          </motion.p>
        </motion.div>
      </div>

      {/* Subtle scanline effect for technical feel */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      
      {/* Cyan glow at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-cyan-500/10 to-transparent pointer-events-none" />

      {/* Subtle blue reflection overlay on top for more depth */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-cyan-500/5 to-transparent pointer-events-none" />
    </motion.div>
  );
};

export default SplashScreen;
