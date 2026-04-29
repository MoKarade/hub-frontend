'use client'

/**
 * FocusModal — overlay plein écran pour le mode focus d'un Widget.
 * Fermeture : touche Escape ou clic sur le backdrop.
 * Animations : backdrop fade + contenu scale-in.
 */

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { scaleIn } from '@/lib/motion'

interface FocusModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
}

export function FocusModal({ isOpen, onClose, title, subtitle, children }: FocusModalProps) {
  // Fermeture sur Escape
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  // Empêche le scroll du body quand le modal est ouvert
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-ink-950/85 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            variants={scaleIn}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-4 md:inset-8 lg:inset-12 z-50 flex flex-col bg-ink-900 border border-ink-700 rounded-2xl overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-ink-800 shrink-0 bg-ink-900/80 backdrop-blur-sm">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-ink-100 truncate">{title}</h2>
                {subtitle && (
                  <p className="text-[11px] text-ink-400 font-mono mt-0.5 truncate">{subtitle}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="ml-4 shrink-0 p-1.5 rounded-md text-ink-400 hover:text-ink-100 hover:bg-ink-800 transition-colors"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
