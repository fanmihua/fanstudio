"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"

interface BlurTextProps {
  text: string
  className?: string
  delay?: number
  once?: boolean
}

export function BlurText({
  text,
  className = "",
  delay = 0,
  once = true,
}: BlurTextProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once })

  const words = text.split(" ")

  return (
    <span ref={ref} className={`inline-flex flex-wrap ${className}`}>
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          className="inline-block mr-[0.25em]"
          initial={{ opacity: 0, filter: "blur(10px)" }}
          animate={
            isInView
              ? { opacity: 1, filter: "blur(0px)" }
              : { opacity: 0, filter: "blur(10px)" }
          }
          transition={{
            duration: 0.5,
            delay: delay + index * 0.1,
            ease: "easeOut",
          }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  )
}
