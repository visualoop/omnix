/**
 * md-to-pdf.mjs — markdown → PDF via pdfkit (pure JS, no headless browser).
 *
 * Usage:  node md-to-pdf.mjs input.md output.pdf
 */
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { marked } from 'marked'

const require = createRequire(import.meta.url)
const PDFDocument = require('pdfkit')

const [, , inFile, outFile, titleArg] = process.argv
if (!inFile || !outFile) {
  console.error('usage: node md-to-pdf.mjs <input.md> <output.pdf> [header-title]')
  process.exit(1)
}
const md = fs.readFileSync(inFile, 'utf-8')
const headerTitle = (titleArg || 'OMNIX · CONFIDENTIAL').toUpperCase()

// Editorial palette
const COLOR = {
  fg: '#1a1a1a',
  muted: '#555555',
  subtle: '#888888',
  accent: '#c67435',
  bg_soft: '#f5f0e8',
  border: '#d4d4d4',
  tableHead: '#fbf8f2',
}

// pdfkit uses its bundled Helvetica by default — no font install needed.
const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 55, bottom: 55, left: 50, right: 50 },
  info: {
    Title: 'CEO Playbook — Omnix',
    Author: 'Justine',
    Subject: 'Operating manual',
  },
  bufferPages: true,
})
doc.pipe(fs.createWriteStream(outFile))

// Header + footer drawn AFTER content generation (via bufferedPageRange).
function drawChromeAll() {
  const range = doc.bufferedPageRange()
  const w = doc.page.width
  const h = doc.page.height
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i)
    // Header
    doc.fillColor(COLOR.subtle).font('Helvetica').fontSize(7.5)
      .text(headerTitle, 50, 22, { width: w - 100, align: 'right', characterSpacing: 1.5 })
    // Footer
    doc.fillColor(COLOR.subtle).font('Helvetica').fontSize(8)
      .text(`Omnix · ${i + 1} / ${range.count}`, 50, h - 30, { width: w - 100, align: 'center' })
  }
}

const tokens = marked.lexer(md)
const PAGE_W = doc.page.width - doc.page.margins.left - doc.page.margins.right

function ensureSpace(needed = 60) {
  const remaining = doc.page.height - doc.page.margins.bottom - doc.y
  if (remaining < needed) doc.addPage()
}

function heading(text, level) {
  ensureSpace(level === 1 ? 80 : 50)
  if (level === 1 && doc.y > doc.page.margins.top + 40) {
    doc.addPage()
  }
  const cfg = {
    1: { size: 22, spaceBefore: 8, spaceAfter: 10, color: COLOR.fg },
    2: { size: 16, spaceBefore: 14, spaceAfter: 6, color: COLOR.fg },
    3: { size: 13, spaceBefore: 10, spaceAfter: 4, color: COLOR.fg },
    4: { size: 11, spaceBefore: 8, spaceAfter: 3, color: COLOR.muted },
  }[level] || { size: 11, spaceBefore: 6, spaceAfter: 3, color: COLOR.muted }
  doc.moveDown(cfg.spaceBefore / 12)
  doc.font('Helvetica-Bold').fontSize(cfg.size).fillColor(cfg.color)
    .text(text, { paragraphGap: 0 })
  doc.moveDown(cfg.spaceAfter / 12)
  if (level === 1) {
    // hairline rule under H1
    const y = doc.y
    doc.save().strokeColor(COLOR.border).lineWidth(0.5)
      .moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + PAGE_W, y).stroke().restore()
    doc.moveDown(0.4)
  }
}

// Renders inline markdown (bold/italic/code) as a text run in pdfkit.
function renderInline(text) {
  const parts = []
  let last = 0
  // Order matters: **bold** first, then *italic*, then `code`, then [link](url)
  const re = /(\*\*[^*]+\*\*|(?<!\*)\*[^*]+\*(?!\*)|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), font: 'Helvetica', color: COLOR.fg })
    const tok = m[0]
    if (tok.startsWith('**')) parts.push({ text: tok.slice(2, -2), font: 'Helvetica-Bold', color: COLOR.fg })
    else if (tok.startsWith('*')) parts.push({ text: tok.slice(1, -1), font: 'Helvetica-Oblique', color: COLOR.muted })
    else if (tok.startsWith('`')) parts.push({ text: tok.slice(1, -1), font: 'Courier', color: '#333', bg: COLOR.bg_soft })
    else if (tok.startsWith('[')) {
      const linkM = tok.match(/\[([^\]]+)\]\(([^)]+)\)/)
      if (linkM) parts.push({ text: linkM[1], font: 'Helvetica', color: COLOR.accent, link: linkM[2] })
      else parts.push({ text: tok, font: 'Helvetica', color: COLOR.fg })
    }
    last = m.index + tok.length
  }
  if (last < text.length) parts.push({ text: text.slice(last), font: 'Helvetica', color: COLOR.fg })
  return parts
}

