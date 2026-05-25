import { Controller, Post, Get, Body, Sse, Req, MessageEvent } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger'
import type { Request } from 'express'
import { Observable } from 'rxjs'
import { AiService, ChatRequest, QuizGenRequest, GradeRequest, InteractiveGenRequest, WhiteboardGenRequest } from './ai.service'
import { LlmService } from './llm/llm.service'

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly llm: LlmService,
  ) {}

  @Get('providers')
  @ApiOperation({ summary: '列出所有 LLM provider 及其模型（供前端 AI 设置面板使用）' })
  listProviders() {
    return { success: true, data: this.llm.listProviders() }
  }

  @Post('chat')
  @ApiOperation({ summary: 'AI对话（支持 body.model 指定 "provider:modelId"，body.apiKey/baseUrl 可选覆盖）' })
  async chat(@Body() body: ChatRequest) {
    const result = await this.aiService.chat(body)
    return { success: true, data: result }
  }

  @Post('quiz/generate')
  @ApiOperation({ summary: 'AI智能出题（同 chat，支持 model/apiKey/baseUrl 覆盖）' })
  async generateQuiz(@Body() body: QuizGenRequest) {
    const result = await this.aiService.generateQuiz(body)
    return { success: true, data: result }
  }

  @Post('grade')
  @ApiOperation({ summary: 'AI批改（同 chat，支持 model/apiKey/baseUrl 覆盖；推荐附 commentPrompt 评分细则）' })
  async grade(@Body() body: GradeRequest) {
    const result = await this.aiService.gradeAnswer(body)
    return { success: true, data: result }
  }

  @Post('generate-interactive')
  @ApiOperation({ summary: 'AI 生成"实践"HTML 交互场景（已做安全清洗，可直接放 iframe）' })
  async generateInteractive(@Body() body: InteractiveGenRequest) {
    const result = await this.aiService.generateInteractive(body)
    return { success: true, data: result }
  }

  @Post('generate-whiteboard')
  @ApiOperation({ summary: 'AI 生成结构化"板书"（含 latex/svg/table/callout，给大屏展示）' })
  async generateWhiteboard(@Body() body: WhiteboardGenRequest) {
    const result = await this.aiService.generateWhiteboard(body)
    return { success: true, data: result }
  }

  /**
   * SSE 流式对话（备选 WS 之外的方案）。
   *
   * 设计参考 OpenMAIC `app/api/chat/route.ts`：
   * - 客户端用 `EventSource` 监听，逐 chunk 收到 `{type:'text_delta', content}`
   * - 完成时 `{type:'done', fullContent}`
   * - 出错时 `{type:'error', message}`
   * - **15 秒心跳** 防止某些代理 / 负载均衡器静默关闭长连接
   * - 客户端断连时通过 `req.on('close')` 主动 abort 上游 LLM 调用
   *
   * 用法（前端）：
   *   const url = '/api/v1/ai/chat-stream?body=' + encodeURIComponent(JSON.stringify({...}))
   *   const es = new EventSource(url)
   *   es.onmessage = ev => { const d = JSON.parse(ev.data); ... }
   *
   * 由于 EventSource 只能 GET，body 通过 query `?body=...` 传入；POST 流式时也可用 fetch+ReadableStream。
   */
  @Post('chat-stream')
  @Sse('chat-stream')
  @ApiExcludeEndpoint()
  chatStreamSse(@Body() body: ChatRequest, @Req() req: Request): Observable<MessageEvent> {
    return new Observable<MessageEvent>(subscriber => {
      const abort = new AbortController()
      let closed = false

      const close = () => {
        if (closed) return
        closed = true
        abort.abort()
        clearInterval(heartbeat)
        subscriber.complete()
      }

      req.on('close', close)

      // 15 秒心跳（OpenMAIC 同款超时阈值）
      const heartbeat = setInterval(() => {
        if (!closed) subscriber.next({ data: { type: 'ping', ts: Date.now() } })
      }, 15_000)

      ;(async () => {
        let fullContent = ''
        try {
          // AbortSignal 透传到 LlmService.chatStream → Vercel AI SDK，客户端断开自动取消上游调用
          for await (const chunk of this.aiService.chatStream({ ...body, signal: abort.signal })) {
            if (closed) return
            fullContent += chunk
            subscriber.next({ data: { type: 'text_delta', content: chunk } })
          }
          if (!closed) {
            subscriber.next({ data: { type: 'done', fullContent } })
            close()
          }
        } catch (err: any) {
          if (closed) return
          subscriber.next({ data: { type: 'error', message: err?.message || 'unknown error' } })
          close()
        }
      })()

      return close
    })
  }
}
