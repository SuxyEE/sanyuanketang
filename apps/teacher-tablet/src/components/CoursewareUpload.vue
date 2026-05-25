<template>
  <div class="courseware-upload" role="dialog" aria-label="导入课件">
    <div class="panel-header">
      <h3>导入课件</h3>
      <button class="close-btn" @click="$emit('close')" aria-label="关闭">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="panel-body">
      <div v-if="!isUploading && slides.length === 0" class="upload-area">
        <div class="drop-zone" :class="{ dragging: isDragOver }" @click="triggerFileInput" @dragover.prevent="isDragOver = true" @dragleave="isDragOver = false" @drop.prevent="handleDrop">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <h4>点击或拖拽上传课件</h4>
          <p>支持 PDF、PPT(图片) 和 多张图片(JPG/PNG)</p>
          <p class="hint">PDF 自动按页转换为课件，每张图片作为一页</p>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          multiple
          style="display: none"
          @change="handleFileSelect"
        />

        <div class="demo-btn-area">
          <button class="demo-btn" @click="loadDemoSlides">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            加载演示课件（5页）
          </button>
        </div>
      </div>

      <div v-else-if="isUploading" class="uploading-area">
        <div class="upload-progress">
          <div class="progress-ring">
            <svg viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#e8ecf0" stroke-width="5" />
              <circle
                cx="40" cy="40" r="34"
                fill="none" stroke="var(--primary)" stroke-width="5"
                stroke-linecap="round"
                :stroke-dasharray="circumference"
                :stroke-dashoffset="circumference - (uploadProgress / 100) * circumference"
                transform="rotate(-90 40 40)"
                style="transition: stroke-dashoffset 0.3s ease"
              />
            </svg>
            <span class="progress-num">{{ uploadProgress }}%</span>
          </div>
          <p>{{ uploadStatus || '正在处理课件...' }}</p>
        </div>
      </div>

      <div v-else class="preview-area">
        <div class="preview-header">
          <h4>课件预览（{{ slides.length }}页）</h4>
          <div class="preview-actions">
            <button class="action-btn outline" @click="resetSlides" :disabled="isPublishing || published">重新上传</button>
            <button class="action-btn primary-btn" @click="publishSlides" :disabled="isPublishing || published">
              <span v-if="isPublishing" class="btn-spinner" aria-hidden="true"></span>
              <svg v-else-if="!published" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l4 4L19 6"/></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l4 4L19 6"/></svg>
              {{ isPublishing ? '正在发布…' : (published ? '发布成功' : '发布到课堂') }}
            </button>
          </div>
        </div>

        <div class="slides-grid">
          <div
            v-for="(slide, idx) in slides"
            :key="idx"
            class="slide-thumb"
            :class="{ active: previewIndex === idx }"
            @click="previewIndex = idx"
          >
            <img :src="slide.dataUrl" :alt="`第${idx + 1}页`" />
            <span class="page-num">{{ idx + 1 }}</span>
          </div>
        </div>

        <div class="preview-main" v-if="slides[previewIndex]">
          <img :src="slides[previewIndex].dataUrl" :alt="`预览第${previewIndex + 1}页`" />
        </div>
      </div>
    </div>

    <transition name="publish-fade">
      <div v-if="isPublishing || published" class="publish-overlay" :class="{ done: published }">
        <div class="publish-card">
          <div v-if="!published" class="publish-loader" aria-hidden="true">
            <svg viewBox="0 0 50 50" class="loader-svg">
              <circle cx="25" cy="25" r="20" fill="none" stroke="#e6f4ff" stroke-width="5" />
              <circle
                cx="25" cy="25" r="20"
                fill="none" stroke="var(--primary)" stroke-width="5"
                stroke-linecap="round" stroke-dasharray="90 150"
              />
            </svg>
          </div>
          <div v-else class="publish-success" aria-hidden="true">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4L19 6"/></svg>
          </div>
          <p class="publish-title">{{ published ? '课件已发布到课堂' : '正在发布课件…' }}</p>
          <p class="publish-sub">
            {{ published
              ? `${slides.length} 页课件已同步至所有学生端和大屏`
              : `正在将 ${slides.length} 页课件同步到学生端和大屏…` }}
          </p>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import { useToast } from '../composables/useToast'

const { toastSuccess, toastInfo, toastError } = useToast()

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface SlideItem {
  index: number
  dataUrl: string
}

