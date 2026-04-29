/**
 * Shared Framer Motion variants — Sprint A UI redesign.
 * Importer depuis n'importe quel composant client.
 *
 * Convention d'usage :
 *   <motion.div variants={fadeIn} initial="initial" animate="animate">
 *   <motion.div variants={stagger} initial="initial" animate="animate">
 *     <motion.div variants={staggerItem}>…</motion.div>
 *   </motion.div>
 */

import type { Variants } from 'framer-motion'

/** Ease courbe custom — ressemble à spring mais plus rapide */
const EASE = [0.16, 1, 0.3, 1] as const

/** Fade + monte légèrement. Utilisé pour les cards, modals, sections. */
export const fadeIn: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: EASE },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
}

/** Container qui stagger ses enfants (utiliser avec staggerItem). */
export const stagger: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
}

/** Élément enfant du container stagger. */
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 18 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE },
  },
}

/** Transition de page — appliquée par app/template.tsx. */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: EASE },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
}

/** Scale in — pour les modals/overlays. */
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: EASE },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
}

/** Glisse depuis la droite — pour les sidebars, drawers. */
export const slideInRight: Variants = {
  initial: { opacity: 0, x: 24 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: EASE },
  },
  exit: {
    opacity: 0,
    x: 24,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
}

/** Props whileHover pour les cards — lift + légère ombre verte. */
export const hoverLift = {
  y: -2,
  transition: { duration: 0.15, ease: 'easeOut' },
} as const

/** Props whileHover pour les boutons. */
export const hoverScale = {
  scale: 1.03,
  transition: { duration: 0.12, ease: 'easeOut' },
} as const
