/**
 * 学生端 Markdown 渲染 composable。
 *
 * ## 为什么不用 marked / markdown-it ？
 *
 * uniapp App-Plus 用的是定制版 V8，不支持 ES2018 的 Unicode property escapes（`\p{L}` `\p{N}` 等）。
 * `marked@18+` / `markdown-it` 内部都用到这些 regex，App-Plus 启动时直接抛
 * `SyntaxError: Invalid regular expression`，整个 app-service 白屏。
 *
 * 所以这里自写一个**极简 markdown 解析器**：只覆盖 AI 聊天回复的高频场景，全部用
 * ES5 兼容 regex，跑在任何 webview 都不会炸：
 *
 * - 行内：`**bold**` / `__bold__` / `*italic*` / `_italic_` / `` `code` `` / `[text](url)`
 * - 块级：`# H1` ~ `###### H6` / `> blockquote` / `- list` / `1. list` / fenced code block
 * - 段落：连续行合并、空行分段
 * - 自动转义 `<` `>` `&` `"` `'`，安全渲染到 `<rich-text>`
 *
 * 不支持：表格、删除线、HTML 嵌入、脚注、任务列表（学生端 AI 聊天不需要这些复杂语法）。
 *
 * ## 用法
 * ```vue
 * <rich-text :nodes="renderMarkdown(message.content)" />
 * ```
 *
 * ## 安全
 * - 渲染前移除 `<think>...</think>` 思考块（双保险，服务端已剥一次）
 * - HTML 实体转义后再拼标签，不存在注入风险
 */

/** 移除可能漏进来的思考标签（双保险，服务端 `stripThinkingTags` 已剥一次） */
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

/** 转义到安全的 HTML 实体 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * 行内解析：在已转义的文本上施加 markdown 行内格式。
 * 顺序敏感：先 code（独占）、再 link（带闭合括号）、再 bold（双标记）、再 italic（单标记）。
 *
 * 注意：调用前文本已经过 escapeHtml，所以这里看到的是 `&amp;` `&lt;` `&quot;` 这类实体。
 * 必须避开它们，否则会误判为 markdown 字符。
 */
function renderInline(safe: string): string {
  let s = safe
  // 1) 行内代码 `code` —— 优先处理，避免里面的 * _ 被当作 italic
  s = s.replace(/`([^`\n]+?)`/g, (_, body) => `<code>${body}</code>`)
  // 2) 图片 ![alt](url) —— uniapp rich-text 不渲染 img 自动，弱兜底成 [图片] 文字
  s = s.replace(/!\[([^\]]*?)\]\(([^)\s]+?)\)/g, (_, alt) => `[图片${alt ? '：' + alt : ''}]`)
  // 3) 链接 [text](url) —— 仅渲染 text，url 安全过滤
  s = s.replace(/\[([^\]]+?)\]\(([^)\s]+?)\)/g, (_, txt, url) => {
    const safeUrl = /^(?:https?|mailto):/i.test(url) ? url : '#'
    return `<a href="${safeUrl}">${txt}</a>`
  })
  // 4) 粗体 **xxx** / __xxx__
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/__([^_\n]+?)__/g, '<strong>$1</strong>')
  // 5) 斜体 *xxx* / _xxx_（单字符标记，要小心 a_b_c 这种）
  s = s.replace(/(^|[^*\w])\*([^*\n]+?)\*(?=[^*\w]|$)/g, '$1<em>$2</em>')
  s = s.replace(/(^|[^_\w])_([^_\n]+?)_(?=[^_\w]|$)/g, '$1<em>$2</em>')
  // 6) 删除线 ~~xxx~~
  s = s.replace(/~~([^~\n]+?)~~/g, '<del>$1</del>')
  return s
}

interface BlockLine {
  type: 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'ul' | 'ol' | 'quote' | 'code' | 'hr' | 'empty'
  raw: string
  level?: number
  lang?: string
}

/** 块级解析：把整段 markdown 切成有序块列表 */
function parseBlocks(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''

    // ---------- 1) 围栏代码块 ``` lang ----------
    const fence = line.match(/^```\s*([\w-]*)\s*$/)
    if (fence) {
      const lang = fence[1] || ''
      const codeLines: string[] = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i] ?? '')) {
        codeLines.push(lines[i] ?? '')
        i++
      }
      i++ // 跳过闭合 ```
      const code = escapeHtml(codeLines.join('\n'))
      const langAttr = lang ? ` data-lang="${escapeHtml(lang)}"` : ''
      out.push(`<pre${langAttr}><code>${code}</code></pre>`)
      continue
    }

    // ---------- 2) 标题 # ~ ###### ----------
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (heading) {
      const level = heading[1].length
      const text = renderInline(escapeHtml(heading[2]))
      out.push(`<h${level}>${text}</h${level}>`)
      i++
      continue
    }

    // ---------- 3) 水平线 --- *** ___ ----------
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push('<hr/>')
      i++
      continue
    }

    // ---------- 4) 引用 > ----------
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

    // ---------- 5) 无序列表 - / * / + ----------
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

    // ---------- 6) 有序列表 1. 2. 3. ----------
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

    // ---------- 7) 空行 ----------
    if (!line.trim()) {
      i++
      continue
    }

    // ---------- 8) 段落（合并连续非空行 + 非块级行） ----------
    const paraLines: string[] = [line]
    i++
    while (i < lines.length) {
      const next = lines[i] ?? ''
      if (!next.trim()) break
      // 遇到任何块级前缀就停
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

/** Strip markdown for TTS playback — 用于朗读文本的拷贝 */
export function stripMarkdown(md: string): string {
  return (md || '')
    .replace(/```[\s\S]*?```/g, '（一段代码）')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^>\s?/gm, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function useMarkdown() {
  return { renderMarkdown, stripMarkdown }
}
