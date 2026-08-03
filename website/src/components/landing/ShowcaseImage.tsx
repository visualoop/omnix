'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { type KeyboardEvent, useState } from 'react'

import styles from './homepage.module.css'

interface ShowcaseImageProps {
  alt: string
  height: number
  loading?: 'eager' | 'lazy'
  priority?: 'high' | 'low' | 'auto'
  src: string
  width: number
}

export function ShowcaseImage({
  alt,
  height,
  loading = 'lazy',
  priority = 'auto',
  src,
  width,
}: ShowcaseImageProps) {
  const [open, setOpen] = useState(false)
  const [inputMethod, setInputMethod] = useState<'keyboard' | 'pointer'>('pointer')
  const dialogName = `Full-size view: ${alt}`

  const openFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    setInputMethod('keyboard')
    setOpen(true)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={styles.mediaTrigger}
          aria-label={`Open full-size view: ${alt}`}
          onPointerDown={() => setInputMethod('pointer')}
          onKeyDown={openFromKeyboard}
        >
          {/* Approved records reach this component only through getSlotImage. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.showcaseImage}
            src={src}
            alt={alt}
            width={width}
            height={height}
            loading={loading}
            fetchPriority={priority}
          />
          <span className={styles.inspectLabel} aria-hidden="true">
            View full size
          </span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay
          className={styles.lightboxOverlay}
          data-lightbox-backdrop
          onClick={() => setOpen(false)}
        />
        <Dialog.Content
          className={styles.lightboxContent}
          data-input-method={inputMethod}
          aria-modal="true"
          aria-describedby={undefined}
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <div className={styles.lightboxToolbar}>
            <Dialog.Title className={styles.lightboxTitle}>{dialogName}</Dialog.Title>
            <Dialog.Close className={styles.lightboxClose}>
              <span aria-hidden="true">×</span>
              Close
            </Dialog.Close>
          </div>
          <figure className={styles.lightboxFigure}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} width={width} height={height} />
          </figure>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
