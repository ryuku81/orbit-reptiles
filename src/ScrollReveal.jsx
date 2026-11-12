import { motion } from 'motion/react';

export default function ScrollReveal({ children, className = '', paused = false, delay = 0, as = 'div' }) {
  const Component = as === 'section' ? motion.section : motion.div;
  return <Component className={className}
    initial={paused ? false : { opacity: 0, y: 42, filter: 'blur(6px)' }}
    whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
    animate={paused ? { opacity: 1, y: 0, filter: 'blur(0px)' } : undefined}
    viewport={{ once: true, amount: 0.15 }}
    transition={{ duration: paused ? 0 : 0.85, delay: paused ? 0 : delay, ease: [0.16, 1, 0.3, 1] }}>
    {children}
  </Component>;
}
