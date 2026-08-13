"use client"

import { motion } from "framer-motion"

/** 5 个光球定义，颜色从 CSS 变量读取。 */
const orbConfigs = [
  { index: 1, size: 350, blur: 100, x: ["0%", "15%", "-10%", "0%"], y: ["0%", "-20%", "10%", "0%"], scale: [1, 1.2, 0.9, 1], duration: 20, initialX: "10%", initialY: "20%" },
  { index: 2, size: 280, blur: 90, x: ["0%", "-20%", "10%", "0%"], y: ["0%", "15%", "-15%", "0%"], scale: [1, 0.85, 1.15, 1], duration: 25, initialX: "30%", initialY: "10%" },
  { index: 3, size: 240, blur: 80, x: ["0%", "20%", "-15%", "0%"], y: ["0%", "10%", "-20%", "0%"], scale: [1, 1.1, 0.95, 1], duration: 18, initialX: "55%", initialY: "30%" },
  { index: 5, size: 320, blur: 110, x: ["0%", "-15%", "20%", "0%"], y: ["0%", "-10%", "15%", "0%"], scale: [1, 0.9, 1.2, 1], duration: 22, initialX: "70%", initialY: "15%" },
  { index: 7, size: 260, blur: 95, x: ["0%", "10%", "-20%", "0%"], y: ["0%", "20%", "-10%", "0%"], scale: [1, 1.15, 0.85, 1], duration: 28, initialX: "85%", initialY: "25%" },
]

export function AuroraBackground({ className = "" }: { className?: string }) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
    >
      {orbConfigs.map((orb) => (
        <motion.div
          key={orb.index}
          className="absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, var(--color-pride-${orb.index}) 0%, transparent 70%)`,
            filter: `blur(${orb.blur}px)`,
            left: orb.initialX,
            top: orb.initialY,
            transform: "translate(-50%, -50%)",
          }}
          animate={{
            x: orb.x,
            y: orb.y,
            scale: orb.scale,
          }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  )
}