const emit = defineEmits<{
  close: []
  publish: [slides: SlideItem[]]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const slides = ref<SlideItem[]>([])
const isUploading = ref(false)
const uploadProgress = ref(0)
const uploadStatus = ref('')
const previewIndex = ref(0)
const isPublishing = ref(false)
const published = ref(false)
const isDragOver = ref(false)
const circumference = 2 * Math.PI * 34

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) {
    processFiles(Array.from(input.files))
  }
}

function handleDrop(e: DragEvent) {
  isDragOver.value = false
  if (e.dataTransfer?.files) {
    processFiles(Array.from(e.dataTransfer.files))
  }
}

async function processFiles(files: File[]) {
  isUploading.value = true
  uploadProgress.value = 0
  uploadStatus.value = '正在读取文件...'
  slides.value = []

  const imageFiles = files.filter(f => f.type.startsWith('image/'))
  const pdfFiles = files.filter(f => f.type === 'application/pdf')

  try {
    if (pdfFiles.length > 0) {
      await processPdf(pdfFiles[0])
    } else if (imageFiles.length > 0) {
      await processImages(imageFiles)
    } else {
      toastError('未识别到 PDF 或图片，请重新选择文件')
      isUploading.value = false
      return
    }
  } catch (err) {
    console.error('File processing error:', err)
    uploadStatus.value = '处理失败，请重试'
    toastError('课件解析失败，请重试')
    setTimeout(() => { isUploading.value = false }, 1200)
    return
  }

  isUploading.value = false
  uploadStatus.value = ''
  if (slides.value.length > 0) {
    toastSuccess(`已加载 ${slides.value.length} 页课件，点击右上「发布到课堂」`, 2600)
  }
}

async function processImages(files: File[]) {
  const sorted = files.sort((a, b) => a.name.localeCompare(b.name))
  const total = sorted.length

  for (let i = 0; i < sorted.length; i++) {
    uploadStatus.value = `正在处理图片 ${i + 1}/${total}...`
    const dataUrl = await readFileAsDataUrl(sorted[i])
    slides.value.push({ index: i, dataUrl })
    uploadProgress.value = Math.round(((i + 1) / total) * 100)
  }
}

async function processPdf(file: File) {
  uploadStatus.value = '正在解析 PDF...'
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const total = pdf.numPages
  uploadStatus.value = `PDF 共 ${total} 页，正在渲染...`

  const scale = 2
  for (let i = 1; i <= total; i++) {
    uploadStatus.value = `正在渲染第 ${i}/${total} 页...`
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!

    await page.render({ canvasContext: ctx, viewport }).promise
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
    slides.value.push({ index: i - 1, dataUrl })
    uploadProgress.value = Math.round((i / total) * 100)
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(file)
  })
}

function resetSlides() {
  slides.value = []
  previewIndex.value = 0
  published.value = false
}

const publishTimers: Array<ReturnType<typeof setTimeout>> = []

function publishSlides() {
  if (isPublishing.value || published.value) return
  isPublishing.value = true
  toastInfo(`正在发布 ${slides.value.length} 页课件…`, 1600)

  publishTimers.push(setTimeout(() => {
    try {
      emit('publish', slides.value)
      isPublishing.value = false
      published.value = true
      toastSuccess(`课件已发布到课堂（${slides.value.length} 页）`)
      publishTimers.push(setTimeout(() => emit('close'), 1100))
    } catch (err) {
      console.error(err)
      isPublishing.value = false
      toastError('发布失败，请重试')
    }
  }, 320))
}

async function loadDemoSlides() {
  isUploading.value = true
  uploadProgress.value = 0
  uploadStatus.value = '正在生成演示课件...'

  const renderers: Array<(ctx: CanvasRenderingContext2D, w: number, h: number, page: number, total: number) => void> = [
    drawTitleSlide,
    drawAgendaSlide,
    drawWorkflowSlide,
    drawScannerCompareSlide,
    drawPointCloudDiagramSlide,
    drawNurbsCodeSlide,
    drawAccuracyTableSlide,
    drawSummarySlide,
  ]

  const W = 1280, H = 720
  const total = renderers.length

  for (let i = 0; i < total; i++) {
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!
    renderers[i](ctx, W, H, i + 1, total)
    slides.value.push({ index: i, dataUrl: canvas.toDataURL('image/jpeg', 0.9) })
    uploadProgress.value = Math.round(((i + 1) / total) * 100)
    uploadStatus.value = `演示课件渲染中 ${i + 1}/${total}...`
    await new Promise(r => setTimeout(r, 80))
  }

  isUploading.value = false
  toastSuccess('演示课件已就绪，点击「发布到课堂」', 2600)
}

