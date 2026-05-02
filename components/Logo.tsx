import React from 'react';
import { motion } from 'motion/react';
import { Ambulance } from 'lucide-react';

interface LogoProps {
  size?: number;
  className?: string;
  darkMode?: boolean;
}

const Logo: React.FC<LogoProps> = ({ size = 64, className = "" }) => {
  const borderRadius = size * 0.34;
  const ambulanceSize = size * 0.55;
  const roadHeight = size * 0.15;
  const dashWidth = size * 0.1;
  const dashHeight = Math.max(1, size * 0.02);
  const gapSize = size * 0.08;
  const ambulanceYOffset = -size * 0.05;

  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {/* Bento Box Logo */}
      <div 
        className="relative w-full h-full bg-indigo-600 flex flex-col items-center justify-center shadow-xl shadow-indigo-100 transform -rotate-3 overflow-hidden group border border-white/20"
        style={{ borderRadius }}
      >
        {/* Road Visuals (Dynamic Dashed Line) */}
        <div 
          className="absolute bottom-0 w-full bg-indigo-700/40 flex items-center overflow-hidden"
          style={{ height: roadHeight }}
        >
          <motion.div 
            className="flex whitespace-nowrap"
            style={{ gap: gapSize, paddingLeft: gapSize, paddingRight: gapSize }}
            animate={{ x: [-(dashWidth + gapSize), 0] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          >
            {[...Array(8)].map((_, i) => (
              <div 
                key={i} 
                className="bg-white/10 rounded-full shrink-0" 
                style={{ width: dashWidth, height: dashHeight }}
              />
            ))}
          </motion.div>
        </div>

        {/* Ambulance Icon */}
        <div 
          className="relative z-10"
          style={{ marginTop: ambulanceYOffset }}
        >
          <motion.div
            animate={{ 
              y: [0, -size*0.015, 0, -size*0.02, 0],
              rotate: [0, -1, 1, -1, 0]
            }}
            transition={{ 
              duration: 0.4, 
              repeat: Infinity, 
              ease: "linear" 
            }}
          >
            <Ambulance className="text-white" size={ambulanceSize} />
          </motion.div>
          {/* Light blinking effect */}
          <motion.div 
            className="absolute bg-red-400 rounded-full blur-[1px]"
            style={{ 
              top: '12%', 
              right: '18%', 
              width: Math.max(1, size * 0.03), 
              height: Math.max(1, size * 0.03) 
            }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 0.1 }}
          />
        </div>
      </div>
    </div>
  );
};

export default Logo;
