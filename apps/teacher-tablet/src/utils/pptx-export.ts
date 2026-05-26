/**
 * 课后报告 PPTX 导出工具（致敬 OpenMAIC `packages/pptxgenjs` 思路）。
 *
 * 设计目标：
 *   - 单一入口 `exportQuizReportToPPTX(report)` → 浏览器下载 .pptx
 *   - 每个题目 1 张幻灯片：题干 + 选项条形图 + 正确率 + 解析
 *   - 概览幻灯片 1 张：4 大统计 + 总体说明
 *   - 个人成绩单 1 张：表格列出每个学生
 *   - 内嵌中文字体 fallback：'PingFang SC', 'Microsoft YaHei', 'Source Han Sans'
 *
 * 选用 pptxgenjs（MIT，纯浏览器，零后端依赖，~700KB gzip）。
 */

import PptxGenJS from 'pptxgenjs'

const FONT = 'PingFang SC,Microsoft YaHei,sans-serif'
const FONT_MONO = 'Cascadia Code,Consolas,monospace'

const COLORS = {
  primary: '1677FF',
  success: '52C41A',
  warning: 'D46B08',
  danger: 'CF1322',
  info: '722ED1',
  text: '262626',
  textMuted: '8C8C8C',
  border: 'E5E5E5',
  bgLight: 'F5F7FA',
}

interface PerQuestion { score: number; correct?: boolean; comment?: string }

interface Submission {
  studentId: string
  studentName: string
  score?: number
  submittedAt: string
  perQuestion?: Record<string, PerQuestion>
}

interface QuizQuestion {
  id?: string
  type: string
  content: string
  options?: { key: string; content: string }[]
  answer?: string
  analysis?: string
  referenceAnswer?: string
  points?: number
}

interface QuestionStat {
  question: QuizQuestion
  answerCount: Record<string, number>
  correctCount: number
  correctRate: number
  avgScore: number
  answers: Array<{ studentId: string; studentName: string; answer: string; score?: number; comment?: string }>
}

interface KnowledgeMastery {
  knowledgePointName: string
  masteryPercent: number
  questionCount: number
  status: 'mastered' | 'practicing' | 'needs_improvement'
}

interface QuizReport {
  taskId: string
  title: string
  startedAt: string
  endedAt?: string
  totalStudents: number
  submittedCount: number
  avgScore: number
  maxScore: number
  minScore: number
  questions: QuizQuestion[]
  questionStats: QuestionStat[]
  knowledgeMastery?: KnowledgeMastery[]
  submissions: Submission[]
}

function typeLabel(t: string): string {
  switch (t) {
    case 'single_choice': return '单选'
    case 'multiple_choice': return '多选'
    case 'true_false': return '判断'
    case 'short_answer': return '简答'
    default: return t
  }
}

function isObjective(t: string): boolean {
  return t === 'single_choice' || t === 'multiple_choice' || t === 'true_false'
}

function rateColor(v: number | undefined): string {
  if (v == null) return COLORS.textMuted
  if (v >= 85) return COLORS.success
  if (v >= 70) return COLORS.primary
  if (v >= 50) return COLORS.warning
  return COLORS.danger
}

const TRUE_TOKENS = new Set(['TRUE', 'T', 'YES', 'Y', '1', 'A', '对', '正确', '是'])
const FALSE_TOKENS = new Set(['FALSE', 'F', 'NO', 'N', '0', 'B', '错', '错误', '否'])

/** 对 true_false 题：合并所有“真”token 或所有“假”token 的计数，与 QuizReport.vue 行为一致 */
function answerCountForOption(qs: QuestionStat, key: string): number {
  if (qs.question.type !== 'true_false') return qs.answerCount[key] || 0
  const targetIsTrue = TRUE_TOKENS.has(key.toUpperCase()) || TRUE_TOKENS.has(key)
  let count = 0
  for (const [k, v] of Object.entries(qs.answerCount)) {
    const upper = k.toUpperCase()
    const isTrue = TRUE_TOKENS.has(upper) || TRUE_TOKENS.has(k)
    const isFalse = FALSE_TOKENS.has(upper) || FALSE_TOKENS.has(k)
    if (targetIsTrue && isTrue) count += v
    if (!targetIsTrue && isFalse) count += v
  }
  return count
}