function drawFooter(ctx: CanvasRenderingContext2D, w: number, h: number, page: number, total: number) {
  ctx.fillStyle = '#94a3b8'
  ctx.font = '14px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('数字化设计与制造 · 三维建模与逆向工程实训', 48, h - 24)
  ctx.textAlign = 'right'
  ctx.fillText(`${page} / ${total}`, w - 48, h - 24)
  ctx.textAlign = 'left'
}

function drawPageBg(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, w, 56)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 18px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('集美工业职业学院 · 智慧课堂', 32, 36)
  ctx.fillStyle = '#94a3b8'
  ctx.font = '14px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }), w - 32, 36)
  ctx.textAlign = 'left'
}

function drawTitleSlide(ctx: CanvasRenderingContext2D, w: number, h: number, page: number, total: number) {
  const grad = ctx.createLinearGradient(0, 0, w, h)
  grad.addColorStop(0, '#0f172a')
  grad.addColorStop(0.5, '#1e293b')
  grad.addColorStop(1, '#0a0e27')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(96, 165, 250, ${0.05 + Math.random() * 0.08})`
    ctx.beginPath()
    ctx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.strokeStyle = 'rgba(96, 165, 250, 0.18)'
  ctx.lineWidth = 1
  for (let x = 0; x < w; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
  }
  for (let y = 0; y < h; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }

  ctx.fillStyle = '#60a5fa'
  ctx.font = '16px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('数字化设计与制造 · 项目 5', 80, 240)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 64px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('三维建模与逆向工程实训', 80, 320)
  ctx.fillStyle = '#cbd5e1'
  ctx.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('Reverse Engineering & 3D Modeling Workshop', 80, 360)

  ctx.fillStyle = '#64748b'
  ctx.font = '18px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('授课教师：王老师  ·  数设 2401 班  ·  45 分钟', 80, 460)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.font = '14px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`第 ${page} / ${total} 页 · 智慧课堂演示课件`, w - 48, h - 32)
  ctx.textAlign = 'left'
}

function drawAgendaSlide(ctx: CanvasRenderingContext2D, w: number, h: number, page: number, total: number) {
  drawPageBg(ctx, w, h)
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 36px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('本节课学习目标', 60, 130)
  ctx.fillStyle = '#94a3b8'
  ctx.font = '16px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('掌握「逆向工程」的核心流程，能独立完成扫描 → 重构 → 验证的完整链路', 60, 162)

  const items = [
    { num: '01', title: '了解逆向工程的工业应用场景', desc: '航空叶片修复、汽车曲面复刻、文物数字化保护' },
    { num: '02', title: '掌握三种主流三维扫描方法的选择', desc: '结构光 / 激光线 / 接触式 三类设备适用场景对比' },
    { num: '03', title: '能够进行点云数据预处理', desc: '去噪、配准、采样、孔洞修补四大步骤' },
    { num: '04', title: '使用 NURBS 曲面拟合并评估精度', desc: '基于偏差色谱图判断重构质量是否达标' },
  ]
  let y = 220
  items.forEach((item) => {
    ctx.fillStyle = '#1677ff'
    ctx.beginPath(); ctx.roundRect(60, y, 54, 54, 10); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 22px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(item.num, 87, y + 36)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 20px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(item.title, 134, y + 24)
    ctx.fillStyle = '#64748b'
    ctx.font = '15px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(item.desc, 134, y + 48)
    y += 90
  })

  drawFooter(ctx, w, h, page, total)
}

function drawWorkflowSlide(ctx: CanvasRenderingContext2D, w: number, h: number, page: number, total: number) {
  drawPageBg(ctx, w, h)
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 36px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('逆向工程标准作业流程（SOP）', 60, 130)

  const steps = [
    { label: '01 准备阶段', items: ['零件清洁喷粉', '设备标定校准', '扫描参数设定'], color: '#1677ff' },
    { label: '02 数据采集', items: ['多视角扫描', '点云对齐拼接', '完整性检查'], color: '#722ed1' },
    { label: '03 点云处理', items: ['噪点过滤', '孔洞修补', '边界提取'], color: '#fa541c' },
    { label: '04 曲面重构', items: ['特征线提取', 'NURBS 拟合', '偏差检验'], color: '#52c41a' },
  ]

  const stepW = 270, stepH = 360, gap = 30
  const startX = (w - (steps.length * stepW + (steps.length - 1) * gap)) / 2
  const startY = 200

  steps.forEach((step, idx) => {
    const x = startX + idx * (stepW + gap)
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.roundRect(x, startY, stepW, stepH, 16); ctx.fill(); ctx.stroke()

    ctx.fillStyle = step.color
    ctx.beginPath(); ctx.roundRect(x, startY, stepW, 56, [16, 16, 0, 0]); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 18px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(step.label, x + 20, startY + 36)

    ctx.fillStyle = '#334155'
    ctx.font = '16px "PingFang SC", "Microsoft YaHei", sans-serif'
    step.items.forEach((item, i) => {
      ctx.fillText('●  ' + item, x + 20, startY + 100 + i * 36)
    })

    if (idx < steps.length - 1) {
      const ax = x + stepW + 4
      const ay = startY + stepH / 2
      ctx.strokeStyle = step.color
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(ax, ay); ctx.lineTo(ax + gap - 10, ay)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(ax + gap - 10, ay)
      ctx.lineTo(ax + gap - 18, ay - 6)
      ctx.lineTo(ax + gap - 18, ay + 6)
      ctx.closePath()
      ctx.fillStyle = step.color
      ctx.fill()
    }
  })

  ctx.fillStyle = '#64748b'
  ctx.font = '14px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('提示：每一步的输出都是下一步的输入，前序质量直接决定最终精度。', 60, 620)

  drawFooter(ctx, w, h, page, total)
}

function drawScannerCompareSlide(ctx: CanvasRenderingContext2D, w: number, h: number, page: number, total: number) {
  drawPageBg(ctx, w, h)
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 36px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('三种主流三维扫描技术对比', 60, 130)

  const headers = ['指标', '结构光扫描', '激光线扫描', '接触式测量']
  const rows = [
    ['精度等级', '±0.02 mm', '±0.03 mm', '±0.005 mm'],
    ['扫描速度', '快（30s/视角）', '较快（1min）', '慢（手动逐点）'],
    ['适用尺寸', '0.05 – 2 m', '0.1 – 5 m', '< 1 m'],
    ['表面要求', '需喷粉', '反光面需喷粉', '可直接测量'],
    ['典型应用', '消费电子外壳', '汽车覆盖件', '精密机加工件'],
  ]
  const colors = ['#e2e8f0', '#dbeafe', '#fde68a', '#fecaca']

  const tableX = 60, tableY = 200, colW = 280, rowH = 56
  ctx.fillStyle = '#1e293b'
  ctx.beginPath(); ctx.roundRect(tableX, tableY, colW * 4, rowH, [12, 12, 0, 0]); ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 18px "PingFang SC", "Microsoft YaHei", sans-serif'
  headers.forEach((header, i) => {
    ctx.fillText(header, tableX + 20 + i * colW, tableY + 36)
  })

  rows.forEach((row, ri) => {
    const y = tableY + rowH + ri * rowH
    ctx.fillStyle = ri % 2 === 0 ? '#fff' : '#f1f5f9'
    ctx.fillRect(tableX, y, colW * 4, rowH)
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 1
    ctx.strokeRect(tableX, y, colW * 4, rowH)
    ctx.fillStyle = '#0f172a'
    ctx.font = ri === 0 ? 'bold 16px "PingFang SC", sans-serif' : '16px "PingFang SC", sans-serif'
    row.forEach((cell, ci) => {
      if (ci === 0) ctx.fillStyle = '#475569'
      else ctx.fillStyle = '#0f172a'
      ctx.font = ci === 0 ? 'bold 16px "PingFang SC", sans-serif' : '16px "PingFang SC", sans-serif'
      ctx.fillText(cell, tableX + 20 + ci * colW, y + 34)
    })
  })

  ctx.fillStyle = colors[2]
  ctx.beginPath(); ctx.roundRect(60, 600, 1160, 60, 12); ctx.fill()
  ctx.fillStyle = '#92400e'
  ctx.font = 'bold 16px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('⚡ 课堂思考', 80, 632)
  ctx.fillStyle = '#78350f'
  ctx.font = '16px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('如果要扫描一只 200mm 的塑料水杯（半透明、薄壁），最适合选哪种方式？为什么？', 200, 632)

  drawFooter(ctx, w, h, page, total)
}

function drawPointCloudDiagramSlide(ctx: CanvasRenderingContext2D, w: number, h: number, page: number, total: number) {
  drawPageBg(ctx, w, h)
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 36px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('点云数据预处理：去噪 + 配准', 60, 130)
  ctx.fillStyle = '#64748b'
  ctx.font = '16px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('原始扫描数据包含大量噪点和孤立点，必须通过统计滤波 + ICP 配准得到完整模型', 60, 162)

  drawPointCloudCanvas(ctx, 80, 220, 480, 360, true, '原始点云（含噪声 ~3%）')
  drawPointCloudCanvas(ctx, 720, 220, 480, 360, false, '处理后点云（去噪 + 配准 + 采样）')

  ctx.strokeStyle = '#1677ff'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(572, 400); ctx.lineTo(712, 400)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(712, 400)
  ctx.lineTo(700, 392); ctx.lineTo(700, 408)
  ctx.closePath()
  ctx.fillStyle = '#1677ff'
  ctx.fill()
  ctx.fillStyle = '#1677ff'
  ctx.font = 'bold 14px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('SOR 滤波', 642, 388)
  ctx.fillText('ICP 配准', 642, 422)
  ctx.textAlign = 'left'

  drawFooter(ctx, w, h, page, total)
}

function drawPointCloudCanvas(ctx: CanvasRenderingContext2D, x: number, y: number, ww: number, hh: number, noisy: boolean, label: string) {
  ctx.fillStyle = '#0f172a'
  ctx.beginPath(); ctx.roundRect(x, y, ww, hh, 12); ctx.fill()

  const seed = (i: number) => Math.sin(i * 12.3 + (noisy ? 0 : 1.7)) * 10000

  const center = { x: x + ww / 2, y: y + hh / 2 }
  for (let i = 0; i < 800; i++) {
    const angle = (seed(i) % 1000) / 1000 * Math.PI * 2
    const radius = 60 + ((seed(i * 2) + 1) / 2) * 90
    const dx = Math.cos(angle) * radius
    const dy = Math.sin(angle) * radius * 0.55
    const offsetZ = ((seed(i * 3) + 1) / 2) * 70
    const px = center.x + dx
    const py = center.y + dy - offsetZ
    const brightness = 0.4 + offsetZ / 100
    ctx.fillStyle = `rgba(96, 165, 250, ${brightness})`
    ctx.beginPath(); ctx.arc(px, py, 1.6, 0, Math.PI * 2); ctx.fill()
  }

  if (noisy) {
    for (let i = 0; i < 80; i++) {
      const rx = x + 20 + Math.random() * (ww - 40)
      const ry = y + 20 + Math.random() * (hh - 40)
      ctx.fillStyle = 'rgba(248, 113, 113, 0.85)'
      ctx.beginPath(); ctx.arc(rx, ry, 1.8, 0, Math.PI * 2); ctx.fill()
    }
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.font = '14px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(label, x + ww / 2, y + hh - 16)
  ctx.textAlign = 'left'
}

function drawNurbsCodeSlide(ctx: CanvasRenderingContext2D, w: number, h: number, page: number, total: number) {
  drawPageBg(ctx, w, h)
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 36px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('NURBS 曲面拟合（Python 示例）', 60, 130)
  ctx.fillStyle = '#64748b'
  ctx.font = '16px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('使用 geomdl 库从点云重建非均匀有理 B 样条曲面，参数 u/v 阶次直接影响精度', 60, 162)

  ctx.fillStyle = '#1e293b'
  ctx.beginPath(); ctx.roundRect(60, 200, 720, 440, 14); ctx.fill()

  const codeLines: Array<{ text: string; color: string }> = [
    { text: 'from geomdl import fitting', color: '#94a3b8' },
    { text: 'from geomdl.visualization import VisMPL', color: '#94a3b8' },
    { text: '', color: '#fff' },
    { text: '# 1. 加载预处理后的点云 (X, Y, Z) 列表', color: '#64748b' },
    { text: 'points = load_pointcloud("scan_clean.ply")', color: '#e2e8f0' },
    { text: '', color: '#fff' },
    { text: '# 2. 沿 u/v 方向重采样为网格控制点', color: '#64748b' },
    { text: 'surf = fitting.approximate_surface(', color: '#86efac' },
    { text: '    points, size_u=80, size_v=60,', color: '#e2e8f0' },
    { text: '    degree_u=3, degree_v=3,', color: '#e2e8f0' },
    { text: '    ctrlpts_size_u=20, ctrlpts_size_v=15,', color: '#fbbf24' },
    { text: ')', color: '#86efac' },
    { text: '', color: '#fff' },
    { text: '# 3. 偏差色谱图导出（mm），> 0.05mm 高亮红色', color: '#64748b' },
    { text: 'surf.delta = 0.01', color: '#e2e8f0' },
    { text: 'surf.vis = VisMPL.VisSurface()', color: '#e2e8f0' },
    { text: 'surf.render(colormap="seismic")', color: '#86efac' },
  ]

  ctx.font = '15px "Cascadia Code", "Consolas", "Menlo", monospace'
  codeLines.forEach((line, i) => {
    ctx.fillStyle = line.color
    ctx.fillText(line.text, 80, 240 + i * 23)
  })

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 18px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('关键参数', 820, 240)

  const params = [
    { name: 'degree_u', val: '3', desc: 'u 方向阶次（一般 3）' },
    { name: 'degree_v', val: '3', desc: 'v 方向阶次（一般 3）' },
    { name: 'ctrlpts_u', val: '20', desc: '控制点数 u（越大越细节）' },
    { name: 'ctrlpts_v', val: '15', desc: '控制点数 v' },
    { name: 'delta', val: '0.01', desc: '采样步长（越小越平滑）' },
  ]
  let py = 280
  params.forEach((p) => {
    ctx.fillStyle = '#1677ff'
    ctx.font = 'bold 16px "Cascadia Code", monospace'
    ctx.fillText(p.name, 820, py)
    ctx.fillStyle = '#fa541c'
    ctx.font = '16px "Cascadia Code", monospace'
    ctx.fillText('= ' + p.val, 970, py)
    ctx.fillStyle = '#64748b'
    ctx.font = '13px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(p.desc, 820, py + 22)
    py += 56
  })

  drawFooter(ctx, w, h, page, total)
}

function drawAccuracyTableSlide(ctx: CanvasRenderingContext2D, w: number, h: number, page: number, total: number) {
  drawPageBg(ctx, w, h)
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 36px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('精度评估与判定标准', 60, 130)
  ctx.fillStyle = '#64748b'
  ctx.font = '16px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('实训中以 ±0.05 mm 为合格阈值；以下是一组真实数据的统计', 60, 162)

  const chartX = 80, chartY = 240, chartW = 560, chartH = 320
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.roundRect(chartX - 16, chartY - 16, chartW + 32, chartH + 80, 12); ctx.fill(); ctx.stroke()

  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(chartX, chartY); ctx.lineTo(chartX, chartY + chartH); ctx.lineTo(chartX + chartW, chartY + chartH); ctx.stroke()

  const data = [
    { label: '-0.10', count: 4 }, { label: '-0.08', count: 9 }, { label: '-0.06', count: 22 },
    { label: '-0.04', count: 45 }, { label: '-0.02', count: 90 }, { label: '0', count: 138 },
    { label: '+0.02', count: 92 }, { label: '+0.04', count: 48 }, { label: '+0.06', count: 24 },
    { label: '+0.08', count: 10 }, { label: '+0.10', count: 5 },
  ]
  const maxCount = Math.max(...data.map(d => d.count))
  const barW = chartW / data.length
  data.forEach((d, i) => {
    const barH = (d.count / maxCount) * (chartH - 20)
    const isGood = Math.abs(parseFloat(d.label)) <= 0.05
    ctx.fillStyle = isGood ? '#52c41a' : '#fa541c'
    ctx.fillRect(chartX + i * barW + 4, chartY + chartH - barH, barW - 8, barH)
    ctx.fillStyle = '#475569'
    ctx.font = '11px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(d.label, chartX + i * barW + barW / 2, chartY + chartH + 18)
    ctx.fillStyle = isGood ? '#52c41a' : '#fa541c'
    ctx.font = 'bold 11px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(String(d.count), chartX + i * barW + barW / 2, chartY + chartH - barH - 6)
    ctx.textAlign = 'left'
  })
  ctx.fillStyle = '#64748b'
  ctx.font = '13px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('偏差区间（mm）', chartX + chartW - 110, chartY + chartH + 38)
  ctx.fillText('点数', chartX - 50, chartY)

  const cardX = 720, cardY = 240, cardW = 480
  const stats = [
    { label: '总点数', val: '487', color: '#1677ff' },
    { label: '合格率 (≤ ±0.05mm)', val: '83.4%', color: '#52c41a' },
    { label: '平均偏差', val: '+0.004 mm', color: '#0f172a' },
    { label: '最大偏差', val: '+0.103 mm', color: '#fa541c' },
    { label: '标准差', val: '0.038 mm', color: '#0f172a' },
  ]
  stats.forEach((s, i) => {
    const y = cardY + i * 70
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#e2e8f0'
    ctx.beginPath(); ctx.roundRect(cardX, y, cardW, 60, 10); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#64748b'
    ctx.font = '14px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(s.label, cardX + 20, y + 24)
    ctx.fillStyle = s.color
    ctx.font = 'bold 24px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(s.val, cardX + cardW - 20, y + 38)
    ctx.textAlign = 'left'
  })

  drawFooter(ctx, w, h, page, total)
}

function drawSummarySlide(ctx: CanvasRenderingContext2D, w: number, h: number, page: number, total: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#0f172a')
  grad.addColorStop(1, '#1e1b4b')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = '#60a5fa'
  ctx.font = '18px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('本节回顾 · Recap', 80, 140)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 48px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('今天我们掌握了什么？', 80, 200)

  const recap = [
    { icon: '🎯', title: '4 步标准流程', desc: '准备 → 采集 → 处理 → 重构' },
    { icon: '🔍', title: '3 类扫描技术', desc: '结构光 / 激光线 / 接触式 的取舍' },
    { icon: '🧮', title: 'NURBS 5 大参数', desc: 'degree / ctrlpts / delta 的影响' },
    { icon: '📊', title: '精度合格阈值', desc: '±0.05mm 内合格率需 ≥ 80%' },
  ]
  const cardW = 540, cardH = 130, gap = 24
  recap.forEach((r, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = 80 + col * (cardW + gap)
    const y = 270 + row * (cardH + gap)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)'
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.22)'
    ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, 14); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.font = '40px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(r.icon, x + 28, y + 78)
    ctx.font = 'bold 20px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(r.title, x + 100, y + 52)
    ctx.fillStyle = '#cbd5e1'
    ctx.font = '15px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(r.desc, x + 100, y + 86)
  })

  ctx.fillStyle = '#94a3b8'
  ctx.font = '14px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('课后作业：选取一件家中物品进行扫描重构，提交点云数据 + 重构曲面 + 精度报告', 80, 620)
  ctx.fillStyle = '#fbbf24'
  ctx.font = 'bold 14px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('截止时间：周日 23:59', 80, 648)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.font = '14px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`第 ${page} / ${total} 页 · 演示完结，欢迎提问 🙋‍♂️`, w - 48, h - 32)
  ctx.textAlign = 'left'
}

onUnmounted(() => {
  publishTimers.forEach(t => clearTimeout(t))
  publishTimers.length = 0
})
</script>

<style scoped lang="scss">
.courseware-upload {
  position: fixed; inset: 0; z-index: 100;
  background: var(--bg-card); display: flex; flex-direction: column;
  animation: slideUp 0.25s ease-out;
}

@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

.panel-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid var(--border);
  h3 { font-size: 17px; font-weight: 700; }
}

.close-btn {
  width: 44px; height: 44px; border-radius: 50%; border: none;
  background: var(--bg-page); color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}

.panel-body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }

.drop-zone {
  border: 3px dashed var(--border); border-radius: 20px;
  padding: 48px 32px; text-align: center; cursor: pointer;
  transition: all 0.2s;
  display: flex; flex-direction: column; align-items: center; gap: 12px;

  &:hover, &.dragging { border-color: var(--primary); background: var(--primary-light); }
  &.dragging { transform: scale(1.01); box-shadow: 0 0 0 4px rgba(22, 119, 255, 0.1); }

  h4 { font-size: 16px; font-weight: 600; color: var(--text-primary); }
  p { font-size: 13px; color: var(--text-secondary); }
  .hint { font-size: 11px; color: var(--text-muted); }
}

.demo-btn-area { text-align: center; margin-top: 12px; }

.demo-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 20px; border: 1px solid var(--border); border-radius: 20px;
  background: var(--bg-page); color: var(--text-secondary); font-size: 13px;
  cursor: pointer; transition: all 0.2s;
  &:hover { border-color: var(--primary); color: var(--primary); }
}

.uploading-area {
  display: flex; align-items: center; justify-content: center; flex: 1;
}

.upload-progress {
  text-align: center;

  .progress-ring {
    position: relative; width: 80px; height: 80px; margin: 0 auto 16px;
    svg { width: 100%; height: 100%; }
    .progress-num {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      font-size: 18px; font-weight: 700; color: var(--primary);
    }
  }
  p { font-size: 14px; color: var(--text-secondary); }
}

.preview-area { display: flex; flex-direction: column; gap: 16px; }

.preview-header {
  display: flex; justify-content: space-between; align-items: center;
  h4 { font-size: 15px; font-weight: 600; }
  .preview-actions { display: flex; gap: 8px; }
}

.action-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 18px; border: none; border-radius: 10px;
  background: var(--primary); color: #fff; font-size: 13px; font-weight: 600;
  cursor: pointer; min-height: 38px; transition: transform 0.12s ease, box-shadow 0.18s ease, opacity 0.18s ease;
  &:disabled { opacity: 0.55; cursor: not-allowed; }
  &.outline { background: var(--bg-page); color: var(--text-primary); border: 1px solid var(--border); }
  &.primary-btn {
    box-shadow: 0 4px 14px -4px rgba(22, 119, 255, 0.45);
    &:not(:disabled):active { transform: scale(0.97); }
    &:not(:disabled):hover { box-shadow: 0 8px 22px -6px rgba(22, 119, 255, 0.55); }
  }
}

.btn-spinner {
  display: inline-block;
  width: 14px; height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
  border-radius: 50%;
  animation: btn-spin 0.7s linear infinite;
}

@keyframes btn-spin {
  from { transform: rotate(0); }
  to { transform: rotate(360deg); }
}

.slides-grid {
  display: flex; gap: 8px; overflow-x: auto; padding: 4px 0;
  -webkit-overflow-scrolling: touch;
}

.slide-thumb {
  position: relative; flex-shrink: 0;
  width: 100px; height: 60px; border-radius: 8px; overflow: hidden;
  border: 2px solid var(--border); cursor: pointer; transition: all 0.2s;

  &.active { border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary-light); }

  img { width: 100%; height: 100%; object-fit: cover; }
  .page-num {
    position: absolute; bottom: 2px; right: 4px;
    font-size: 10px; color: #fff; background: rgba(0,0,0,0.5);
    padding: 1px 5px; border-radius: 4px;
  }
}

.preview-main {
  width: 100%; border-radius: 12px; overflow: hidden;
  border: 1px solid var(--border); background: #000;

  img { width: 100%; display: block; }
}

.publish-overlay {
  position: absolute; inset: 0; z-index: 5;
  display: flex; align-items: center; justify-content: center;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.publish-card {
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  padding: 36px 44px;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 24px 50px -12px rgba(15, 23, 42, 0.35);
  min-width: 260px;
  text-align: center;
}

.publish-loader {
  width: 64px; height: 64px;
  .loader-svg {
    width: 100%; height: 100%;
    animation: loader-spin 1s linear infinite;
  }
}

@keyframes loader-spin {
  from { transform: rotate(0); }
  to { transform: rotate(360deg); }
}

.publish-success {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8px 22px -6px rgba(82, 196, 26, 0.55);
  animation: success-pop 0.36s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes success-pop {
  0% { transform: scale(0.4); opacity: 0; }
  60% { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1); }
}

.publish-title { font-size: 17px; font-weight: 700; color: var(--text-primary); margin: 0; }
.publish-sub { font-size: 13px; color: var(--text-muted, #8a94a6); margin: 0; }

.publish-fade-enter-active { transition: opacity 0.22s ease, backdrop-filter 0.22s ease; }
.publish-fade-leave-active { transition: opacity 0.18s ease, backdrop-filter 0.18s ease; }
.publish-fade-enter-from, .publish-fade-leave-to { opacity: 0; backdrop-filter: blur(0); }
</style>
