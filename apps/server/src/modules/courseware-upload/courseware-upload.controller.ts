import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import QRCode from 'qrcode'
import { CoursewareUploadService } from './courseware-upload.service'
import { ClassroomGateway } from '../classroom/classroom.gateway'

/**
 * 注意：handlers 1 / 2 / 3 是教师平板 REST 流；handler 4 是手机扫到的 HTML 页。
 *
 * 设备到设备 beam 安全模型：
 *  - sessionId 不可猜（randomBytes 32 字母数字）
 *  - 10 分钟 TTL，单次使用
 *  - 一旦 phone 上传成功，session 立即标记 consumed 5s 后 GC
 */
@Controller('courseware-upload')
export class CoursewareUploadController {
  constructor(
    private readonly svc: CoursewareUploadService,
    private readonly classroomGateway: ClassroomGateway,
  ) {}

  /** 教师平板：创建新的上传会话 */
  @Post('sessions')
  async createSession(@Req() req: any) {
    const s = this.svc.createSession()
    const baseUrl = inferPublicBaseUrl(req)
    const uploadPageUrl = `${baseUrl}/api/v1/courseware-upload/page?s=${s.sessionId}`
    // 直接生成 PNG data URL；平板用 <image :src> 一行渲染、不用二次请求
    const qrDataUrl = await QRCode.toDataURL(uploadPageUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: { dark: '#0a0d15', light: '#ffffff' },
    })
    return {
      sessionId: s.sessionId,
      uploadPageUrl,
      qrDataUrl,
      expiresAt: s.expiresAt,
    }
  }

  /** 教师平板：生成上传 QR svg（直接返回 svg 字符串，平板拿来用 v-html 渲染或保存为 image）*/
  @Get('sessions/:sessionId/qr')
  async sessionQr(@Param('sessionId') sessionId: string, @Req() req: any, @Res() res: any) {
    const s = this.svc.peek(sessionId)
    if (!s) {
      res.status(404).type('text/plain').send('Session not found or expired')
      return
    }
    const baseUrl = inferPublicBaseUrl(req)
    const url = `${baseUrl}/api/v1/courseware-upload/page?s=${sessionId}`
    const svg = await QRCode.toString(url, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: { dark: '#0a0d15', light: '#ffffff' },
    })
    res.status(200).setHeader('Cache-Control', 'no-store').type('image/svg+xml').send(svg)
  }

  /** 手机端：扫码后打开的 H5 上传页 */
  @Get('page')
  uploadPage(@Req() req: any, @Res() res: any) {
    const sessionId = String(req?.query?.s || '').trim()
    if (!/^[A-Z0-9]{6}$/.test(sessionId)) {
      res.status(400).type('text/html; charset=utf-8').send(renderErrorPage('链接无效或已过期'))
      return
    }
    const s = this.svc.peek(sessionId)
    if (!s) {
      res.status(404).type('text/html; charset=utf-8').send(renderErrorPage('会话不存在或已过期'))
      return
    }
    res.status(200)
      .setHeader('Cache-Control', 'no-store')
      .type('text/html; charset=utf-8')
      .send(renderUploadPage(sessionId))
  }

  /** 手机端：实际上传文件（multipart，多文件 field 名都叫 'file'） */
  @Post('sessions/:sessionId/files')
  @UseInterceptors(FilesInterceptor('file', 50, { limits: { fileSize: 12 * 1024 * 1024 } }))
  async uploadFiles(
    @Param('sessionId') sessionId: string,
    @UploadedFiles() files: any[],
  ): Promise<{ ok: boolean; message?: string; count?: number }> {
    if (!files || files.length === 0) throw new BadRequestException('未收到文件')
    const session = this.svc.peek(sessionId)
    if (!session) throw new NotFoundException('会话已过期或不存在')

    const slides: Array<{ filename: string; mimetype: string; size: number; dataUrl: string }> = []
    for (const f of files) {
      const v = this.svc.validateFile(f.size, f.mimetype || 'application/octet-stream')
      if (!v.ok) throw new BadRequestException(`文件 "${f.originalname || ''}" ${v.reason}`)
      slides.push({
        filename: f.originalname || 'slide',
        mimetype: f.mimetype || 'application/octet-stream',
        size: f.size,
        dataUrl: this.svc.bufferToDataUrl(f.buffer, f.mimetype || 'application/octet-stream'),
      })
    }

    const consumed = this.svc.markConsumed(sessionId)
    if (!consumed) throw new NotFoundException('会话已过期或不存在')

    const pushed = this.classroomGateway.pushCoursewareUploadFile(sessionId, {
      sessionId,
      slides,
      totalCount: slides.length,
    })
    if (!pushed) {
      return {
        ok: false,
        message: '平板未在监听该会话（可能已断开），请回到平板重新生成二维码',
      }
    }

    return { ok: true, message: '上传成功，请回到平板查看', count: slides.length }
  }
}

