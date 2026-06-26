'use client'

/**
 * Floating WhatsApp widget.
 *
 * Bottom-right FAB (WhatsApp green). Click opens a small in-page chat
 * panel styled like a WhatsApp thread — avatar, name, a greeting bubble,
 * a text input + send. On send, deep-links to wa.me/<number> with the
 * typed message URL-encoded so it lands prefilled in the visitor's
 * WhatsApp, addressed to us.
 *
 * No backend, no tracking. Respects reduced-motion. Hidden on print.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

const WHATSAPP_NUMBER = '254740455200'
const BUSINESS_NAME = 'Omnix'
const GREETING = "Hi! 👋 Ask us anything about Omnix — pricing, M-Pesa setup, eTIMS, or a demo. We usually reply within minutes."

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden>
      <path d="M16 3C9.4 3 4 8.4 4 15c0 2.1.6 4.1 1.6 5.9L4 29l8.3-1.6c1.7.9 3.7 1.4 5.7 1.4 6.6 0 12-5.4 12-12S22.6 3 16 3zm0 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-4.9 1 1-4.8-.2-.4C5.5 18.3 5 16.7 5 15c0-6.1 5-11 11-11s11 4.9 11 11-4.9 10.8-11 10.8zm6-8.1c-.3-.2-1.9-1-2.2-1.1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.3-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.3.3-.5.1-.2.1-.4 0-.6 0-.2-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.1 4.6.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.9-.8 2.1-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.2-.6-.4z"/>
    </svg>
  )
}

export function WhatsAppWidget() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')

  const send = () => {
    const text = message.trim() || 'Hi Omnix, I have a question.'
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
    window.open(url, '_blank', 'noopener,noreferrer')
    setMessage('')
    setOpen(false)
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 print:hidden">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="mb-3 w-[330px] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl"
          >
            {/* WhatsApp-style header */}
            <div className="flex items-center gap-3 bg-[#075E54] px-4 py-3 text-white">
              <div className="grid size-10 place-items-center rounded-full bg-white/15">
                <WhatsAppGlyph className="size-6" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">{BUSINESS_NAME}</div>
                <div className="text-[11px] text-white/80">Typically replies in minutes</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="ml-auto text-white/80 hover:text-white"
                aria-label="Close chat"
              >✕</button>
            </div>

            {/* Thread */}
            <div className="space-y-2 bg-[#ECE5DD] px-3 py-4" style={{ minHeight: 120 }}>
              <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-[13px] text-stone-800 shadow-sm">
                {GREETING}
              </div>
            </div>

            {/* Composer */}
            <div className="flex items-center gap-2 border-t border-black/5 bg-white p-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Type a message…"
                className="flex-1 rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-[13px] text-stone-800 outline-none focus:border-[#25D366]"
                autoFocus
              />
              <button
                onClick={send}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-[#25D366] text-white transition hover:bg-[#1FB855]"
                aria-label="Send via WhatsApp"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-xl transition hover:scale-105 hover:bg-[#1FB855] active:scale-95"
        aria-label="Chat with us on WhatsApp"
      >
        <WhatsAppGlyph className="size-8" />
      </button>
    </div>
  )
}
