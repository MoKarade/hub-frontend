'use client'

/**
 * Hook useVoice — Web Speech API : Speech-to-Text (STT) + Text-to-Speech (TTS).
 *
 * STT (input vocal) : Chrome / Edge / Safari mobile. Pas Firefox stable.
 * TTS (lecture vocale) : tous navigateurs modernes.
 *
 * Permissions : le browser demande le micro au 1er start.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// Web Speech API types (pas dans lib.dom.d.ts par defaut sur tous navigateurs)
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

interface SpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null
  onend: ((this: SpeechRecognition, ev: Event) => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export type VoiceStatus = 'idle' | 'listening' | 'speaking' | 'error' | 'unsupported'

export interface UseVoiceOptions {
  /** Langue STT (default fr-CA). */
  lang?: string
  /** Voix TTS (selon ce que le browser propose). */
  voiceName?: string
  /** Callback appele quand une transcription finale est dispo. */
  onTranscript?: (text: string) => void
}

export interface UseVoiceReturn {
  status: VoiceStatus
  interimTranscript: string
  isSttSupported: boolean
  isTtsSupported: boolean
  startListening: () => void
  stopListening: () => void
  speak: (text: string) => void
  cancelSpeak: () => void
}

export function useVoice(opts: UseVoiceOptions = {}): UseVoiceReturn {
  const lang = opts.lang ?? 'fr-CA'
  const onTranscriptRef = useRef(opts.onTranscript)
  onTranscriptRef.current = opts.onTranscript

  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [interimTranscript, setInterimTranscript] = useState('')

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const isSttSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition ?? window.webkitSpeechRecognition)
  const isTtsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  // Setup recognition (re-instancie a chaque start pour eviter les states bizarres)
  const startListening = useCallback(() => {
    if (!isSttSupported) {
      setStatus('unsupported')
      return
    }
    const SR =
      (window.SpeechRecognition ?? window.webkitSpeechRecognition) as
        | SpeechRecognitionConstructor
        | undefined
    if (!SR) return

    // Stop any existing
    try {
      recognitionRef.current?.stop()
    } catch {
      /* ignore */
    }

    const rec = new SR()
    rec.lang = lang
    rec.continuous = false
    rec.interimResults = true

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        const transcript = result[0].transcript
        if (result.isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }
      if (interim) setInterimTranscript(interim)
      if (final) {
        setInterimTranscript('')
        onTranscriptRef.current?.(final.trim())
      }
    }
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      // 'no-speech' / 'aborted' sont OK, on les ignore silencieusement
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setStatus('error')
      }
    }
    rec.onend = () => {
      setStatus((prev) => (prev === 'listening' ? 'idle' : prev))
      setInterimTranscript('')
    }

    try {
      rec.start()
      setStatus('listening')
      recognitionRef.current = rec
    } catch {
      setStatus('error')
    }
  }, [isSttSupported, lang])

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop()
    } catch {
      /* ignore */
    }
    setStatus('idle')
    setInterimTranscript('')
  }, [])

  const speak = useCallback(
    (text: string) => {
      if (!isTtsSupported || !text.trim()) return
      const synth = window.speechSynthesis
      synth.cancel() // stop tout speak en cours

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang
      utterance.rate = 1.0
      utterance.pitch = 1.0

      // Choisit une voix FR-CA si dispo, sinon FR-FR, sinon default
      const voices = synth.getVoices()
      const preferred =
        voices.find((v) => v.lang === lang) ??
        voices.find((v) => v.lang === 'fr-FR') ??
        voices.find((v) => v.lang.startsWith('fr')) ??
        null
      if (preferred) utterance.voice = preferred
      if (opts.voiceName) {
        const named = voices.find((v) => v.name === opts.voiceName)
        if (named) utterance.voice = named
      }

      utterance.onstart = () => setStatus('speaking')
      utterance.onend = () => setStatus('idle')
      utterance.onerror = () => setStatus('idle')
      synth.speak(utterance)
    },
    [isTtsSupported, lang, opts.voiceName],
  )

  const cancelSpeak = useCallback(() => {
    if (isTtsSupported) {
      window.speechSynthesis.cancel()
    }
    setStatus('idle')
  }, [isTtsSupported])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort()
      } catch {
        /* ignore */
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  return {
    status,
    interimTranscript,
    isSttSupported,
    isTtsSupported,
    startListening,
    stopListening,
    speak,
    cancelSpeak,
  }
}
