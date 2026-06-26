'use client'

/**
 * First-login dashboard tour.
 *
 * Walks a new customer from "you have a licence" → "download + activate"
 * → "set up M-Pesa" → "try a sale". Uses driver.js (MIT, ~5kB) which we
 * skin lightly to match the editorial chrome.
 *
 * Shows once per browser (localStorage flag). The "Set up M-Pesa" and
 * download steps point at the SetupCtaBanner + downloads link that are
 * already on the page, so the tour highlights real elements.
 */
import { useEffect } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

const SEEN_KEY = 'omnix_dashboard_tour_v1'

export function WelcomeTour() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(SEEN_KEY)) return
    // Defer so the dashboard has painted its cards first.
    const t = setTimeout(() => {
      const d = driver({
        showProgress: true,
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Got it',
        popoverClass: 'omnix-tour',
        steps: [
          {
            popover: {
              title: 'Welcome to Omnix 👋',
              description:
                "You're set up. Here's the 30-second tour of what to do next — download the app, activate, and take your first M-Pesa payment.",
            },
          },
          {
            element: '[data-tour="downloads"]',
            popover: {
              title: 'Download the app',
              description: 'Grab the Windows installer for the trade you picked. It runs offline once installed.',
            },
          },
          {
            element: '[data-tour="setup-mpesa"]',
            popover: {
              title: 'Set up M-Pesa',
              description: 'Connect Lipa na M-Pesa — Paybill, Till, or STK push. This guide shows exactly where to get the keys.',
            },
          },
          {
            element: '[data-tour="licenses"]',
            popover: {
              title: 'Your licences',
              description: 'Your activation keys live here. Each key binds to one machine. Buy more or switch trades any time.',
            },
          },
          {
            popover: {
              title: "That's it",
              description: 'Open the app, ring a sale, and watch it land. Stuck? Tap the WhatsApp button on the website — we reply fast.',
            },
          },
        ],
        onDestroyed: () => localStorage.setItem(SEEN_KEY, '1'),
      })
      d.drive()
    }, 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <style>{`
      .omnix-tour.driver-popover {
        border-radius: 14px;
        font-family: var(--font-ui, system-ui), sans-serif;
      }
      .omnix-tour .driver-popover-title { font-weight: 600; }
      .omnix-tour .driver-popover-progress-text { opacity: 0.6; font-size: 11px; }
      .omnix-tour .driver-popover-next-btn,
      .omnix-tour .driver-popover-done-btn {
        background: var(--color-accent, #2563eb);
        color: #fff;
        text-shadow: none;
        border: none;
        border-radius: 8px;
      }
    `}</style>
  )
}