function formatTimeLocal(iso?: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

/** 把一段文本按字符数拆成多行，避免超长文字溢出幻灯片 */
function wrapText(s: string, maxPerLine: number): string {
  if (!s) return ''
  const chars = Array.from(s)
  if (chars.length <= maxPerLine) return s
  const lines: string[] = []
  for (let i = 0; i < chars.length; i += maxPerLine) {
    lines.push(chars.slice(i, i + maxPerLine).join(''))
  }
  return lines.join('\n')
}

export async function exportQuizReportToPPTX(report: QuizReport): Promise<void> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.33 × 7.5 inches
  pptx.title = `${report.title} - 测验报告`
  pptx.author = '师渊课堂'
  pptx.company = '集美工业职业学院'

  // ============ 封面 ============
  const cover = pptx.addSlide()
  cover.background = { color: 'F8FAFD' }
  cover.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 1.2,
    fill: { color: COLORS.primary }, line: { color: COLORS.primary },
  })
  cover.addText('测验报告', {
    x: 0.5, y: 0.3, w: 12.33, h: 0.6,
    fontFace: FONT, fontSize: 20, color: 'FFFFFF', bold: true,
  })
  cover.addText(report.title, {
    x: 0.5, y: 1.8, w: 12.33, h: 1,
    fontFace: FONT, fontSize: 38, color: COLORS.text, bold: true,
  })
  cover.addText(
    [
      { text: '考试时间：', options: { fontFace: FONT, fontSize: 14, color: COLORS.textMuted } },
      { text: formatTimeLocal(report.startedAt), options: { fontFace: FONT, fontSize: 14, color: COLORS.text, bold: true } },
      { text: '   |   ', options: { fontFace: FONT, fontSize: 14, color: COLORS.textMuted } },
      { text: '参与人数：', options: { fontFace: FONT, fontSize: 14, color: COLORS.textMuted } },
      { text: `${report.submittedCount} / ${report.totalStudents || report.submittedCount}`, options: { fontFace: FONT, fontSize: 14, color: COLORS.text, bold: true } },
    ],
    { x: 0.5, y: 3.0, w: 12.33, h: 0.5 },
  )

  // 4 大统计卡
  const stats = [
    { label: '平均分', value: report.avgScore || 0, color: COLORS.primary, bg: 'E6F4FF' },
    { label: '最高分', value: report.maxScore || 0, color: COLORS.success, bg: 'F6FFED' },
    { label: '最低分', value: report.minScore || 0, color: COLORS.warning, bg: 'FFF7E6' },
    { label: '题目数', value: report.questions.length, color: COLORS.info, bg: 'F9F0FF' },
  ]
  const cardW = 2.6
  const cardGap = 0.4
  const totalW = stats.length * cardW + (stats.length - 1) * cardGap
  const startX = (13.33 - totalW) / 2
  stats.forEach((s, i) => {
    const x = startX + i * (cardW + cardGap)
    cover.addShape(pptx.ShapeType.roundRect, {
      x, y: 4.5, w: cardW, h: 1.6,
      fill: { color: s.bg }, line: { color: s.bg },
      rectRadius: 0.15,
    })
    cover.addText(String(s.value), {
      x, y: 4.7, w: cardW, h: 0.8,
      fontFace: FONT, fontSize: 36, color: s.color, bold: true,
      align: 'center', valign: 'middle',
    })
    cover.addText(s.label, {
      x, y: 5.5, w: cardW, h: 0.4,
      fontFace: FONT, fontSize: 12, color: COLORS.textMuted, align: 'center',
    })
  })
  cover.addText('师渊课堂 · 集美工业职业学院 · ' + new Date().toLocaleDateString('zh-CN'), {
    x: 0.5, y: 6.9, w: 12.33, h: 0.3,
    fontFace: FONT, fontSize: 10, color: COLORS.textMuted, align: 'center',
  })

  // ============ 知识点掌握度（>10 条自动分页） ============
  if (report.knowledgeMastery && report.knowledgeMastery.length > 0) {
    const KP_PAGE_SIZE = 10
    const kpPages = Math.max(1, Math.ceil(report.knowledgeMastery.length / KP_PAGE_SIZE))
    for (let p = 0; p < kpPages; p++) {
      const slide = pptx.addSlide()
      slide.background = { color: 'FFFFFF' }
      slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: 13.33, h: 0.6,
        fill: { color: COLORS.bgLight }, line: { color: COLORS.bgLight },
      })
      slide.addText(`知识点掌握度${kpPages > 1 ? ` (${p + 1}/${kpPages})` : ''}`, {
        x: 0.5, y: 0.1, w: 12.33, h: 0.4,
        fontFace: FONT, fontSize: 14, color: COLORS.text, bold: true,
      })
      slide.addText('基于本次测验聚合（按题目分值加权）', {
        x: 0.5, y: 0.7, w: 12.33, h: 0.3,
        fontFace: FONT, fontSize: 11, color: COLORS.textMuted,
      })

      const kpSlice = report.knowledgeMastery.slice(p * KP_PAGE_SIZE, (p + 1) * KP_PAGE_SIZE)
      const rowH = 0.5
      const startY = 1.2
      const barAreaW = 7.5
      kpSlice.forEach((m, i) => {
        const y = startY + i * (rowH + 0.15)
        slide.addText(m.knowledgePointName, {
          x: 0.5, y, w: 3.5, h: rowH,
          fontFace: FONT, fontSize: 13, color: COLORS.text, bold: true, valign: 'middle',
        })
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 4.2, y: y + 0.1, w: barAreaW, h: rowH - 0.2,
          fill: { color: COLORS.border }, line: { color: COLORS.border }, rectRadius: 0.06,
        })
        const color = m.status === 'mastered' ? COLORS.success : m.status === 'practicing' ? COLORS.primary : COLORS.danger
        if (m.masteryPercent > 0) {
          slide.addShape(pptx.ShapeType.roundRect, {
            x: 4.2, y: y + 0.1, w: Math.max(0.1, (barAreaW * m.masteryPercent) / 100), h: rowH - 0.2,
            fill: { color }, line: { color }, rectRadius: 0.06,
          })
        }
        slide.addText(`${m.masteryPercent}%`, {
          x: 11.9, y, w: 1.2, h: rowH,
          fontFace: FONT, fontSize: 14, color, bold: true, valign: 'middle', align: 'right',
        })
        const statusLabel = m.status === 'mastered' ? '已掌握' : m.status === 'practicing' ? '练习中' : '需加强'
        slide.addText(`${m.questionCount} 题 · ${statusLabel}`, {
          x: 4.2, y: y + rowH - 0.15, w: barAreaW, h: 0.2,
          fontFace: FONT, fontSize: 9, color: COLORS.textMuted, valign: 'top',
        })
      })
    }
  }

  // ============ 每道题一张幻灯片 ============
  report.questionStats.forEach((qs, idx) => {
    const slide = pptx.addSlide()
    slide.background = { color: 'FFFFFF' }

    // 顶部条带
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 13.33, h: 0.6,
      fill: { color: COLORS.bgLight }, line: { color: COLORS.bgLight },
    })
    slide.addText(`第 ${idx + 1} 题 · ${typeLabel(qs.question.type)}`, {
      x: 0.5, y: 0.1, w: 6, h: 0.4,
      fontFace: FONT, fontSize: 14, color: COLORS.text, bold: true,
    })
    const rateText = isObjective(qs.question.type)
      ? `正确率 ${qs.correctRate}%`
      : `AI 平均 ${qs.avgScore} 分`
    slide.addText(rateText, {
      x: 7, y: 0.1, w: 6, h: 0.4,
      fontFace: FONT, fontSize: 14, color: rateColor(isObjective(qs.question.type) ? qs.correctRate : qs.avgScore), bold: true,
      align: 'right',
    })

    // 题干
    slide.addText(wrapText(qs.question.content, 60), {
      x: 0.5, y: 0.9, w: 12.33, h: 1.2,
      fontFace: FONT, fontSize: 18, color: COLORS.text, bold: true, valign: 'top',
    })

    if (isObjective(qs.question.type) && qs.question.options) {
      // 选项条形图布局：[0.5, 4.0] 题号/选项 → [4.2, 11.4] 进度条 → [11.6, 13.1] 数值标签
      const optY = 2.2
      const barAreaW = 7.2
      const barH = 0.45
      const gap = 0.2
      const totalSubmitted = report.submittedCount || 1
      const isCorrectKey = (k: string) => {
        const ans = (qs.question.answer || '').toUpperCase()
        return ans.split(',').map(s => s.trim()).includes(k.toUpperCase())
      }
      qs.question.options.forEach((opt, i) => {
        const y = optY + i * (barH + gap)
        const count = answerCountForOption(qs, opt.key)
        const pct = Math.round((count / totalSubmitted) * 100)
        const isCorr = isCorrectKey(opt.key)
        // 选项标号 + 内容
        slide.addText([
          { text: `${opt.key}. `, options: { bold: true, color: isCorr ? COLORS.success : COLORS.text, fontFace: FONT, fontSize: 13 } },
          { text: wrapText(opt.content, 30), options: { color: COLORS.text, fontFace: FONT, fontSize: 13 } },
        ], { x: 0.5, y, w: 3.5, h: barH, valign: 'middle' })

        // 进度条背景
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 4.2, y: y + 0.1, w: barAreaW, h: barH - 0.2,
          fill: { color: COLORS.border }, line: { color: COLORS.border },
          rectRadius: 0.05,
        })
        // 进度条填充
        if (pct > 0) {
          const fillW = Math.max(0.1, (barAreaW * pct) / 100)
          slide.addShape(pptx.ShapeType.roundRect, {
            x: 4.2, y: y + 0.1, w: fillW, h: barH - 0.2,
            fill: { color: isCorr ? COLORS.success : COLORS.primary },
            line: { color: isCorr ? COLORS.success : COLORS.primary },
            rectRadius: 0.05,
          })
        }
        // 数值
        slide.addText(`${count} 人 (${pct}%)${isCorr ? ' ✓' : ''}`, {
          x: 11.6, y, w: 1.5, h: barH,
          fontFace: FONT, fontSize: 11, color: isCorr ? COLORS.success : COLORS.textMuted,
          align: 'left', valign: 'middle',
        })
      })

      // 解析
      if (qs.question.analysis) {
        const analysisY = optY + qs.question.options.length * (barH + gap) + 0.3
        slide.addText([
          { text: '解析：', options: { bold: true, fontFace: FONT, fontSize: 11, color: COLORS.info } },
          { text: wrapText(qs.question.analysis, 70), options: { fontFace: FONT, fontSize: 11, color: COLORS.text } },
        ], { x: 0.5, y: analysisY, w: 12.33, h: 0.8, valign: 'top' })
      }
    } else {
      // 简答题：显示前 6 个学生回答 + AI 评语，超出在末尾给提示
      const allValidAnswers = qs.answers.filter(a => a.answer)
      const validAnswers = allValidAnswers.slice(0, 6)
      validAnswers.forEach((ans, i) => {
        const y = 2.2 + i * 0.7
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 0.5, y, w: 12.33, h: 0.6,
          fill: { color: COLORS.bgLight }, line: { color: COLORS.bgLight },
          rectRadius: 0.08,
        })
        slide.addText([
          { text: ans.studentName, options: { bold: true, fontFace: FONT, fontSize: 12, color: COLORS.text } },
          { text: '   ', options: {} },
          { text: ans.score != null ? `${ans.score} 分` : '', options: { fontFace: FONT, fontSize: 11, color: rateColor(ans.score), bold: true } },
        ], { x: 0.7, y: y + 0.05, w: 3, h: 0.25, valign: 'top' })
        slide.addText(wrapText(ans.answer, 80), {
          x: 0.7, y: y + 0.28, w: 12, h: 0.3,
          fontFace: FONT, fontSize: 10, color: COLORS.text, valign: 'top',
        })
      })
      let nextY = 2.2 + validAnswers.length * 0.7 + 0.1
      if (allValidAnswers.length > validAnswers.length) {
        slide.addText(`…还有 ${allValidAnswers.length - validAnswers.length} 位学生作答（详见「按学生分析」）`, {
          x: 0.5, y: nextY, w: 12.33, h: 0.3,
          fontFace: FONT, fontSize: 10, color: COLORS.textMuted, italic: true, valign: 'top',
        })
        nextY += 0.35
      }
      if (qs.question.referenceAnswer) {
        slide.addText([
          { text: '参考答案：', options: { bold: true, fontFace: FONT, fontSize: 11, color: COLORS.success } },
          { text: wrapText(qs.question.referenceAnswer, 70), options: { fontFace: FONT, fontSize: 11, color: COLORS.text } },
        ], { x: 0.5, y: nextY, w: 12.33, h: 0.8, valign: 'top' })
      }
    }

    // 页脚
    slide.addText(`${idx + 1} / ${report.questionStats.length}`, {
      x: 12, y: 7.1, w: 1, h: 0.3,
      fontFace: FONT_MONO, fontSize: 9, color: COLORS.textMuted, align: 'right',
    })
  })

  // ============ 学生成绩表 ============
  const sortedSubs = [...report.submissions].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  // 一页最多 18 条，否则分多页
  const PAGE_SIZE = 18
  const pages = Math.max(1, Math.ceil(sortedSubs.length / PAGE_SIZE))
  for (let p = 0; p < pages; p++) {
    const slide = pptx.addSlide()
    slide.background = { color: 'FFFFFF' }
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 13.33, h: 0.6,
      fill: { color: COLORS.bgLight }, line: { color: COLORS.bgLight },
    })
    slide.addText(`学生成绩单 ${pages > 1 ? `(${p + 1}/${pages})` : ''}`, {
      x: 0.5, y: 0.1, w: 12.33, h: 0.4,
      fontFace: FONT, fontSize: 14, color: COLORS.text, bold: true,
    })

    const slice = sortedSubs.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE)
    const rows: any[][] = [[
      { text: '排名', options: { bold: true, fontFace: FONT, fontSize: 12, color: COLORS.text, fill: { color: COLORS.bgLight } } },
      { text: '学生', options: { bold: true, fontFace: FONT, fontSize: 12, color: COLORS.text, fill: { color: COLORS.bgLight } } },
      { text: '得分', options: { bold: true, fontFace: FONT, fontSize: 12, color: COLORS.text, fill: { color: COLORS.bgLight }, align: 'center' } },
      { text: '提交时间', options: { bold: true, fontFace: FONT, fontSize: 12, color: COLORS.text, fill: { color: COLORS.bgLight }, align: 'center' } },
    ]]
    slice.forEach((s, i) => {
      const rank = p * PAGE_SIZE + i + 1
      rows.push([
        { text: String(rank), options: { fontFace: FONT, fontSize: 11, color: COLORS.text } },
        { text: s.studentName, options: { fontFace: FONT, fontSize: 11, color: COLORS.text } },
        { text: String(s.score ?? '-'), options: { fontFace: FONT, fontSize: 11, color: rateColor(s.score), bold: true, align: 'center' } },
        { text: formatTimeLocal(s.submittedAt), options: { fontFace: FONT, fontSize: 11, color: COLORS.textMuted, align: 'center' } },
      ])
    })
    slide.addTable(rows, {
      x: 0.5, y: 0.9, w: 12.33,
      colW: [1.2, 4, 2, 5.13],
      border: { type: 'solid', pt: 0.5, color: COLORS.border },
      fontSize: 11, fontFace: FONT,
      valign: 'middle',
      rowH: 0.3,
    })
  }

  // ============ 触发下载 ============
  const safeTitle = report.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60)
  const filename = `${safeTitle}-${new Date().toISOString().slice(0, 10)}.pptx`
  await pptx.writeFile({ fileName: filename })
}
