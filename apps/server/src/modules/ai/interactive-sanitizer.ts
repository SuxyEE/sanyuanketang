/**
 * AI 生成 HTML 交互场景的安全清洗器。
 *
 * 设计参考 OpenMAIC `lib/generation/interactive-post-processor.ts`。
 *
 * 目标：在把 AI 生成的 HTML 推送到学生 iframe 之前，去掉所有可能造成安全风险或断网的内容：
 *   1. 外网 `<script src="https://...">`、`<link>` 与 `<img src="https://...">` 强制改为 about:blank
 *   2. HTML inline 事件属性（`onload`、`onclick` 等）一律移除（不影响 addEventListener）
 *   3. `<iframe>` 标签全部移除（防止 iframe 套娃）
 *   4. 危险 API：`eval`、`new Function`、`document.write`、`window.open` 字符串告警注释
 *   5. `fetch / XMLHttpRequest` 字符串告警注释（学生端可能离线）
 *
 * 同时配合 iframe 自身 `sandbox="allow-scripts"` 属性（前端设置）实现 第二层 防御：
 *   - 没有 `allow-same-origin` 时，iframe 不能访问主页 cookie / localStorage
 *   - 没有 `allow-top-navigation` 时，无法跳出 iframe
 *
 * 局限性：本清洗器不能完全防御所有恶意 HTML（如 DOM-based XSS 通过 user input），
 * 但 AI 生成场景本来不会有用户输入，所以风险可控。
 */

const INLINE_EVENT_ATTRS = [
  'onload', 'onclick', 'ondblclick', 'onmouseover', 'onmouseout', 'onmouseenter', 'onmouseleave',
  'onkeydown', 'onkeyup', 'onkeypress', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'oninput',
  'ontouchstart', 'ontouchend', 'ontouchmove', 'onerror', 'onbeforeunload', 'onunload',
  'onscroll', 'onresize', 'oncontextmenu', 'ondrag', 'ondrop', 'onwheel',
]

export interface SanitizeStats {
  removedInlineEvents: number
  removedExternalScripts: number
  removedExternalLinks: number
  removedNestedIframes: number
  warnings: string[]
  /** AI 生成质量问题（不阻断推送，但提示教师 / 前端可以显示警告） */
  qualityIssues: string[]
  /** 自动修复的 CSS class selector 数量（漏点号） */
  autoFixedCssClasses: number
}

