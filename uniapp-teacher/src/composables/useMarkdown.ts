/**
 * 教师端 Markdown 渲染 composable。
 *
 * 与 uniapp-student/src/composables/useMarkdown.ts 同源：
 *   - 不依赖 `marked`（避免 App-Plus V8 不识别 `\p{L}` Unicode property escape 抛 SyntaxError）
 *   - 手写极简 markdown 解析器，纯 ES5 兼容 regex
 *   - 用 `<rich-text :nodes="...">` 在 H5 / App-Plus / mp-weixin 都能渲染
 *
 * 支持：标题 1-6 / 段落 / 无序列表 / 有序列表 / 引用 / 代码块 / 行内代码 / 粗体 / 斜体 / 删除线 / 链接 / 图片占位 / 水平线
 * 不支持：表格 / HTML 嵌入 / 脚注 / 任务列表
 */

function stripThinking(text: string): string {
  if (!text) return text
  let out = text
  out = out.replace(/<think>[\s\S]*?<\/think>/gi, '')
  out = out.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
  out = out.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
  out = out.replace(/<think>[\s\S]*$/i, '')
  out = out.replace(/<thinking>[\s\S]*$/i, '')
  out = out.replace(/<reasoning>[\s\S]*$/i, '')
  return out
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function renderInline(safe: string): string {
  let s = safe
  s = s.replace(/`([^`\n]+?)`/g, (_, body) => `<code>${body}</code>`)
  s = s.replace(/!\[([^\]]*?)\]\(([^)\s]+?)\)/g, (_, alt) => `[图片${alt ? '：' + alt : ''}]`)
  s = s.replace(/\[([^\]]+?)\]\(([^)\s]+?)\)/g, (_, txt, url) => {
    const safeUrl = /^(?:https?|mailto):/i.test(url) ? url : '#'
    return `<a href="${safeUrl}">${txt}</a>`
  })
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/__([^_\n]+?)__/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*\w])\*([^*\n]+?)\*(?=[^*\w]|$)/g, '$1<em>$2</em>')
  s = s.replace(/(^|[^_\w])_([^_\n]+?)_(?=[^_\w]|$)/g, '$1<em>$2</em>')
  s = s.replace(/~~([^~\n]+?)~~/g, '<del>$1</del>')
  return s
}

function parseBlocks(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''

    const fence = line.match(/^```\s*([\w-]*)\s*$/)
    if (fence) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i] ?? '')) {
        codeLines.push(lines[i] ?? '')
        i++
      }
      i++
      const code = escapeHtml(codeLines.join('\n'))
      out.push(`<pre><code>${code}</code></pre>`)
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (heading) {
      const level = heading[1].length
      const text = renderInline(escapeHtml(heading[2]))
      out.push(`<h${level}>${text}</h${level}>`)
      i++
      continue
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push('<hr/>')
      i++
      continue
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i] ?? '')) {
        quoteLines.push((lines[i] ?? '').replace(/^>\s?/, ''))
        i++
      }
      const inner = parseBlocks(quoteLines.join('\n'))
      out.push(`<blockquote>${inner}</blockquote>`)
      continue
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i] ?? '')) {
        const item = (lines[i] ?? '').replace(/^\s*[-*+]\s+/, '')
        items.push(`<li>${renderInline(escapeHtml(item))}</li>`)
        i++
      }
      out.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i] ?? '')) {
        const item = (lines[i] ?? '').replace(/^\s*\d+\.\s+/, '')
        items.push(`<li>${renderInline(escapeHtml(item))}</li>`)
        i++
      }
      out.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    if (!line.trim()) {
      i++
      continue
    }

    const paraLines: string[] = [line]
    i++
    while (i < lines.length) {
      const next = lines[i] ?? ''
      if (!next.trim()) break
      if (/^(#{1,6}\s+|>\s?|\s*[-*+]\s+|\s*\d+\.\s+|```|\s*(?:-{3,}|\*{3,}|_{3,})\s*$)/.test(next)) break
      paraLines.push(next)
      i++
    }
    const paraText = renderInline(escapeHtml(paraLines.join('\n').replace(/\n/g, ' ')))
    out.push(`<p>${paraText}</p>`)
  }

  return out.join('')
}

export function renderMarkdown(input: string | undefined | null): string {
  if (!input) return ''
  try {
    const cleaned = stripThinking(input)
    return parseBlocks(cleaned)
  } catch (err) {
    console.warn('[markdown] parse failed', err)
    return `<p>${escapeHtml(String(input))}</p>`
  }
}

export function useMarkdown() {
  return { renderMarkdown }
}
