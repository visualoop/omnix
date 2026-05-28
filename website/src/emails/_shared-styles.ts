/**
 * Shared email styles — keeps the warm-luxe palette consistent across templates.
 * React Email renders to HTML so we use inline styles, not CSS variables.
 */

export const containerStyle = {
  background: '#15110D',
  border: '1px solid #2C2620',
  borderRadius: 14,
  margin: '0 auto',
  maxWidth: 560,
  padding: '40px 32px',
}

export const brand = { paddingBottom: 8 }

export const h1 = {
  color: '#F2EDE3',
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 32,
  fontWeight: 400,
  lineHeight: 1.1,
  margin: 0,
  letterSpacing: '-0.01em',
}

export const dot = {
  display: 'inline-block',
  width: 8,
  height: 8,
  background: '#C77B3F',
  borderRadius: '999px',
  marginLeft: 6,
  verticalAlign: 'middle' as const,
}

export const p = {
  color: '#B8AC95',
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  fontSize: 15,
  lineHeight: 1.6,
  margin: '12px 0',
}

export const code = {
  background: '#1F1A14',
  border: '1px solid #2C2620',
  borderRadius: 6,
  color: '#F2EDE3',
  display: 'inline-block',
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: 14,
  padding: '8px 14px',
}

export const hr = {
  borderColor: '#2C2620',
  margin: '32px 0',
}

export const footer = {
  color: '#7A6F5C',
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  fontSize: 12,
  lineHeight: 1.55,
}

export const accent = {
  color: '#C77B3F',
}
