'use client';

import { motion } from 'framer-motion';

export default function PulsatingLoader() {
  return (
    <div className="flex items-center justify-center min-h-[100px]">
      <div className="flex space-x-3">
        {[0, 0.2, 0.4].map((delay, index) => (
          <motion.div
            key={index}
            className="h-4 w-4 rounded-full bg-[rgb(var(--pulse-color))]"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.2,
              ease: 'easeInOut',
              repeat: Infinity,
              delay: delay,
            }}
          />
        ))}
      </div>
    </div>
  );
}