function inferPublicBaseUrl(req: any): string {
  const fromHeader = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').trim()
  const proto = String(req?.headers?.['x-forwarded-proto'] || req?.protocol || 'http').trim()
  if (fromHeader) return `${proto}://${fromHeader}`
  return 'http://localhost:3000'
}

function renderErrorPage(msg: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>上传失败</title>
<style>
  body{margin:0;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
    background:linear-gradient(135deg,#fff5f5 0%,#ffeaea 100%);min-height:100vh;
    display:flex;align-items:center;justify-content:center;padding:24px;}
  .card{max-width:420px;padding:32px 28px;background:#fff;border-radius:20px;
    box-shadow:0 12px 32px rgba(0,0,0,.06);text-align:center;}
  h1{font-size:22px;color:#e23d3d;margin:0 0 12px;}
  p{font-size:14px;color:#595959;line-height:1.7;margin:12px 0;}
  .badge{display:inline-block;padding:4px 12px;background:#ffeaea;color:#a23030;
    border-radius:12px;font-size:12px;font-weight:600;}
</style>
</head>
<body>
  <div class="card">
    <span class="badge">课件传送 · 出错</span>
    <h1>${escapeHtml(msg)}</h1>
    <p>请回到教师平板，点击「扫码上传」重新生成二维码后再扫一次。</p>
    <p>二维码 10 分钟过期，且只能使用一次。建议先把课件保存到手机后再选择上传。</p>
  </div>
</body>
</html>`
}

function renderUploadPage(sessionId: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1,maximum-scale=1,user-scalable=no">
<title>课件传送 · 选择文件</title>
<style>
  *{box-sizing:border-box;}
  body{margin:0;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
    background:linear-gradient(135deg,#f0f5ff 0%,#f9f0ff 100%);min-height:100vh;
    display:flex;flex-direction:column;align-items:center;padding:24px 16px;color:#1f2937;}
  .card{max-width:480px;width:100%;padding:24px 20px;background:#fff;border-radius:20px;
    box-shadow:0 12px 32px rgba(0,0,0,.06);}
  .head{display:flex;align-items:center;gap:12px;margin-bottom:20px;}
  .head-icon{width:48px;height:48px;border-radius:12px;background:#f0f5ff;color:#1677ff;
    display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;}
  h1{margin:0;font-size:18px;}
  .sub{margin:2px 0 0;font-size:12px;color:#8c8c8c;}
  .pickers{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0;}
  .pick-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
    padding:18px 8px;background:#fff;border:2px solid #1677ff;color:#1677ff;border-radius:14px;
    font-size:14px;font-weight:600;cursor:pointer;}
  .pick-btn .ico{font-size:22px;}
  .pick-btn.alt{background:#1677ff;color:#fff;border-color:#1677ff;}
  .file-list{margin:12px 0;display:flex;flex-direction:column;gap:8px;max-height:280px;overflow-y:auto;}
  .file-row{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f5f7fa;
    border-radius:10px;}
  .file-row .icon-square{width:36px;height:36px;border-radius:8px;background:#fff;color:#1677ff;
    display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0;}
  .file-row .meta{flex:1;min-width:0;}
  .file-row .name{font-size:13px;font-weight:600;color:#1f2937;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .file-row .desc{font-size:11px;color:#8c8c8c;margin-top:2px;}
  .file-row .del{padding:6px 10px;background:transparent;color:#e23d3d;border:0;
    border-radius:6px;font-size:12px;cursor:pointer;flex-shrink:0;}
  .file-summary{padding:10px 12px;background:#f0f5ff;color:#1677ff;border-radius:10px;
    font-size:13px;font-weight:600;text-align:center;margin-bottom:8px;}
  .btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;
    padding:14px;border:0;border-radius:12px;background:#1677ff;color:#fff;
    font-size:15px;font-weight:600;cursor:pointer;}
  .btn:disabled{opacity:.42;cursor:not-allowed;}
  .actions{display:flex;flex-direction:column;gap:10px;}
  .progress{margin-top:12px;padding:14px;background:#f5f7fa;border-radius:10px;}
  .progress-text{font-size:13px;color:#1f2937;font-weight:600;margin:0 0 8px;}
  .progress-bar{width:100%;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden;}
  .progress-fill{height:100%;background:linear-gradient(90deg,#1677ff,#722ed1);
    transition:width .25s ease;width:0;}
  .hint{margin-top:16px;padding:12px;background:#fffbe6;border-radius:8px;
    font-size:12px;color:#7c4a03;line-height:1.6;}
  .toast{position:fixed;top:24px;left:50%;transform:translateX(-50%);
    padding:10px 18px;border-radius:24px;font-size:14px;font-weight:600;
    box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:99;opacity:0;
    transition:opacity .3s;pointer-events:none;}
  .toast.show{opacity:1;}
  .toast.success{background:#52c41a;color:#fff;}
  .toast.error{background:#e23d3d;color:#fff;}
  .toast.info{background:#1677ff;color:#fff;}
  .session{display:inline-block;margin-top:4px;padding:2px 8px;background:#f0f5ff;
    color:#1677ff;border-radius:6px;font-family:ui-monospace,monospace;font-size:11px;}
  input[type=file]{display:none;}
  .done-card{padding:32px 20px;text-align:center;}
  .done-card .done-icon{width:72px;height:72px;border-radius:50%;background:#f6ffed;color:#52c41a;
    display:flex;align-items:center;justify-content:center;font-size:36px;margin:0 auto 16px;}
  .empty{padding:32px 16px;text-align:center;color:#8c8c8c;font-size:13px;
    border:2px dashed #d1d5db;border-radius:14px;}
</style>
</head>
<body>
  <div id="toast" class="toast"></div>
  <div class="card" id="main">
    <div class="head">
      <div class="head-icon">↑</div>
      <div>
        <h1>课件传送</h1>
        <p class="sub">从手机选择文件发到教师平板 <span class="session">${escapeHtml(sessionId)}</span></p>
      </div>
    </div>

    <div class="pickers">
      <label class="pick-btn" for="fileInputDoc">
        <span class="ico">📄</span>
        <span>选择文件</span>
      </label>
      <label class="pick-btn alt" for="fileInputImage">
        <span class="ico">🖼️</span>
        <span>选择图片</span>
      </label>
    </div>
    <input id="fileInputDoc" type="file" multiple />
    <input id="fileInputImage" type="file" multiple accept="image/*" />

    <div id="empty" class="empty">还没选择文件 · 「选择文件」打开手机文件管理器 · 「选择图片」打开相册/拍照</div>
    <div id="fileSummary" class="file-summary" style="display:none;"></div>
    <div id="fileList" class="file-list"></div>

    <div id="progress" class="progress" style="display:none;">
      <p id="progressText" class="progress-text">准备中…</p>
      <div class="progress-bar"><div id="progressFill" class="progress-fill"></div></div>
    </div>

    <div class="actions">
      <button id="uploadBtn" class="btn" disabled>上传到平板</button>
      <button id="clearBtn" class="btn" style="background:#fff;color:#1677ff;border:2px solid #1677ff;display:none;">清空重选</button>
    </div>

    <div class="hint">
      · 支持：JPG / PNG / WebP / PDF（多页 PDF 会拆成多页课件）<br>
      · 「选择文件」唤起系统文件管理器，可定位手机内已下载的 PDF / 图片<br>
      · 「选择图片」直接拍照或从相册多选<br>
      · 单次最多 50 页，单页最大 10 MB · 二维码 10 分钟有效，仅可使用一次
    </div>
  </div>

  <div class="card done-card" id="done" style="display:none;">
    <div class="done-icon">✓</div>
    <h1 style="font-size:20px;margin:0 0 8px;">上传成功</h1>
    <p style="font-size:14px;color:#6b7280;margin:0 0 4px;" id="doneCount">教师平板已收到，请回到平板继续操作。</p>
    <p style="font-size:12px;color:#9ca3af;margin:16px 0 0;">本页可以关闭。</p>
  </div>
<script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.js"></script>
<script>
(function(){
  var sessionId = ${JSON.stringify(sessionId)};
  var MAX_PER_FILE_BYTES = 10 * 1024 * 1024;
  var MAX_TOTAL_BYTES = 18 * 1024 * 1024;
  var MAX_SLIDES = 50;
  var PDF_RENDER_SCALE = 1.5;
  var PDF_PAGE_FORMAT = 'image/jpeg';
  var PDF_PAGE_QUALITY = 0.85;
  // pdfjs 4.x 配 worker（同 CDN）
  if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.js';
  }

  // \u72b6\u6001\uff1a\u5df2\u51c6\u5907\u4e0a\u4f20\u7684 slides\uff08File / Blob \u90fd\u53ef\uff09
  // \u6bcf\u4e2a\u5143\u7d20\uff1a{ file: Blob, filename: string, originType: string }
  var preparedSlides = [];
  var working = false;

  var docInput = document.getElementById('fileInputDoc');
  var imgInput = document.getElementById('fileInputImage');
  var uploadBtn = document.getElementById('uploadBtn');
  var clearBtn = document.getElementById('clearBtn');
  var listEl = document.getElementById('fileList');
  var emptyEl = document.getElementById('empty');
  var summaryEl = document.getElementById('fileSummary');
  var toastEl = document.getElementById('toast');
  var progressEl = document.getElementById('progress');
  var progressText = document.getElementById('progressText');
  var progressFill = document.getElementById('progressFill');
  var mainCard = document.getElementById('main');
  var doneCard = document.getElementById('done');
  var doneCount = document.getElementById('doneCount');

  function toast(msg, type){
    toastEl.className = 'toast ' + (type || 'info') + ' show';
    toastEl.textContent = msg;
    setTimeout(function(){ toastEl.className = 'toast ' + (type || 'info'); }, 2500);
  }
  function humanSize(n){
    if (n < 1024) return n + ' B';
    if (n < 1024*1024) return (n/1024).toFixed(1) + ' KB';
    return (n/1024/1024).toFixed(2) + ' MB';
  }
  function setProgress(text, percent){
    progressEl.style.display = 'block';
    progressText.textContent = text;
    progressFill.style.width = Math.max(0, Math.min(100, percent)) + '%';
  }
  function hideProgress(){ progressEl.style.display = 'none'; }

  function refreshList(){
    listEl.innerHTML = '';
    if (preparedSlides.length === 0) {
      emptyEl.style.display = 'block';
      summaryEl.style.display = 'none';
      clearBtn.style.display = 'none';
      uploadBtn.disabled = true;
      uploadBtn.textContent = '上传到平板';
      return;
    }
    emptyEl.style.display = 'none';
    summaryEl.style.display = 'block';
    clearBtn.style.display = 'block';
    var totalBytes = preparedSlides.reduce(function(s, x){ return s + x.file.size; }, 0);
    summaryEl.textContent = '已就绪 ' + preparedSlides.length + ' 页 · 总大小 ' + humanSize(totalBytes);
    preparedSlides.forEach(function(slide, idx){
      var row = document.createElement('div');
      row.className = 'file-row';
      var iconClass = slide.originType === 'pdf' ? 'PDF' : (slide.file.type.indexOf('image/') === 0 ? 'IMG' : 'F');
      row.innerHTML =
        '<div class="icon-square">' + iconClass + '</div>' +
        '<div class="meta">' +
          '<div class="name">' + esc(slide.filename) + '</div>' +
          '<div class="desc">' + (slide.file.type || 'unknown') + ' · ' + humanSize(slide.file.size) + '</div>' +
        '</div>' +
        '<button class="del" data-i="' + idx + '">移除</button>';
      listEl.appendChild(row);
    });
    Array.prototype.forEach.call(listEl.querySelectorAll('.del'), function(btn){
      btn.addEventListener('click', function(){
        var i = Number(btn.getAttribute('data-i'));
        preparedSlides.splice(i, 1);
        refreshList();
      });
    });
    uploadBtn.disabled = working;
    uploadBtn.textContent = working ? '上传中…' : ('上传 ' + preparedSlides.length + ' 页到平板');
  }

  function esc(s){
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // \u624b\u673a\u9009\u4e2d\u6587\u4ef6\uff08\u53ef\u80fd\u591a\u4e2a\uff09\uff1a\u9010\u4e2a\u51c6\u5907
  function processFiles(files){
    if (!files || files.length === 0) return;
    working = true;
    refreshList();
    var arr = Array.prototype.slice.call(files);
    var doneCount = 0;
    var totalEstSteps = arr.length; // PDF \u4f1a\u52a8\u6001\u52a0\u6b65\u6570

    function bumpProgress(text){
      doneCount++;
      setProgress(text, (doneCount / totalEstSteps) * 100);
    }

    function next(i){
      if (i >= arr.length) {
        working = false;
        hideProgress();
        refreshList();
        return;
      }
      var f = arr[i];
      var name = (f.name || ('file-' + (i+1))).toLowerCase();
      var isPdf = f.type === 'application/pdf' || /\\.pdf$/.test(name);
      var isImage = (f.type || '').indexOf('image/') === 0 ||
        /\\.(jpe?g|png|webp|gif|bmp)$/.test(name);

      if (isPdf) {
        if (!window.pdfjsLib) {
          toast('PDF 解析库加载失败，请刷新页面重试', 'error');
          working = false;
          hideProgress();
          refreshList();
          return;
        }
        renderPdf(f).then(function(blobs){
          // \u591a\u9875 PDF \u62c6\u6210\u591a\u4e2a slide
          blobs.forEach(function(b, pi){
            if (preparedSlides.length >= MAX_SLIDES) return;
            if (b.size > MAX_PER_FILE_BYTES) {
              toast('PDF 第 ' + (pi+1) + ' 页转图后过大，已跳过', 'error');
              return;
            }
            preparedSlides.push({
              file: b,
              filename: f.name.replace(/\\.pdf$/i, '') + '-p' + (pi+1) + '.jpg',
              originType: 'pdf',
            });
          });
          bumpProgress('已处理 ' + Math.min(doneCount, totalEstSteps) + '/' + totalEstSteps + ' 个文件');
          refreshList();
          next(i+1);
        }).catch(function(err){
          console.error('PDF render failed', err);
          toast('PDF 解析失败：' + (err && err.message || err), 'error');
          working = false;
          hideProgress();
          refreshList();
        });
      } else if (isImage) {
        if (f.size > MAX_PER_FILE_BYTES) {
          toast(f.name + ' 超过 10MB，已跳过', 'error');
        } else if (preparedSlides.length >= MAX_SLIDES) {
          toast('最多 ' + MAX_SLIDES + ' 页，多余的已跳过', 'error');
        } else {
          preparedSlides.push({
            file: f,
            filename: f.name || ('image-' + (i+1)),
            originType: 'image',
          });
        }
        bumpProgress('已处理 ' + Math.min(doneCount, totalEstSteps) + '/' + totalEstSteps + ' 个文件');
        refreshList();
        next(i+1);
      } else {
        toast('不支持的文件类型：' + (f.type || name), 'error');
        bumpProgress('已处理 ' + Math.min(doneCount, totalEstSteps) + '/' + totalEstSteps + ' 个文件');
        next(i+1);
      }
    }
    setProgress('准备中…', 0);
    next(0);
  }

  function renderPdf(file){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(){
        var ab = reader.result;
        try {
          var task = window.pdfjsLib.getDocument({ data: new Uint8Array(ab) });
          task.promise.then(function(pdf){
            var blobs = [];
            var pages = pdf.numPages;
            var pi = 0;
            function nextPage(){
              if (pi >= pages || preparedSlides.length + blobs.length >= MAX_SLIDES) {
                resolve(blobs);
                return;
              }
              pi++;
              pdf.getPage(pi).then(function(page){
                var viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
                var canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                var ctx = canvas.getContext('2d');
                page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function(){
                  canvas.toBlob(function(blob){
                    if (blob) blobs.push(blob);
                    nextPage();
                  }, PDF_PAGE_FORMAT, PDF_PAGE_QUALITY);
                }, reject);
              }, reject);
            }
            nextPage();
          }, reject);
        } catch (e) { reject(e); }
      };
      reader.onerror = function(){ reject(new Error('读取文件失败')); };
      reader.readAsArrayBuffer(file);
    });
  }

  docInput.addEventListener('change', function(){
    processFiles(docInput.files);
    docInput.value = '';
  });
  imgInput.addEventListener('change', function(){
    processFiles(imgInput.files);
    imgInput.value = '';
  });

  clearBtn.addEventListener('click', function(){
    if (working) return;
    preparedSlides = [];
    refreshList();
  });

  uploadBtn.addEventListener('click', function(){
    if (preparedSlides.length === 0 || working) return;
    var totalBytes = preparedSlides.reduce(function(s, x){ return s + x.file.size; }, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      toast('总大小 ' + humanSize(totalBytes) + ' 超过 18MB，请减少页数或降低分辨率', 'error');
      return;
    }
    working = true;
    uploadBtn.disabled = true;
    uploadBtn.textContent = '上传中…';
    setProgress('上传中…', 0);

    var fd = new FormData();
    preparedSlides.forEach(function(slide, idx){
      // \u670d\u52a1\u7aef\u540c\u4e00\u5b57\u6bb5\u540d 'file' \u6536\u591a\u4e2a
      fd.append('file', slide.file, slide.filename);
    });

    var xhr = new XMLHttpRequest();
    xhr.upload.onprogress = function(e){
      if (e.lengthComputable) {
        setProgress('上传中…', (e.loaded / e.total) * 100);
      }
    };
    xhr.onload = function(){
      working = false;
      uploadBtn.disabled = false;
      hideProgress();
      var j = null;
      try { j = JSON.parse(xhr.responseText); } catch(e){}
      if (xhr.status >= 200 && xhr.status < 300 && j && j.ok) {
        mainCard.style.display = 'none';
        doneCard.style.display = 'block';
        doneCount.textContent = '已发送 ' + preparedSlides.length + ' 页到教师平板，请回到平板继续操作。';
      } else {
        toast((j && j.message) || ('HTTP ' + xhr.status), 'error');
        uploadBtn.textContent = '重试上传';
      }
    };
    xhr.onerror = function(){
      working = false;
      uploadBtn.disabled = false;
      hideProgress();
      toast('网络错误', 'error');
      uploadBtn.textContent = '重试上传';
    };
    xhr.open('POST', '/api/v1/courseware-upload/sessions/' + encodeURIComponent(sessionId) + '/files');
    xhr.send(fd);
  });

  refreshList();
})();
</script>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