function paragraph(text) {
  ensureSpace(40)
  const parts = renderInline(text)
  doc.fontSize(10.5)
  // pdfkit chained text: use continued: true for inline runs.
  parts.forEach((p, i) => {
    doc.font(p.font || 'Helvetica').fillColor(p.color || COLOR.fg)
    const opts = { continued: i < parts.length - 1, lineGap: 3 }
    if (p.link) opts.link = p.link
    doc.text(p.text, opts)
  })
  doc.moveDown(0.5)
}

function bulletList(items, ordered) {
  ensureSpace(50)
  doc.fontSize(10.5).fillColor(COLOR.fg)
  items.forEach((it, idx) => {
    const marker = ordered ? `${idx + 1}. ` : '• '
    const parts = renderInline(it.text || '')
    doc.font('Helvetica').fillColor(COLOR.muted).text(marker, { continued: true, indent: 8 })
    parts.forEach((p, i) => {
      doc.font(p.font || 'Helvetica').fillColor(p.color || COLOR.fg)
      const opts = { continued: i < parts.length - 1, indent: 0, lineGap: 2 }
      if (p.link) opts.link = p.link
      doc.text(p.text, opts)
    })
  })
  doc.moveDown(0.5)
}

function blockquote(text) {
  ensureSpace(50)
  const y0 = doc.y
  doc.save()
  // Left accent bar
  doc.rect(doc.page.margins.left, y0 + 2, 3, 20).fill(COLOR.accent).restore()
  doc.font('Helvetica-Oblique').fontSize(11).fillColor(COLOR.muted)
    .text(text.replace(/\n/g, ' '), doc.page.margins.left + 14, y0, { width: PAGE_W - 14, lineGap: 3 })
  doc.moveDown(0.6)
}

function codeBlock(text) {
  ensureSpace(80)
  const y0 = doc.y
  const height = doc.heightOfString(text, { width: PAGE_W - 16, font: 'Courier', fontSize: 9 }) + 16
  doc.save()
    .rect(doc.page.margins.left, y0, PAGE_W, height)
    .fillColor(COLOR.bg_soft).fill()
    .restore()
  doc.font('Courier').fontSize(9).fillColor('#333')
    .text(text, doc.page.margins.left + 10, y0 + 8, { width: PAGE_W - 20 })
  doc.moveDown(0.6)
}

function hr() {
  const y = doc.y + 4
  doc.save().strokeColor(COLOR.border).lineWidth(0.5)
    .moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + PAGE_W, y).stroke().restore()
  doc.moveDown(1)
}

function table(header, rows) {
  ensureSpace(80)
  const cols = header.length
  const colW = PAGE_W / cols
  const rowH = 22
  const y0 = doc.y

  // Header
  doc.save()
    .rect(doc.page.margins.left, y0, PAGE_W, rowH)
    .fillColor(COLOR.tableHead).fill().restore()
  header.forEach((h, i) => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR.fg)
      .text(h.text, doc.page.margins.left + i * colW + 6, y0 + 6, { width: colW - 12, lineGap: 1 })
  })
  let y = y0 + rowH

  // Rows
  rows.forEach((row) => {
    const cellHeights = row.map((c) => doc.heightOfString(c.text, { width: colW - 12, font: 'Helvetica', fontSize: 9 }))
    const h = Math.max(rowH, ...cellHeights.map((v) => v + 10))
    // Page break if needed
    if (y + h > doc.page.height - doc.page.margins.bottom - 30) {
      doc.addPage()
      y = doc.page.margins.top
    }
    row.forEach((cell, i) => {
      doc.font('Helvetica').fontSize(9).fillColor(COLOR.fg)
        .text(cell.text, doc.page.margins.left + i * colW + 6, y + 4, { width: colW - 12, lineGap: 1 })
    })
    // Hairline rule
    doc.save().strokeColor('#eeeeee').lineWidth(0.4)
      .moveTo(doc.page.margins.left, y + h).lineTo(doc.page.margins.left + PAGE_W, y + h).stroke().restore()
    y += h
  })
  // Bottom rule
  doc.save().strokeColor(COLOR.fg).lineWidth(0.8)
    .moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + PAGE_W, y).stroke().restore()
  doc.y = y + 10
}

// Walk tokens
for (const t of tokens) {
  switch (t.type) {
    case 'heading': heading(t.text, t.depth); break
    case 'paragraph': paragraph(t.text); break
    case 'blockquote': blockquote(t.text); break
    case 'list':
      bulletList(t.items, t.ordered)
      break
    case 'code': codeBlock(t.text); break
    case 'hr': hr(); break
    case 'table': table(t.header, t.rows); break
    case 'space':
    default:
      break
  }
}

drawChromeAll()
doc.end()
console.log(`Wrote ${outFile}`)
