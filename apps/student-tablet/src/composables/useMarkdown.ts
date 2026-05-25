import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({
  gfm: true,
  breaks: true,
})

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if ('target' in node && node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

export function renderMarkdown(input: string | undefined | null): string {
  if (!input) return ''
  try {
    const html = marked.parse(input, { async: false }) as string
    return DOMPurify.sanitize(html)
  } catch (err) {
    console.warn('[markdown] parse failed', err)
    return escapeHtml(input)
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function useMarkdown() {
  return { renderMarkdown }
}
