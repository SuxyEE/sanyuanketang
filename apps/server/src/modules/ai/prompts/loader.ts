/**
 * Mini prompt loader（致敬 OpenMAIC `lib/prompts/loader.ts`）。
 *
 * 目录约定：
 *   apps/server/src/modules/ai/prompts/<promptId>/{system,user}.md
 *
 * 占位符：
 *   {{varName}}                单变量插值
 *   {{#if condName}}...{{/if}} 条件块（变量真值时保留）
 *   {{snippet:name}}           插入 prompts/snippets/<name>.md
 *
 * 处理顺序：snippet → if → variable（与 OpenMAIC 一致）。
 *
 * 开发环境（NODE_ENV != 'production'）每次调用都重读磁盘，调试体验最佳；
 * 生产环境读到的内容缓存到进程结束。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * PROMPTS_DIR 解析顺序（致敬 OpenMAIC dev/prod 两套路径）：
 *   1. __dirname（dist/modules/ai/prompts）— prod 与 nest watch 编译后
 *   2. src/modules/ai/prompts — dev 下 nest watch 不自动 copy 新 .md 到 dist 的兜底
 *
 * 这样开发期新建 prompt 文件不需要重启 nest，也不需要手动 Copy-Item。
 */
const DIST_PROMPTS_DIR = path.join(__dirname)
const SRC_PROMPTS_DIR = DIST_PROMPTS_DIR.replace(
  `${path.sep}dist${path.sep}`,
  `${path.sep}src${path.sep}`,
)

const isProd = process.env.NODE_ENV === 'production'
const cache = new Map<string, string>()

/** Resolve an absolute file path against dist first, fall back to src in dev. */
function resolveAbsPath(relPath: string): string {
  const distAbs = path.join(DIST_PROMPTS_DIR, relPath)
  if (fs.existsSync(distAbs)) return distAbs
  if (!isProd) {
    const srcAbs = path.join(SRC_PROMPTS_DIR, relPath)
    if (fs.existsSync(srcAbs)) return srcAbs
  }
  return distAbs
}

function existsAnywhere(relPath: string): boolean {
  if (fs.existsSync(path.join(DIST_PROMPTS_DIR, relPath))) return true
  if (!isProd && fs.existsSync(path.join(SRC_PROMPTS_DIR, relPath))) return true
  return false
}

const SNIPPETS_DIR = path.join(DIST_PROMPTS_DIR, 'snippets')
const SRC_SNIPPETS_DIR = path.join(SRC_PROMPTS_DIR, 'snippets')

function readFileMaybeCached(absPath: string): string {
  if (isProd && cache.has(absPath)) return cache.get(absPath)!
  const content = fs.readFileSync(absPath, 'utf-8')
  if (isProd) cache.set(absPath, content)
  return content
}

/** Resolve `{{snippet:xxx}}` recursively (single pass since snippets are leaf-only by convention). */
function processSnippets(text: string): string {
  return text.replace(/\{\{snippet:([\w-]+)\}\}/g, (_match, name: string) => {
    const distFile = path.join(SNIPPETS_DIR, `${name}.md`)
    if (fs.existsSync(distFile)) return readFileMaybeCached(distFile)
    if (!isProd) {
      const srcFile = path.join(SRC_SNIPPETS_DIR, `${name}.md`)
      if (fs.existsSync(srcFile)) return readFileMaybeCached(srcFile)
    }
    throw new Error(`[prompts] snippet not found: ${name} (looked in ${distFile})`)
  })
}

/** Resolve `{{#if cond}}...{{/if}}` blocks. Truthy variables keep content; falsy drops the whole block. */
function processConditionalBlocks(text: string, vars: Record<string, unknown>): string {
  // Non-greedy so adjacent blocks don't run together; supports multi-line via [\s\S].
  return text.replace(/\{\{#if\s+([\w-]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, cond: string, body: string) => {
    return vars[cond] ? body : ''
  })
}

/** Resolve `{{varName}}` — missing variables are LEFT AS-IS (no exception). Use templates.test.ts to enforce. */
function interpolateVariables(text: string, vars: Record<string, unknown>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) {
      const v = vars[name]
      return v == null ? '' : String(v)
    }
    return match
  })
}

/** Load a single template file relative to PROMPTS_DIR (e.g. `chat/system.md`). */
function loadFile(relPath: string): string {
  const abs = resolveAbsPath(relPath)
  if (!fs.existsSync(abs)) {
    throw new Error(`[prompts] file not found: ${relPath} (looked in ${abs})`)
  }
  return readFileMaybeCached(abs)
}

export interface BuiltPrompt {
  system: string
  user?: string
}

/**
 * Build a prompt by id with variable interpolation.
 *
 * @param promptId 模板目录名（如 'chat' / 'quiz-gen' / 'grade'）
 * @param vars 变量字典（同时用于 {{varName}} 与 {{#if condName}}）
 */
export function buildPrompt(promptId: string, vars: Record<string, unknown> = {}): BuiltPrompt {
  const hasSystem = existsAnywhere(path.join(promptId, 'system.md'))
  const hasUser = existsAnywhere(path.join(promptId, 'user.md'))

  if (!hasSystem && !hasUser) {
    throw new Error(
      `[prompts] no system.md or user.md found for promptId="${promptId}" (looked in ${path.join(DIST_PROMPTS_DIR, promptId)}` +
        (isProd ? ')' : ` and ${path.join(SRC_PROMPTS_DIR, promptId)})`),
    )
  }

  const pipeline = (text: string) =>
    interpolateVariables(processConditionalBlocks(processSnippets(text), vars), vars)

  return {
    system: hasSystem ? pipeline(loadFile(path.join(promptId, 'system.md'))) : '',
    user: hasUser ? pipeline(loadFile(path.join(promptId, 'user.md'))) : undefined,
  }
}

/** 用于测试断言：调用后应当没有 `{{...}}` 残留 */
export function hasUnresolvedPlaceholders(text: string): boolean {
  return /\{\{[\w:#/]+\}\}|\{\{\w+\}\}/.test(text)
}