export function sanitizeInteractiveHtml(html: string): { html: string; stats: SanitizeStats } {
  if (!html || typeof html !== 'string') {
    return {
      html: '<!DOCTYPE html><html><body><p style="font-family:sans-serif;padding:20px">空 HTML</p></body></html>',
      stats: { removedInlineEvents: 0, removedExternalScripts: 0, removedExternalLinks: 0, removedNestedIframes: 0, warnings: ['empty input'], qualityIssues: ['empty input'], autoFixedCssClasses: 0 },
    }
  }

  const stats: SanitizeStats = {
    removedInlineEvents: 0,
    removedExternalScripts: 0,
    removedExternalLinks: 0,
    removedNestedIframes: 0,
    warnings: [],
    qualityIssues: [],
    autoFixedCssClasses: 0,
  }

  let out = html

  // 1) 移除外网 <script src="https?://..."> 整个标签（保留内联 <script>...</script>）
  out = out.replace(/<script\b[^>]*\bsrc\s*=\s*["']?(https?:|\/\/)[^>]*>\s*(<\/script>)?/gi, () => {
    stats.removedExternalScripts++
    return '<!-- removed external <script> -->'
  })

  // 2) 移除外网 <link rel="stylesheet" href="https?://..."> 类标签
  out = out.replace(/<link\b[^>]*\bhref\s*=\s*["']?(https?:|\/\/)[^>]*>/gi, () => {
    stats.removedExternalLinks++
    return '<!-- removed external <link> -->'
  })

  // 3) 把外网 <img src="https?://..."> 改为 inline data URL 占位（1x1 透明）
  out = out.replace(/<img\b([^>]*?)\bsrc\s*=\s*["']?(https?:|\/\/)[^"'>\s]*([^>]*)>/gi,
    (_full, pre: string, _proto: string, post: string) => {
      return `<img${pre || ''} src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="(external image removed)"${post || ''}>`
    },
  )

  // 4) 移除嵌套 <iframe> 标签
  out = out.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, () => {
    stats.removedNestedIframes++
    return '<!-- removed nested <iframe> -->'
  })
  out = out.replace(/<iframe\b[^>]*\/?>/gi, () => {
    stats.removedNestedIframes++
    return '<!-- removed self-closing <iframe> -->'
  })

  // 5) 移除所有 HTML inline 事件属性（onload="..." 之类）
  for (const attr of INLINE_EVENT_ATTRS) {
    const re = new RegExp(`\\s${attr}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]*)`, 'gi')
    out = out.replace(re, () => {
      stats.removedInlineEvents++
      return ''
    })
  }

  // 6) 检测危险 API（不强制移除，只在日志中提醒，因为 iframe sandbox 已经阻止大部分操作）
  const checkPatterns: Array<[string, RegExp]> = [
    ['eval(', /\beval\s*\(/g],
    ['new Function(', /new\s+Function\s*\(/g],
    ['document.write', /document\.write/g],
    ['window.open', /window\.open/g],
    ['fetch(', /\bfetch\s*\(/g],
    ['XMLHttpRequest', /\bXMLHttpRequest\b/g],
  ]
  for (const [label, re] of checkPatterns) {
    const matches = out.match(re)
    if (matches && matches.length > 0) {
      stats.warnings.push(`detected ${matches.length}× ${label}（iframe sandbox 已限制）`)
    }
  }

  // 7) 保证有 <!DOCTYPE> 与 <meta viewport>（学生平板）
  if (!/^<!DOCTYPE/i.test(out.trim())) {
    out = '<!DOCTYPE html>\n' + out
  }
  if (!/name=["']viewport["']/i.test(out)) {
    out = out.replace(
      /<head\b[^>]*>/i,
      m => `${m}\n<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=2">`,
    )
  }

  // 8) 质量检测：SVG / Canvas API 错配 —— AI 经常翻车的点
  //    案例：<svg id="canvas"> + script 里 canvas.getContext('2d') => runtime crash
  const svgIdMatch = out.match(/<svg\b[^>]*\bid\s*=\s*["']([^"']+)["']/i)
  const hasGetContext = /\bgetContext\s*\(/i.test(out)
  const hasCanvasTag = /<canvas\b/i.test(out)
  if (svgIdMatch && hasGetContext && !hasCanvasTag) {
    stats.qualityIssues.push(`HTML 里没有 <canvas> 标签，但脚本调用了 getContext()（id="${svgIdMatch[1]}" 是 SVG）—— 可视化大概率渲染不出来，建议教师重新生成`)
  }

  // 8.b) 互动元素但完全没 JS —— 按钮/滑块纯摆设，点了不会有反应
  const scriptBodyMatches = out.match(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi) || []
  const inlineJsBody = scriptBodyMatches
    .map(m => m.replace(/<script\b[^>]*>|<\/script>/gi, ''))
    .join('\n')
    .trim()
  const hasButtons = /<button\b/i.test(out)
  const hasSliders = /<input\b[^>]*\btype\s*=\s*["']?range["']?/i.test(out)
  const hasCheckboxes = /<input\b[^>]*\btype\s*=\s*["']?checkbox["']?/i.test(out)
  const hasInteractiveCtrl = hasButtons || hasSliders || hasCheckboxes || hasCanvasTag
  const jsLooksMeaningful = inlineJsBody.length > 30 // 至少几行真代码而不是空 / 仅注释
  if (hasInteractiveCtrl && !jsLooksMeaningful) {
    stats.qualityIssues.push(`HTML 里有按钮/滑块/canvas 等互动元素，但没有有效的 JavaScript（${inlineJsBody.length} 字符）—— 控件点了也不会有反应，建议教师重新生成`)
  }

  // 9) 自动修复：CSS class selector 漏点号
  //    在 HTML 里收集所有 class 名，扫描 <style> 块里有没有同名的纯标签选择器（漏 `.`）
  const classNames = new Set<string>()
  out.replace(/\bclass\s*=\s*["']([^"']+)["']/gi, (_m, cls: string) => {
    for (const c of cls.trim().split(/\s+/)) {
      if (c && !/^[A-Z]/.test(c)) classNames.add(c) // 排除组件名类型
    }
    return ''
  })
  out = out.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (full, css: string) => {
    let patched = css
    for (const name of classNames) {
      // 只匹配独立的标签选择器（前面是行首/逗号/}/空白），后面紧跟 { 或 空白 +{ 或 :hover 等
      const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`(^|[,}\\s])(${safe})(\\s*[{:])`, 'g')
      patched = patched.replace(re, (m, before: string, _n: string, after: string) => {
        // 已经是 .name 的不动；只把光秃秃的 name 加点号
        if (before.endsWith('.')) return m
        stats.autoFixedCssClasses++
        return `${before}.${name}${after}`
      })
    }
    return full.replace(css, patched)
  })
  if (stats.autoFixedCssClasses > 0) {
    stats.qualityIssues.push(`自动补齐了 ${stats.autoFixedCssClasses} 处 CSS class selector 漏点号`)
  }

  return { html: out, stats }
}
