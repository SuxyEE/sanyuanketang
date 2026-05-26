<template>
  <view class="page">
    <view class="header">
      <view class="title-block">
        <text class="course-name">{{ store.courseName }}</text>
        <text class="lesson-title">{{ store.lessonTitle }} · 课堂码 {{ store.roomCode }}</text>
      </view>
      <view class="header-badges">
        <view class="badge" :class="{ danger: !connected }">
          <Icon :name="connected ? 'wifi' : 'wifi-off'" size="xs" />
          <text>{{ connected ? `${store.onlineCount}/${store.totalCount} 在线` : '未连接' }}</text>
        </view>
        <view v-if="store.isRecording" class="badge record">
          <Icon name="radio-tower" size="xs" />
          <text>录制中</text>
        </view>
      </view>
    </view>

    <scroll-view class="body" scroll-y>
      <view class="layout">
        <view class="main-column">
          <view class="card slide-card">
            <view class="card-head">
              <text class="card-title">课件同步</text>
              <view class="courseware-head-actions">
                <Button
                  v-if="store.slides.length > 0"
                  variant="tonal"
                  size="sm"
                  icon-left="notebook"
                  @tap="openAnnotationOverlay"
                >全屏涂画</Button>
                <Button variant="secondary" size="sm" icon-left="sparkles" :loading="isGeneratingCourseware" @tap="generateAiCourseware">AI 生成</Button>
                <Button variant="tonal" size="sm" icon-left="download" @tap="openPanel('courseware')">导入课件</Button>
              </view>
            </view>

            <view class="slide-preview" @tap="openPanel('courseware')">
              <image
                v-if="currentSlideImage"
                class="slide-image"
                :src="currentSlideImage"
                mode="aspectFit"
              />
              <view v-else class="slide-empty">
                <Icon name="file-text" size="2xl" tone="muted" />
                <text class="slide-empty-title">导入或生成课件</text>
                <text class="slide-empty-desc">图片课件会转为跨端可同步格式</text>
              </view>
            </view>

            <view class="slide-controls">
              <button class="round-btn" :disabled="store.currentSlide <= 1" hover-class="round-press" @tap="prevSlide">
                <Icon name="chevron-left" size="lg" />
              </button>
              <view class="slide-count">
                <text class="slide-current">{{ store.currentSlide }}</text>
                <text class="slide-total">/ {{ Math.max(store.totalSlides, 1) }} 页</text>
              </view>
              <button class="round-btn" :disabled="store.currentSlide >= store.totalSlides" hover-class="round-press" @tap="nextSlide">
                <Icon name="chevron-right" size="lg" />
              </button>
            </view>

            <scroll-view v-if="store.slides.length > 0" class="thumb-row" scroll-x>
              <button
                v-for="slide in store.slides"
                :key="slide.index"
                class="thumb"
                :class="{ active: store.currentSlide === slide.index }"
                @tap="gotoSlide(slide.index)"
              >
                <image :src="slide.dataUrl" mode="aspectFill" />
              </button>
            </scroll-view>
          </view>

          <view class="activity-grid">
            <button
              v-for="activity in activities"
              :key="activity.key"
              class="activity-card"
              :class="{ active: activeActivity === activity.key }"
              hover-class="activity-press"
              :style="activeActivity === activity.key ? { borderColor: activity.color, background: activity.bg } : {}"
              @tap="selectActivity(activity.key)"
            >
              <view class="activity-icon" :style="{ color: activity.color }">
                <Icon :name="activity.icon" size="lg" />
              </view>
              <text>{{ activity.label }}</text>
            </button>
          </view>

          <view v-if="store.activeQuiz" class="card status-card">
            <view class="status-left">
              <view class="pulse-dot" :class="{ grading: store.activeQuiz.grading }"></view>
              <view>
                <text class="status-title">{{ store.activeQuiz.grading ? 'AI 批改中' : '测验进行中' }}</text>
                <text class="status-desc">{{ store.activeQuiz.submitted }} / {{ Math.max(store.activeQuiz.total, store.activeQuiz.submitted, 1) }} 已提交</text>
              </view>
            </view>
            <view class="progress-track">
              <view class="progress-fill" :style="{ width: quizProgress + '%' }"></view>
            </view>
            <Button variant="primary" size="sm" @tap="endQuiz">结束测验</Button>
          </view>
        </view>

        <view class="side-column">
          <view class="card monitor-card">
            <view class="card-head">
              <text class="card-title">学情监控</text>
              <view class="mini-badges">
                <text>{{ store.submittedCount }} 提交</text>
                <text>{{ store.handRaisedList.length }} 举手</text>
              </view>
            </view>

            <view v-if="store.handRaisedList.length > 0" class="hand-list">
              <text class="section-label">举手学生</text>
              <view class="hand-tags">
                <view v-for="student in store.handRaisedList" :key="student.id" class="hand-tag">
                  <Icon name="hand" size="xs" tone="warning" />
                  <text>{{ student.name }}</text>
                </view>
              </view>
            </view>

            <view v-if="store.students.length === 0" class="empty">
              <Icon name="users" size="xl" tone="muted" />
              <text>等待学生加入课堂</text>
            </view>
            <view v-else class="student-list">
              <view v-for="student in store.students.slice(0, 24)" :key="student.id" class="student-row">
                <text class="student-name">{{ student.name }}</text>
                <view class="student-track">
                  <view class="student-fill" :class="student.state" :style="{ width: `${student.progress}%` }"></view>
                </view>
                <text class="student-state">{{ stateText(student.state) }}</text>
              </view>
            </view>
          </view>

          <view v-if="store.questions.length > 0" class="card question-card">
            <view class="card-head">
              <text class="card-title">学生提问</text>
              <text class="count-text">{{ store.questions.length }} 条</text>
            </view>
            <view v-for="q in store.questions.slice(0, 4)" :key="q.time" class="question-item">
              <text class="question-meta">{{ q.studentName }} · P{{ q.slideIndex }}</text>
              <text class="question-text">{{ q.text }}</text>
            </view>
          </view>

          <view v-if="store.activeCompete" class="card compete-card">
            <text class="card-title">抢答排行</text>
            <text class="compete-question">{{ store.activeCompete.question }}</text>
            <view v-for="(r, idx) in store.activeCompete.responders.slice(0, 5)" :key="r.studentId" class="rank-row">
              <text class="rank-index">{{ idx + 1 }}</text>
              <text class="rank-name">{{ r.studentName }}</text>
              <text class="rank-time">{{ r.responseTime }}ms</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="control-bar">
      <button class="ctrl-btn" :class="{ active: store.isLocked }" hover-class="ctrl-press" @tap="toggleLock">
        <Icon :name="store.isLocked ? 'unlock' : 'lock'" size="md" />
        <text>{{ store.isLocked ? '解锁' : '锁屏' }}</text>
      </button>
      <button class="ctrl-btn" hover-class="ctrl-press" @tap="openPanel('broadcast')">
        <Icon name="megaphone" size="md" />
        <text>广播</text>
      </button>
      <button class="ctrl-btn" hover-class="ctrl-press" @tap="openPanel('rollcall')">
        <Icon name="user" size="md" />
        <text>点名</text>
      </button>
      <button class="ctrl-btn" hover-class="ctrl-press" @tap="openPanel('ai-settings')">
        <Icon name="zap" size="md" />
        <text>AI</text>
      </button>
      <button class="ctrl-btn danger" hover-class="ctrl-press" @tap="confirmEndLesson">
        <Icon name="stop-circle" size="md" />
        <text>下课</text>
      </button>
    </view>

    <view v-if="showAnnotationOverlay" class="anno-overlay" @touchmove.stop.prevent>
      <view class="anno-header">
        <view class="anno-meta">
          <text class="anno-title">{{ store.lessonTitle || store.courseName || '课堂涂画' }}</text>
          <text class="anno-page">第 {{ store.currentSlide }} / {{ Math.max(store.totalSlides, 1) }} 页</text>
        </view>
        <view class="anno-actions">
          <view class="anno-color-group">
            <button
              v-for="c in ['#facc15', '#ef4444', '#22c55e', '#3b82f6']"
              :key="c"
              class="anno-color"
              :class="{ active: annoColor === c }"
              :style="{ background: c }"
              @tap="annoColor = c as any"
            ></button>
          </view>
          <view class="anno-width-group">
            <button
              v-for="w in [2, 4, 8]"
              :key="w"
              class="anno-width"
              :class="{ active: annoWidth === w }"
              @tap="annoWidth = w as any"
            >
              <view class="anno-width-dot" :style="{ width: (w * 2) + 'rpx', height: (w * 2) + 'rpx' }"></view>
            </button>
          </view>
          <button class="anno-action-btn" hover-class="anno-action-press" @tap="undoLastStroke">
            <Icon name="arrow-left" size="sm" />
            <text>撤销</text>
          </button>
          <button class="anno-action-btn danger" hover-class="anno-action-press" @tap="clearCurrentPageAnnotations">
            <Icon name="stop-circle" size="sm" />
            <text>清空本页</text>
          </button>
          <button class="anno-action-btn" hover-class="anno-action-press" @tap="closeAnnotationOverlay">
            <Icon name="x" size="sm" />
            <text>退出</text>
          </button>
        </view>
      </view>

      <view class="anno-stage">
        <image
          v-if="store.slides[store.currentSlide - 1]"
          class="anno-image"
          :src="store.slides[store.currentSlide - 1].dataUrl"
          mode="aspectFit"
        />
        <canvas
          id="annotation-canvas"
          canvas-id="annotation-canvas"
          class="anno-canvas"
          disable-scroll
          @touchstart="onCanvasTouchStart"
          @touchmove="onCanvasTouchMove"
          @touchend="onCanvasTouchEnd"
          @touchcancel="onCanvasTouchEnd"
        ></canvas>
      </view>

      <view class="anno-footer">
        <button
          class="anno-nav-btn"
          :disabled="store.currentSlide <= 1"
          hover-class="anno-action-press"
          @tap="overlayPrevSlide"
        >
          <Icon name="chevron-left" size="md" />
          <text>上一页</text>
        </button>
        <text class="anno-page-indicator">{{ store.currentSlide }} / {{ Math.max(store.totalSlides, 1) }}</text>
        <button
          class="anno-nav-btn"
          :disabled="store.currentSlide >= store.totalSlides"
          hover-class="anno-action-press"
          @tap="overlayNextSlide"
        >
          <text>下一页</text>
          <Icon name="chevron-right" size="md" />
        </button>
      </view>
    </view>

    <view v-if="quizReport" class="modal-mask" @tap="quizReport = null">
      <view class="modal-card report-card" @tap.stop>
        <view class="modal-head">
          <text class="modal-title">{{ quizReport.title || '测验报告' }}</text>
          <button class="close-btn" @tap="quizReport = null">
            <Icon name="x" size="md" />
          </button>
        </view>
        <scroll-view class="report-body" scroll-y>
          <view v-if="quizReport.randomMode" class="random-mode-badge">
            <text>随机发题 · 题库 {{ quizReport.poolSize }} 题 · 每人 {{ quizReport.perStudentCount }} 题</text>
          </view>
          <view class="review-summary">
            <view class="summary-stat">
              <text class="s-num">{{ quizReport.avgScore }}</text>
              <text>平均分</text>
            </view>
            <view class="summary-stat">
              <text class="s-num">{{ quizReport.maxScore }}</text>
              <text>最高分</text>
            </view>
            <view class="summary-stat">
              <text class="s-num">{{ quizReport.minScore }}</text>
              <text>最低分</text>
            </view>
            <view class="summary-stat">
              <text class="s-num">{{ quizReport.submittedCount }}/{{ quizReport.totalStudents }}</text>
              <text>已提交</text>
            </view>
          </view>

          <view v-if="quizReport.knowledgeMastery && quizReport.knowledgeMastery.length > 0" class="report-block">
            <text class="section-label neutral">知识点掌握度</text>
            <view
              v-for="kp in quizReport.knowledgeMastery"
              :key="kp.knowledgePointName"
              class="kp-row"
            >
              <text class="kp-name">{{ kp.knowledgePointName }}</text>
              <view class="kp-bar">
                <view
                  class="kp-fill"
                  :class="kp.status"
                  :style="{ width: kp.masteryPercent + '%' }"
                ></view>
              </view>
              <text class="kp-pct">{{ kp.masteryPercent }}%</text>
            </view>
          </view>

          <view v-if="quizReport.questionStats && quizReport.questionStats.length > 0" class="report-block">
            <text class="section-label neutral">题目正确率</text>
            <view
              v-for="(qs, idx) in quizReport.questionStats"
              :key="qs.question.id"
              class="kp-row"
            >
              <text class="kp-name">{{ idx + 1 }}. {{ truncate(qs.question.content, 28) }}</text>
              <view class="kp-bar">
                <view class="kp-fill" :style="{ width: qs.correctRate + '%' }"></view>
              </view>
              <text class="kp-pct">{{ qs.correctRate }}%</text>
            </view>
          </view>

          <view v-if="quizReport.submissions && quizReport.submissions.length > 0" class="report-block">
            <text class="section-label neutral">学生答题详情（{{ quizReport.submissions.length }}）</text>
            <view
              v-for="sub in quizReport.submissions"
              :key="sub.studentId"
              class="student-detail-block"
            >
              <view class="submission-row">
                <text class="student-detail-name">{{ sub.studentName }}</text>
                <text :class="(sub.score || 0) >= 80 ? 'ok-text' : 'muted-text'">{{ sub.score || 0 }} 分</text>
              </view>
              <view
                v-for="(qs, idx) in studentQuestions(sub)"
                :key="qs.question.id"
                class="per-q-row"
              >
                <view class="per-q-head">
                  <text class="per-q-idx">{{ idx + 1 }}.</text>
                  <text class="per-q-title">{{ truncate(qs.question.content, 20) }}</text>
                  <text
                    v-if="sub.perQuestion && sub.perQuestion[qs.question.id]"
                    class="per-q-badge"
                    :class="sub.perQuestion[qs.question.id].correct ? 'badge-ok' : 'badge-wrong'"
                  >{{ sub.perQuestion[qs.question.id].correct ? '✓' : '✗' }} {{ sub.perQuestion[qs.question.id].earned ?? sub.perQuestion[qs.question.id].score ?? 0 }}/{{ sub.perQuestion[qs.question.id].points ?? qs.question.points ?? 10 }}</text>
                  <text v-else class="per-q-badge badge-miss">未作答</text>
                </view>
                <view v-if="sub.perQuestion && sub.perQuestion[qs.question.id]?.comment" class="per-q-comment">
                  <text>{{ sub.perQuestion[qs.question.id].comment }}</text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
        <Button block icon-left="check" @tap="quizReport = null">关闭</Button>
      </view>
    </view>

    <view v-if="activePanel" class="modal-mask" @tap="closePanel">
      <view class="modal-card" @tap.stop>
        <view class="modal-head">
          <text class="modal-title">{{ panelTitle }}</text>
          <button class="close-btn" @tap="closePanel">
            <Icon name="x" size="md" />
          </button>
        </view>

        <view v-if="activePanel === 'courseware'" class="form">
          <view class="courseware-choice-grid">
            <button class="courseware-choice" hover-class="activity-press" @tap="chooseSlides">
              <view class="choice-icon primary"><Icon name="download" size="lg" /></view>
              <text class="choice-title">导入图片课件</text>
              <text class="choice-desc">多张图片按页同步到大屏和学生端</text>
            </button>
            <button class="courseware-choice" hover-class="activity-press" @tap="generateAiCourseware">
              <view class="choice-icon accent"><Icon name="sparkles" size="lg" /></view>
              <text class="choice-title">AI 生成课件</text>
              <text class="choice-desc">按当前课题让 AI 生成 6 页针对性演示</text>
            </button>
            <button class="courseware-choice" hover-class="activity-press" @tap="generateDemoCourseware">
              <view class="choice-icon neutral"><Icon name="book-open" size="lg" /></view>
              <text class="choice-title">演示模板课件</text>
              <text class="choice-desc">6 页通用教学模板 · 无需 AI 即可生成</text>
            </button>
          </view>
          <button class="courseware-choice wide" hover-class="activity-press" @tap="chooseDocumentSlides">
            <view class="choice-icon neutral"><Icon name="file-text" size="lg" /></view>
            <view class="choice-copy">
              <text class="choice-title">PDF / PPT 导入</text>
              <text class="choice-desc">H5 可解析 PDF；PPT 和原生 App 建议接后端转换服务</text>
            </view>
          </button>
          <button class="courseware-choice wide highlight" hover-class="activity-press" @tap="openCoursewareScanUpload">
            <view class="choice-icon accent"><Icon name="logo" size="lg" /></view>
            <view class="choice-copy">
              <text class="choice-title">扫码从手机上传</text>
              <text class="choice-desc">老师扫码后在手机相册/文件管理器里选图片或 PDF 发到平板（PDF 自动按页拆开）</text>
            </view>
          </button>
          <view class="hint-box">图片、PDF 和生成课件都会统一发布到大屏与学生端；PPT 请先导出为图片，或下一步接后端转换。</view>
        </view>

        <view v-else-if="activePanel === 'broadcast'" class="form">
          <textarea v-model="broadcastMessage" class="textarea" placeholder="输入要广播给学生端和大屏的内容" />
          <Button block icon-left="send" @tap="sendBroadcast">发送广播</Button>
        </view>

        <view v-else-if="activePanel === 'quiz'" class="form" :class="{ 'quiz-two-col': quizDraft.length > 0 }">
          <view class="quiz-left">
            <view class="segmented">
              <button :class="{ active: quizMode === 'ai' }" @tap="quizMode = 'ai'">AI 生成</button>
              <button :class="{ active: quizMode === 'manual' }" @tap="quizMode = 'manual'">手动出题</button>
            </view>
            <template v-if="quizMode === 'ai'">
              <input v-model="quizTopic" class="input" placeholder="知识点，例如：机械臂坐标系" />
              <view class="option-row">
                <button v-for="d in difficultyOptions" :key="d.value" class="option-card compact" :class="{ active: quizDifficulty === d.value }" @tap="quizDifficulty = d.value">
                  <text>{{ d.label }}</text>
                </button>
              </view>
              <Button block icon-left="sparkles" :loading="isGeneratingQuiz" @tap="generateQuiz">AI 自动出题（生成 20 题题库）</Button>
            </template>
            <template v-else>
              <input v-model="manualQuizTitle" class="input" placeholder="测验标题" />
              <view class="segmented">
                <button v-for="type in questionTypes" :key="type.value" :class="{ active: manualQuestionType === type.value }" @tap="manualQuestionType = type.value">{{ type.label }}</button>
              </view>
              <textarea v-model="manualQuestionStem" class="textarea" placeholder="题目内容" />
              <textarea v-if="manualQuestionType !== 'short_answer' && manualQuestionType !== 'true_false'" v-model="manualQuestionOptions" class="textarea small" placeholder="每行一个选项，例如：&#10;A. 伺服电机&#10;B. 步进电机" />
              <input v-model="manualQuestionAnswer" class="input" :placeholder="manualQuestionType === 'short_answer' ? '参考答案' : '正确答案，例如 A 或 对'" />
              <Button variant="secondary" block icon-left="plus" @tap="addManualQuestion">添加题目</Button>
            </template>
          </view>
          <view v-if="quizDraft.length > 0" class="quiz-right">
            <scroll-view class="quiz-preview-scroll" scroll-y>
              <QuestionPreviewList
                :questions="quizDraft"
                title="题目预览"
                :removable="true"
                @remove="onRemoveQuizDraft"
              />
            </scroll-view>
            <view class="quiz-dispatch-settings">
              <view class="segmented">
                <button :class="{ active: randomQuizMode }" @tap="randomQuizMode = true">随机发题</button>
                <button :class="{ active: !randomQuizMode }" @tap="randomQuizMode = false">统一发题</button>
              </view>
              <view v-if="randomQuizMode" class="option-row">
                <text class="option-label">每人答题数：</text>
                <button v-for="n in perStudentOptions" :key="n" class="option-card compact" :class="{ active: perStudentCount === n }" @tap="perStudentCount = n">
                  <text>{{ n }} 题</text>
                </button>
              </view>
              <text v-if="randomQuizMode" class="hint-text">题库 {{ quizDraft.length }} 题，每人随机抽 {{ perStudentCount }} 题</text>
            </view>
            <Button block icon-left="send" @tap="pushQuizDraft">下发测验</Button>
          </view>
        </view>

        <view v-else-if="activePanel === 'attendance'" class="form">
          <view class="hint-box">学生签到需要拍摄正面照，并在教师当前位置 50 米范围内完成定位校验。</view>
          <view class="option-row">
            <button class="option-card active">
              <Icon name="check-circle" size="lg" tone="success" />
              <text>拍照定位</text>
            </button>
            <button class="option-card">
              <Icon name="user" size="lg" tone="primary" />
              <text>正面照</text>
            </button>
          </view>
          <Button v-if="store.activeAttendance" variant="danger" block icon-left="stop-circle" @tap="endAttendance">结束签到</Button>
          <Button v-else block icon-left="check-circle" :loading="startingAttendance" @tap="startAttendance">开始签到</Button>
          <view v-if="store.attendanceSigned.length > 0" class="attendance-list">
            <view v-for="rec in store.attendanceSigned" :key="rec.studentId" class="attendance-row">
              <image v-if="rec.photo" class="attendance-photo" :src="rec.photo" mode="aspectFill" />
              <view class="attendance-info">
                <text class="attendance-name">{{ rec.studentName }}</text>
                <text class="attendance-meta">
                  {{ rec.verified ? '已校验' : '未校验' }}
                  <template v-if="rec.distance !== undefined"> · {{ Math.round(rec.distance) }} 米</template>
                </text>
              </view>
              <Icon :name="rec.verified ? 'check-circle' : 'alert-circle'" size="md" :tone="rec.verified ? 'success' : 'warning'" />
            </view>
          </view>
        </view>

        <view v-else-if="activePanel === 'compete'" class="form">
          <textarea
            v-model="competeQuestion"
            class="textarea"
            placeholder="输入抢答题目"
            :disabled="!!store.activeCompete"
          />
          <Button
            v-if="store.activeCompete"
            variant="danger"
            block
            icon-left="stop-circle"
            @tap="endCompete"
          >结束抢答</Button>
          <Button v-else block icon-left="trophy" @tap="startCompete">开始抢答</Button>
          <view v-if="store.activeCompete && store.activeCompete.responders.length > 0" class="draft-list">
            <text class="section-label neutral">实时排行（{{ store.activeCompete.responders.length }}）</text>
            <view
              v-for="(r, idx) in store.activeCompete.responders.slice(0, 5)"
              :key="r.studentId"
              class="draft-item"
            >
              <text class="draft-index">{{ idx + 1 }}</text>
              <view class="draft-body">
                <text class="draft-text">{{ r.studentName }}</text>
              </view>
              <text class="rank-time">{{ r.responseTime }}ms</text>
            </view>
          </view>
        </view>

        <view v-else-if="activePanel === 'discuss'" class="form">
          <view v-if="store.activeDiscussion" class="hint-box">
            <text>当前正在进行讨论：{{ store.activeDiscussion.topic || '（未设主题）' }}</text>
          </view>
          <template v-if="!store.activeDiscussion">
            <view class="option-row">
              <button v-for="strategy in groupStrategies" :key="strategy.value" class="option-card" :class="{ active: groupStrategy === strategy.value }" @tap="groupStrategy = strategy.value">
                <Icon :name="strategy.icon" size="lg" tone="primary" />
                <text>{{ strategy.label }}</text>
              </button>
            </view>
            <view class="stepper">
              <button @tap="groupCount = Math.max(2, groupCount - 1)"><Icon name="chevron-left" size="md" /></button>
              <text>{{ groupCount }} 组 · 每组约 {{ perGroupCount }} 人</text>
              <button @tap="groupCount = Math.min(12, groupCount + 1)"><Icon name="chevron-right" size="md" /></button>
            </view>
            <textarea v-model="groupTopic" class="textarea" placeholder="讨论主题" />
            <view class="option-row">
              <button v-for="m in [5, 10, 15, 20, 30]" :key="m" class="option-card compact" :class="{ active: groupDuration === m }" @tap="groupDuration = m">
                <text>{{ m }} 分钟</text>
              </button>
            </view>
          </template>
          <Button
            v-if="store.activeDiscussion"
            variant="danger"
            block
            icon-left="stop-circle"
            @tap="endGroupDiscussion"
          >结束分组讨论</Button>
          <Button v-else block icon-left="users" @tap="startGroupDiscussion">开始分组讨论</Button>
        </view>

        <view v-else-if="activePanel === 'ai'" class="form">
          <input v-model="aiTopic" class="input" placeholder="AI 实践主题" :disabled="!!store.activeAiPractice" />
          <textarea v-model="aiPrompt" class="textarea" placeholder="实践要求或提示词" :disabled="!!store.activeAiPractice" />
          <view v-if="store.activeAiPractice" class="hint-box">
            <text>当前正在进行：{{ store.activeAiPractice.topic }}</text>
          </view>

          <Button
            v-if="store.activeAiPractice"
            variant="danger"
            block
            icon-left="stop-circle"
            @tap="endAiPractice"
          >结束 AI 实践（学生回到课件）</Button>
          <template v-else>
            <Button
              block
              icon-left="sparkles"
              :loading="isGeneratingAiPractice"
              @tap="generateAiPracticePreview"
            >{{ aiPracticePreview ? '重新生成预览' : '生成 AI 实践预览' }}</Button>

            <view v-if="isGeneratingAiPractice" class="gen-progress" role="status" aria-live="polite">
              <view class="gen-progress-bar"><view class="gen-progress-bar-fill" :style="{ width: aiPracticeProgressPercent + '%' }" /></view>
              <text class="gen-progress-text">AI 正在写 HTML… 已生成 {{ aiPracticeGenChars }} 字符</text>
            </view>

            <view v-if="aiPracticePreview" class="preview-card">
              <view class="preview-card-head">
                <text class="preview-card-badge">教师端预览</text>
                <text class="preview-card-title">{{ aiPracticePreview.title || aiPracticePreview.topic || 'AI 实践' }}</text>
              </view>
              <text v-if="aiPracticePreview.description" class="preview-card-subtitle">{{ aiPracticePreview.description }}</text>
              <view class="preview-meta-row">
                <text class="preview-meta-chip">HTML {{ aiPracticeHtmlKb }} KB</text>
                <text
                  v-if="aiPracticePreview.sanitizeStats && (aiPracticePreview.sanitizeStats.removed > 0 || aiPracticePreview.sanitizeStats.warnings > 0)"
                  class="preview-meta-chip warn"
                >已清洗 {{ aiPracticePreview.sanitizeStats.removed || 0 }} 项不安全内容</text>
              </view>
              <text class="preview-hint">提示：在学生平板上点击「打开」即可看到完整交互。如需本地查看 HTML 源码，可在 H5 调试模式下打开浏览器开发者工具。</text>
              <view class="preview-actions">
                <Button block icon-left="send" @tap="pushAiPracticeToStudents">下发到学生端</Button>
                <Button variant="secondary" block icon-left="x" @tap="discardAiPracticePreview">放弃预览</Button>
              </view>
            </view>
          </template>
        </view>

        <view v-else-if="activePanel === 'ai-whiteboard'" class="form">
          <input v-model="whiteboardTopic" class="input" placeholder="板书主题，例如：PLC 梯形图基础" />
          <textarea v-model="whiteboardHint" class="textarea" placeholder="额外说明，例如：需要表格、公式或流程图" />
          <view class="chip-row">
            <button v-for="preset in whiteboardPresets" :key="preset.topic" class="chip" @tap="whiteboardTopic = preset.topic; whiteboardHint = preset.hint">{{ preset.topic }}</button>
          </view>
          <Button block icon-left="sparkles" :loading="isGeneratingWhiteboard" @tap="generateWhiteboard">
            {{ whiteboardPreview ? '重新生成' : '生成板书预览' }}
          </Button>

          <view v-if="isGeneratingWhiteboard" class="gen-progress" role="status" aria-live="polite">
            <view class="gen-progress-bar"><view class="gen-progress-bar-fill" :style="{ width: whiteboardProgressPercent + '%' }" /></view>
            <text class="gen-progress-text">AI 正在写板书… 已生成 {{ whiteboardGenChars }} 字符</text>
          </view>

          <view v-if="whiteboardPreview" class="preview-card">
            <view class="preview-card-head">
              <text class="preview-card-badge">教师端预览</text>
              <text class="preview-card-title">{{ whiteboardPreview.title || whiteboardPreview.topic || '板书' }}</text>
            </view>
            <text v-if="whiteboardPreview.subtitle" class="preview-card-subtitle">{{ whiteboardPreview.subtitle }}</text>
            <view class="preview-items">
              <view
                v-for="(item, idx) in (whiteboardPreview.items || []).slice(0, 6)"
                :key="idx"
                class="preview-item-row"
              >
                <text class="preview-item-bullet">{{ idx + 1 }}</text>
                <text class="preview-item-text">
                  {{ typeof item === 'string' ? item : (item?.text || item?.label || item?.title || JSON.stringify(item).slice(0, 60)) }}
                </text>
              </view>
              <text v-if="(whiteboardPreview.items || []).length > 6" class="preview-item-more">
                …还有 {{ (whiteboardPreview.items || []).length - 6 }} 条
              </text>
            </view>
            <view class="preview-actions">
              <Button block icon-left="send" @tap="pushWhiteboardToScreen">推送到大屏</Button>
              <Button variant="secondary" block icon-left="x" @tap="discardWhiteboardPreview">放弃预览</Button>
            </view>
          </view>

          <Button variant="secondary" block icon-left="x" @tap="hideWhiteboard">关闭大屏板书</Button>
        </view>

        <view v-else-if="activePanel === 'paper'" class="form">
          <view class="segmented">
            <button :class="{ active: homeworkTab === 'create' }" @tap="homeworkTab = 'create'">布置作业</button>
            <button :class="{ active: homeworkTab === 'review' }" @tap="homeworkTab = 'review'">批改作业</button>
          </view>
          <template v-if="homeworkTab === 'create'">
            <input v-model="homeworkTopic" class="input" placeholder="作业知识点，留空则按当前课程" />
            <Button block icon-left="sparkles" :loading="isGeneratingHomework" @tap="generateHomework">AI 生成作业</Button>
            <QuestionPreviewList
              v-if="homeworkDraft.length > 0"
              :questions="homeworkDraft"
              title="作业预览"
              :removable="true"
              @remove="onRemoveHomeworkDraft"
            />
            <input v-model="manualHomeworkTitle" class="input" placeholder="手动作业标题" />
            <textarea v-model="manualHomeworkDesc" class="textarea" placeholder="手动作业要求" />
            <view class="option-row">
              <button v-for="d in deadlineOptions" :key="d.value" class="option-card compact" :class="{ active: homeworkDeadline === d.value }" @tap="homeworkDeadline = d.value">
                <text>{{ d.label }}</text>
              </button>
            </view>
            <Button block icon-left="send" @tap="publishHomework">发布作业到学生端</Button>
          </template>
          <template v-else>
            <view class="review-summary">
              <view class="summary-stat"><text class="s-num">{{ Math.max(store.submittedCount, 0) }}</text><text>已提交</text></view>
              <view class="summary-stat"><text class="s-num">{{ Math.round((store.submittedCount / Math.max(store.totalCount, 1)) * 100) }}%</text><text>提交率</text></view>
              <view class="summary-stat"><text class="s-num">82</text><text>平均分</text></view>
            </view>
            <view v-for="student in store.students.slice(0, 12)" :key="student.id" class="submission-row">
              <text>{{ student.name }}</text>
              <text :class="student.state === 'submitted' ? 'ok-text' : 'muted-text'">{{ student.state === 'submitted' ? 'AI 已批' : '待提交' }}</text>
            </view>
          </template>
        </view>

        <view v-else-if="activePanel === 'report'" class="form">
          <view class="review-summary">
            <view class="summary-stat"><text class="s-num">{{ store.totalCount }}</text><text>学生数</text></view>
            <view class="summary-stat"><text class="s-num">{{ store.onlineCount }}</text><text>在线</text></view>
            <view class="summary-stat"><text class="s-num">{{ store.questions.length }}</text><text>提问</text></view>
            <view class="summary-stat"><text class="s-num">{{ store.handRaisedList.length }}</text><text>举手</text></view>
          </view>

          <Button
            block
            icon-left="sparkles"
            :loading="isGeneratingReport"
            @tap="generateLessonReport"
          >{{ lessonReportContent ? '重新生成 AI 报告' : '生成 AI 详细报告' }}</Button>

          <view v-if="lessonReportContent" class="report-block">
            <text class="section-label neutral">AI 课堂分析（{{ lessonReportContent.length }} 字）</text>
            <scroll-view scroll-y class="report-scroll">
              <rich-text class="md-body" :nodes="renderMarkdown(lessonReportContent)" />
            </scroll-view>
            <view class="report-actions">
              <Button block icon-left="copy" @tap="copyLessonReport">复制完整报告</Button>
              <Button variant="secondary" block icon-left="download" @tap="exportReport">复制概况文本</Button>
            </view>
          </view>
          <view v-else-if="!isGeneratingReport" class="report-block">
            <text class="section-label neutral">课堂提示</text>
            <text class="report-text">{{ reportSuggestion }}</text>
            <Button variant="secondary" block icon-left="download" @tap="exportReport">复制概况文本</Button>
          </view>
        </view>

        <view v-else-if="activePanel === 'ai-settings'" class="form">
          <view class="hint-box">配置只保存在教师平板本机。留空则使用服务端默认 AI 设置。</view>
          <view class="option-row">
            <button v-for="provider in providers" :key="provider.id" class="option-card" :class="{ active: aiProvider === provider.id }" @tap="selectProvider(provider.id)">
              <text>{{ provider.name }}</text>
              <text class="option-desc">{{ provider.requiresApiKey ? '需 Key' : '免配置' }}</text>
            </button>
          </view>
          <input v-model="aiModel" class="input" placeholder="模型，例如 openai:gpt-4.1-mini" />
          <input v-model="aiApiKey" class="input" :password="!showAiKey" placeholder="API Key，留空使用服务端默认" />
          <button class="link-btn" @tap="showAiKey = !showAiKey">{{ showAiKey ? '隐藏 Key' : '显示 Key' }}</button>
          <input v-model="aiBaseUrl" class="input" placeholder="Base URL，可选" />
          <Button variant="secondary" block :loading="loadingProviders" icon-left="download" @tap="loadProviders">刷新模型列表</Button>
          <Button block icon-left="check" @tap="saveAiSettings">保存 AI 设置</Button>
          <Button variant="danger" block icon-left="x" @tap="resetAiSettings">恢复默认</Button>
        </view>

        <view v-else-if="activePanel === 'rollcall'" class="form">
          <view v-if="store.students.length === 0" class="empty compact">
            <text>暂无在线学生</text>
          </view>
          <button
            v-for="student in store.students"
            :key="student.id"
            class="student-pick"
            hover-class="activity-press"
            @tap="rollCall(student)"
          >
            <Icon name="user" size="md" tone="primary" />
            <text>{{ student.name }}</text>
          </button>
        </view>
      </view>
    </view>

    <!-- 手机扫码上传课件 QR Overlay -->
    <view v-if="showCoursewareQr" class="modal-mask" @tap="closeCoursewareScanUpload">
      <view class="modal-card scan-qr-card" @tap.stop>
        <view class="modal-head">
          <text class="modal-title">扫码从手机上传课件</text>
          <button class="close-btn" @tap="closeCoursewareScanUpload">
            <Icon name="x" size="md" />
          </button>
        </view>
        <view class="scan-qr-body">
          <view v-if="coursewareUploadStatus === 'creating'" class="scan-qr-state">
            <view class="scan-qr-spinner"></view>
            <text class="scan-qr-tip">正在生成上传链接…</text>
          </view>
          <view v-else-if="coursewareUploadStatus === 'error'" class="scan-qr-state">
            <view class="scan-qr-err-icon"><Icon name="alert-circle" size="xl" tone="danger" /></view>
            <text class="scan-qr-err-title">生成失败</text>
            <text class="scan-qr-tip">{{ coursewareUploadError || '请重试' }}</text>
            <Button variant="primary" size="md" icon-left="download" @tap="openCoursewareScanUpload">重试</Button>
          </view>
          <view v-else-if="coursewareUploadStatus === 'waiting'" class="scan-qr-state">
            <view class="scan-qr-qrwrap">
              <image v-if="coursewareQrDataUrl" :src="coursewareQrDataUrl" mode="aspectFit" class="scan-qr-img" />
            </view>
            <text class="scan-qr-session">会话号 {{ coursewareUploadSessionId }}</text>
            <text class="scan-qr-tip">用手机扫码打开链接 → 选手机相册或文件管理器中的图片 / PDF 发到平板</text>
            <text class="scan-qr-hint">支持 JPG / PNG / PDF（多页 PDF 自动拆页）· 单次最多 50 页 · 10 分钟有效</text>
          </view>
          <view v-else-if="coursewareUploadStatus === 'received'" class="scan-qr-state">
            <view class="scan-qr-ok-icon"><Icon name="check-circle" size="xl" tone="success" /></view>
            <text class="scan-qr-ok-title">已收到文件</text>
            <text class="scan-qr-tip">{{ coursewareUploadReceivedName || '正在处理…' }}</text>
          </view>
          <view v-else-if="coursewareUploadStatus === 'processing'" class="scan-qr-state">
            <view class="scan-qr-spinner"></view>
            <text class="scan-qr-tip">正在解析课件…</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import Button from '@/components/ui/Button.vue'
import Icon from '@/components/ui/Icon.vue'
import QuestionPreviewList from '@/components/QuestionPreviewList.vue'
import { useMarkdown } from '@/composables/useMarkdown'

const { renderMarkdown } = useMarkdown()
import type { IconName } from '@/icons'
import { useSocket } from '@/sockets/useSocket'
import { useClassroomStore, type StudentInfo } from '@/stores/classroom'
import { RoomEvent } from '@/shared/wsEvents'
import { API_BASE } from '@/shared/config'

type Panel = '' | 'courseware' | 'broadcast' | 'quiz' | 'attendance' | 'compete' | 'ai' | 'rollcall' | 'discuss' | 'paper' | 'report' | 'ai-whiteboard' | 'ai-settings'
type QuizQuestion = {
  id: string
  type: string
  stem?: string
  content?: string
  options?: string[] | { key: string; content: string }[]
  answer?: string | number | string[]
  referenceAnswer?: string
  analysis?: string
  score?: number
  points?: number
  difficulty?: 'easy' | 'medium' | 'hard'
  knowledgePoints?: string[]
  timeLimit?: number
}
type ProviderInfo = {
  id: string
  name: string
  requiresApiKey?: boolean
  models?: { id: string; name: string }[]
}
type SlideItem = { index: number; dataUrl: string }
type GeneratedSlideSpec = {
  kicker: string
  title: string
  subtitle?: string
  accent: string
  blocks: { title: string; body: string; accent?: string }[]
}

const store = useClassroomStore()
const { connected, connect, getSocket, forceDisconnect } = useSocket()
const lessonId = ref('demo-lesson-001')
const activeActivity = ref('')
const activePanel = ref<Panel>('')
const broadcastMessage = ref('')
const quizTopic = ref('')
const competeQuestion = ref('')
const aiTopic = ref('')
const aiPrompt = ref('')
const startingAttendance = ref(false)
const quizMode = ref<'ai' | 'manual'>('ai')
const quizCount = ref(20)
const quizDifficulty = ref('medium')
const perStudentCount = ref(5)
const randomQuizMode = ref(true)
const isGeneratingQuiz = ref(false)
const isGeneratingCourseware = ref(false)
const quizDraft = ref<QuizQuestion[]>([])
const manualQuizTitle = ref('随堂测验')
const manualQuestionType = ref('single_choice')
const manualQuestionStem = ref('')
const manualQuestionOptions = ref('A. \nB. \nC. \nD. ')
const manualQuestionAnswer = ref('')
const groupStrategy = ref('random')
const groupCount = ref(2)
const groupTopic = ref('')
const groupDuration = ref(10)
const whiteboardTopic = ref('')
const whiteboardHint = ref('')
const isGeneratingWhiteboard = ref(false)
const whiteboardGenChars = ref(0)
const whiteboardPreview = ref<{ topic?: string; title?: string; subtitle?: string; items?: any[]; generatedAt?: string } | null>(null)
const isGeneratingAiPractice = ref(false)
const aiPracticeGenChars = ref(0)
const aiPracticePreview = ref<{ topic?: string; title?: string; description?: string; html?: string; sanitizeStats?: any; generatedAt?: string } | null>(null)
const aiPracticeHtmlKb = computed(() => {
  const len = aiPracticePreview.value?.html?.length || 0
  return (len / 1024).toFixed(1)
})

// 生成进度条百分比：用渐近线公式（chars/(chars+target)）让条永远不到 100%，
// 因为「100%」要留给真正收到 done 事件那一刻 → 视觉上不会"卡在 100% 等很久"
function asymptoticPercent(chars: number, target: number): number {
  if (chars <= 0) return 4 // 一开始就给点宽度，避免 0% 看起来没启动
  const ratio = chars / (chars + target)
  return Math.max(4, Math.min(95, Math.round(ratio * 100)))
}
const aiPracticeProgressPercent = computed(() => asymptoticPercent(aiPracticeGenChars.value, 2500))
const whiteboardProgressPercent = computed(() => asymptoticPercent(whiteboardGenChars.value, 1500))
const homeworkTab = ref<'create' | 'review'>('create')
const homeworkTopic = ref('')
const homeworkDraft = ref<QuizQuestion[]>([])
const isGeneratingHomework = ref(false)
const manualHomeworkTitle = ref('')
const manualHomeworkDesc = ref('')
const homeworkDeadline = ref('tomorrow')
const quizReport = ref<any | null>(null)
const lessonReportContent = ref('')
const isGeneratingReport = ref(false)
let reportStreamHandler: ((data: any) => void) | null = null
let reportTimeoutId: ReturnType<typeof setTimeout> | null = null

/* ===== 蒙版涂鸦 / 全屏课件 ===== */
interface AnnoPoint { x: number; y: number }
interface AnnoStroke {
  id: string
  slideIndex: number
  color: string
  width: number
  points: AnnoPoint[]
  createdBy?: string
}

const showAnnotationOverlay = ref(false)
const annoColor = ref<'#facc15' | '#ef4444' | '#22c55e' | '#3b82f6'>('#facc15')
const annoWidth = ref<2 | 4 | 8>(4)
const annoCanvasSize = ref({ width: 1, height: 1 })
/** 已完成笔：按页缓存，渲染时根据当前页过滤 */
const annotationsByPage = new Map<number, AnnoStroke[]>()
/** 正在进行笔：strokeId → stroke，touchend 后会被搬到 annotationsByPage */
const activeStrokesById = new Map<string, AnnoStroke>()
/** 本机正在画的 stroke ID，避免触摸事件混淆 */
const localActiveStrokeId = ref('')

let canvasCtx: UniApp.CanvasContext | null = null
let pendingDrawScheduled = false
let lastPointEmitAt = 0
const POINT_EMIT_INTERVAL_MS = 35

function genStrokeId(): string {
  return `stk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function ensureCanvasCtx(): UniApp.CanvasContext | null {
  if (!canvasCtx) canvasCtx = uni.createCanvasContext('annotation-canvas')
  return canvasCtx
}

function scheduleCanvasFlush() {
  if (pendingDrawScheduled) return
  pendingDrawScheduled = true
  setTimeout(() => {
    pendingDrawScheduled = false
    // 关键：增量绘制必须 draw(true)（reserve=true），否则会清屏只渲染本次新增的 path，
    // 之前所有 segment 就消失了 —— 这是「教师端自己看不到自己画的轨迹」的根因。
    // 整页重绘走 redrawCurrentPage()，那里用 draw(false) 是对的（clear+render all）。
    canvasCtx?.draw(true)
  }, 16)
}

function clearCanvas() {
  const ctx = ensureCanvasCtx()
  if (!ctx) return
  ctx.clearRect(0, 0, annoCanvasSize.value.width, annoCanvasSize.value.height)
  ctx.draw(false)
}

function drawStroke(ctx: UniApp.CanvasContext, stroke: AnnoStroke) {
  if (stroke.points.length === 0) return
  const w = annoCanvasSize.value.width
  const h = annoCanvasSize.value.height
  ctx.setStrokeStyle(stroke.color)
  ctx.setLineWidth(stroke.width)
  ctx.setLineCap('round')
  ctx.setLineJoin('round')
  ctx.beginPath()
  const p0 = stroke.points[0]
  ctx.moveTo(p0.x * w, p0.y * h)
  for (let i = 1; i < stroke.points.length; i++) {
    const p = stroke.points[i]
    ctx.lineTo(p.x * w, p.y * h)
  }
  if (stroke.points.length === 1) {
    ctx.lineTo(p0.x * w + 0.1, p0.y * h + 0.1)
  }
  ctx.stroke()
}

function redrawCurrentPage() {
  const ctx = ensureCanvasCtx()
  if (!ctx) return
  ctx.clearRect(0, 0, annoCanvasSize.value.width, annoCanvasSize.value.height)
  const finished = annotationsByPage.get(store.currentSlide) || []
  finished.forEach(s => drawStroke(ctx, s))
  for (const s of activeStrokesById.values()) {
    if (s.slideIndex === store.currentSlide) drawStroke(ctx, s)
  }
  ctx.draw(false)
}

function appendIncrementalSegment(stroke: AnnoStroke) {
  if (stroke.slideIndex !== store.currentSlide) return
  if (stroke.points.length < 2) {
    // 第一个点：单独画一个点
    const ctx = ensureCanvasCtx()
    if (!ctx) return
    const w = annoCanvasSize.value.width
    const h = annoCanvasSize.value.height
    const p = stroke.points[0]
    ctx.setStrokeStyle(stroke.color)
    ctx.setLineWidth(stroke.width)
    ctx.setLineCap('round')
    ctx.beginPath()
    ctx.moveTo(p.x * w, p.y * h)
    ctx.lineTo(p.x * w + 0.1, p.y * h + 0.1)
    ctx.stroke()
    scheduleCanvasFlush()
    return
  }
  const ctx = ensureCanvasCtx()
  if (!ctx) return
  const w = annoCanvasSize.value.width
  const h = annoCanvasSize.value.height
  const prev = stroke.points[stroke.points.length - 2]
  const cur = stroke.points[stroke.points.length - 1]
  ctx.setStrokeStyle(stroke.color)
  ctx.setLineWidth(stroke.width)
  ctx.setLineCap('round')
  ctx.beginPath()
  ctx.moveTo(prev.x * w, prev.y * h)
  ctx.lineTo(cur.x * w, cur.y * h)
  ctx.stroke()
  scheduleCanvasFlush()
}

function applyServerStrokeStart(data: {
  strokeId: string; slideIndex: number; color: string; width: number; point?: AnnoPoint; createdBy?: string
}) {
  if (!data?.strokeId) return
  // 服务端会把教师本人发出的 stroke:start 也广播回来；本地已经塞过更新的 stroke 了，
  // 不能再 new 一个空壳覆盖回去，否则 touchmove 累积的点会被擦掉、画线视觉断裂。
  if (activeStrokesById.has(data.strokeId)) return
  const stroke: AnnoStroke = {
    id: data.strokeId,
    slideIndex: data.slideIndex,
    color: data.color,
    width: data.width,
    points: data.point ? [data.point] : [],
    createdBy: data.createdBy,
  }
  activeStrokesById.set(stroke.id, stroke)
  if (data.point && stroke.slideIndex === store.currentSlide) appendIncrementalSegment(stroke)
}

function applyServerStrokePoint(data: { strokeId: string; slideIndex: number; point: AnnoPoint }) {
  // 跳过教师本人正在画的笔的 echo，避免本地 touchmove 已经 push 过的点被服务端再 push 一次（重复点 → 画出小尖刺）
  if (data?.strokeId && data.strokeId === localActiveStrokeId.value) return
  const stroke = activeStrokesById.get(data?.strokeId)
  if (!stroke || !data?.point) return
  stroke.points.push(data.point)
  if (stroke.slideIndex === store.currentSlide) appendIncrementalSegment(stroke)
}

function applyServerStrokeEnd(data: { strokeId: string; slideIndex: number }) {
  const stroke = activeStrokesById.get(data?.strokeId)
  if (!stroke) return
  activeStrokesById.delete(stroke.id)
  if (stroke.points.length === 0) return
  const list = annotationsByPage.get(stroke.slideIndex) || []
  list.push(stroke)
  annotationsByPage.set(stroke.slideIndex, list)
}

function applyServerClear(data: { slideIndex: number }) {
  const slideIndex = Number(data?.slideIndex)
  if (slideIndex === -1) {
    annotationsByPage.clear()
    activeStrokesById.clear()
  } else {
    annotationsByPage.delete(slideIndex)
    for (const [id, s] of activeStrokesById.entries()) {
      if (s.slideIndex === slideIndex) activeStrokesById.delete(id)
    }
  }
  if (slideIndex === -1 || slideIndex === store.currentSlide) redrawCurrentPage()
}

function applyServerUndo(data: { slideIndex: number; strokeId?: string }) {
  const list = annotationsByPage.get(data?.slideIndex)
  if (!list || list.length === 0) return
  if (data.strokeId) {
    const idx = list.findIndex(s => s.id === data.strokeId)
    if (idx >= 0) list.splice(idx, 1)
  } else {
    list.pop()
  }
  if (list.length === 0) annotationsByPage.delete(data.slideIndex)
  if (data.slideIndex === store.currentSlide) redrawCurrentPage()
}

function applyServerSnapshot(snapshot?: Record<string, AnnoStroke[]> | null) {
  annotationsByPage.clear()
  activeStrokesById.clear()
  if (!snapshot) return
  for (const [k, list] of Object.entries(snapshot)) {
    const idx = Number(k)
    if (!Array.isArray(list)) continue
    annotationsByPage.set(idx, list.map(s => ({ ...s, points: s.points.slice() })))
  }
}

function onCanvasTouchStart(e: any) {
  if (!showAnnotationOverlay.value) return
  const touch = e?.touches?.[0] || e?.changedTouches?.[0]
  if (!touch) return
  const point = touchToNormalized(touch)
  const strokeId = genStrokeId()
  localActiveStrokeId.value = strokeId
  const stroke: AnnoStroke = {
    id: strokeId,
    slideIndex: store.currentSlide,
    color: annoColor.value,
    width: annoWidth.value,
    points: [point],
  }
  activeStrokesById.set(strokeId, stroke)
  appendIncrementalSegment(stroke)
  lastPointEmitAt = Date.now()
  emit(RoomEvent.AnnotationStrokeStart, {
    strokeId,
    slideIndex: store.currentSlide,
    color: annoColor.value,
    width: annoWidth.value,
    point,
  })
}

function onCanvasTouchMove(e: any) {
  if (!showAnnotationOverlay.value || !localActiveStrokeId.value) return
  const touch = e?.touches?.[0] || e?.changedTouches?.[0]
  if (!touch) return
  const stroke = activeStrokesById.get(localActiveStrokeId.value)
  if (!stroke) return
  const point = touchToNormalized(touch)
  stroke.points.push(point)
  appendIncrementalSegment(stroke)
  const now = Date.now()
  if (now - lastPointEmitAt >= POINT_EMIT_INTERVAL_MS) {
    lastPointEmitAt = now
    emit(RoomEvent.AnnotationStrokePoint, { strokeId: stroke.id, point })
  }
}

function onCanvasTouchEnd() {
  if (!showAnnotationOverlay.value || !localActiveStrokeId.value) return
  const strokeId = localActiveStrokeId.value
  localActiveStrokeId.value = ''
  const stroke = activeStrokesById.get(strokeId)
  if (!stroke) return
  // 最后一个点也补发一次，避免被节流丢掉
  const lastPoint = stroke.points[stroke.points.length - 1]
  if (lastPoint) emit(RoomEvent.AnnotationStrokePoint, { strokeId, point: lastPoint })
  emit(RoomEvent.AnnotationStrokeEnd, { strokeId })
  // 本地把笔搬到完成集合
  activeStrokesById.delete(strokeId)
  const list = annotationsByPage.get(stroke.slideIndex) || []
  list.push(stroke)
  annotationsByPage.set(stroke.slideIndex, list)
}

function touchToNormalized(touch: any): AnnoPoint {
  const x = Number(touch.x ?? touch.clientX ?? 0)
  const y = Number(touch.y ?? touch.clientY ?? 0)
  const w = annoCanvasSize.value.width || 1
  const h = annoCanvasSize.value.height || 1
  return {
    x: Math.max(0, Math.min(1, x / w)),
    y: Math.max(0, Math.min(1, y / h)),
  }
}

function openAnnotationOverlay() {
  if (store.slides.length === 0) {
    toast('请先导入课件')
    return
  }
  showAnnotationOverlay.value = true
  // 等 Overlay 真正渲染出 canvas 后再测量尺寸
  setTimeout(() => measureCanvasAndRedraw(), 60)
}

function closeAnnotationOverlay() {
  showAnnotationOverlay.value = false
  localActiveStrokeId.value = ''
  canvasCtx = null
}

function measureCanvasAndRedraw() {
  uni.createSelectorQuery().in((this as any) ?? undefined)
    .select('#annotation-canvas')
    .boundingClientRect((rect: any) => {
      const r = rect as { width?: number; height?: number } | null
      if (r && r.width && r.height) {
        annoCanvasSize.value = { width: r.width, height: r.height }
      }
      canvasCtx = uni.createCanvasContext('annotation-canvas')
      redrawCurrentPage()
    })
    .exec()
}

function clearCurrentPageAnnotations() {
  emit(RoomEvent.AnnotationClear, { slideIndex: store.currentSlide })
}

function undoLastStroke() {
  emit(RoomEvent.AnnotationUndo, { slideIndex: store.currentSlide })
}

function overlayPrevSlide() {
  if (store.currentSlide > 1) gotoSlide(store.currentSlide - 1)
}
function overlayNextSlide() {
  if (store.currentSlide < store.totalSlides) gotoSlide(store.currentSlide + 1)
}
const providers = ref<ProviderInfo[]>([
  { id: '', name: '服务端默认', requiresApiKey: false },
  { id: 'openai', name: 'OpenAI', requiresApiKey: true },
  { id: 'deepseek', name: 'DeepSeek', requiresApiKey: true },
  { id: 'qwen', name: '通义千问', requiresApiKey: true },
])
const loadingProviders = ref(false)
const aiProvider = ref('')
const aiModel = ref('')
const aiApiKey = ref('')
const aiBaseUrl = ref('')
const showAiKey = ref(false)

const activities: { key: string; icon: IconName; label: string; color: string; bg: string }[] = [
  { key: 'knowledge', icon: 'play', label: '知识讲解', color: '#2f6bff', bg: '#f0f7ff' },
  { key: 'quiz', icon: 'zap', label: '智能出题', color: '#f5a623', bg: '#fff7e0' },
  { key: 'paper', icon: 'file-text', label: '智能作业', color: '#7c4dff', bg: '#f5f0ff' },
  { key: 'discuss', icon: 'users', label: '分组讨论', color: '#20a546', bg: '#e8f9ed' },
  { key: 'attendance', icon: 'check-circle', label: '签到', color: '#20a546', bg: '#e8f9ed' },
  { key: 'compete', icon: 'trophy', label: '抢答', color: '#e23d3d', bg: '#fdecec' },
  { key: 'ai', icon: 'sparkles', label: 'AI 实践', color: '#7c4dff', bg: '#f5f0ff' },
  { key: 'ai-whiteboard', icon: 'notebook', label: 'AI 板书', color: '#7c4dff', bg: '#f5f0ff' },
  { key: 'report', icon: 'bar-chart', label: '分析报告', color: '#eb2f96', bg: '#fff0f6' },
  { key: 'case', icon: 'book-open', label: '案例扩展', color: '#0f8b8d', bg: '#e6fffb' },
]
const questionTypes = [
  { label: '单选', value: 'single_choice' },
  { label: '多选', value: 'multiple_choice' },
  { label: '判断', value: 'true_false' },
  { label: '简答', value: 'short_answer' },
]
const difficultyOptions = [
  { label: '简单', value: 'easy' },
  { label: '中等', value: 'medium' },
  { label: '困难', value: 'hard' },
]
const groupStrategies: { value: string; label: string; icon: IconName }[] = [
  { value: 'random', label: '随机', icon: 'users' },
  { value: 'ability', label: '均衡', icon: 'bar-chart' },
  { value: 'manual', label: '手动', icon: 'user' },
]
const whiteboardPresets = [
  { topic: 'PLC 梯形图基础', hint: '列出基本逻辑符号，并给出一个简单梯形图示意' },
  { topic: '工业机器人坐标系', hint: '对比世界坐标、工具坐标和工件坐标' },
  { topic: '三维建模逆向流程', hint: '用流程图说明扫描、点云处理、建模和验证' },
]
const deadlineOptions = [
  { label: '今天 24:00', value: 'today' },
  { label: '明天 24:00', value: 'tomorrow' },
  { label: '本周日', value: 'week' },
]

const currentSlideImage = computed(() => store.slides[store.currentSlide - 1]?.dataUrl || '')
const perGroupCount = computed(() => store.totalCount > 0 ? Math.ceil(store.totalCount / groupCount.value) : 0)
const quizProgress = computed(() => {
  const quiz = store.activeQuiz
  if (!quiz) return 0
  const total = Math.max(quiz.total, quiz.submitted, 1)
  return Math.min(100, Math.round((quiz.submitted / total) * 100))
})
const panelTitle = computed(() => {
  const titles: Record<Exclude<Panel, ''>, string> = {
    courseware: '导入课件',
    broadcast: '发送广播',
    quiz: '快速测验',
    attendance: '课堂签到',
    compete: '发起抢答',
    ai: 'AI 实践',
    rollcall: '点名',
    discuss: '分组讨论',
    paper: '智能作业',
    report: '课堂报告',
    'ai-whiteboard': 'AI 板书',
    'ai-settings': 'AI 设置',
  }
  return activePanel.value ? titles[activePanel.value] : ''
})
const reportSuggestion = computed(() => {
  if (store.totalCount === 0) return '当前还没有学生加入，建议先展示课堂码并确认学生端连接。'
  if (store.handRaisedList.length > 0) return `有 ${store.handRaisedList.length} 名学生举手，建议先处理共性问题再继续推进。`
  if (store.questions.length > 0) return `学生已提出 ${store.questions.length} 个问题，可在讲解后安排一次集中答疑。`
  return '课堂连接稳定，可以继续推进课件同步、随堂测验或分组讨论。'
})

onLoad((query: any) => {
  lessonId.value = query?.roomCode || 'demo-lesson-001'
  store.roomCode = query?.roomCode || lessonId.value
  if (query?.courseName) store.courseName = decodeURIComponent(query.courseName)
  if (query?.subject) store.lessonTitle = decodeURIComponent(query.subject)
})

/**
 * 仅在本页面首次进入时主动发 lesson:start with resetState=true。
 * 之后的 room:joined 都是断线重连或会话恢复，直接复用服务端已有状态，
 * 避免误清服务端的课件/测验/抢答/签到等。
 */
const hasInitiatedLessonStart = ref(false)

const socketHandlers = {
  onRoomJoined: (data: any) => {
    store.currentSlide = data.currentSlide || 1
    store.totalSlides = data.totalSlides || store.totalSlides
    store.isLocked = !!data.isLocked
    if (data.members) store.updateMembers(data)

    if (!hasInitiatedLessonStart.value) {
      hasInitiatedLessonStart.value = true
      emit(RoomEvent.LessonStart, {
        courseName: store.courseName,
        lessonTitle: store.lessonTitle,
        roomCode: store.roomCode,
        startedAt: new Date().toISOString(),
        resetState: true,
      })
    } else if (data?.lessonMeta) {
      // 重连：同步服务端的 lessonMeta，但不触发 reset
      if (data.lessonMeta.courseName) store.courseName = data.lessonMeta.courseName
      if (data.lessonMeta.lessonTitle) store.lessonTitle = data.lessonMeta.lessonTitle
    }
    // 重连场景：服务端可能仍有进行中的签到，按快照恢复
    if (data?.activeAttendance && data.activeAttendance.active) {
      store.activeAttendance = {
        mode: data.activeAttendance.mode,
        duration: data.activeAttendance.duration,
        startedAt: data.activeAttendance.startedAt,
        requirePhoto: true,
        requireLocation: true,
        radius: 50,
      }
      if (Array.isArray(data.activeAttendance.signed)) {
        store.attendanceSigned = [...data.activeAttendance.signed]
      }
      activeActivity.value = 'attendance'
    } else {
      store.activeAttendance = null
    }
    // 同步服务端持久化的标注快照
    applyServerSnapshot(data?.annotations)
    if (showAnnotationOverlay.value) redrawCurrentPage()
  },
  onLessonStart: (data: { courseName?: string; lessonTitle?: string; roomCode?: string; resetState?: boolean }) => {
    if (data.courseName) store.courseName = data.courseName
    if (data.lessonTitle) store.lessonTitle = data.lessonTitle
    if (data.roomCode) store.roomCode = data.roomCode
    if (data.resetState === false) return
    store.currentSlide = 1
    store.totalSlides = 0
    store.slides = []
    store.isLocked = false
    store.activeQuiz = null
    store.activeCompete = null
    store.activeAttendance = null
    store.activeAiPractice = null
    store.attendanceSigned = []
    store.questions = []
    activeActivity.value = ''
  },
  onMemberUpdate: (data: any) => store.updateMembers(data),
  onHandRaise: (data: { studentId: string; studentName: string }) => {
    store.onHandRaise(data)
    toast(`${data.studentName} 举手了`, 'none')
  },
  onHandLower: (data: { studentId: string }) => store.onHandLower(data),
  onAnswerSubmitted: (data: any) => store.onAnswerSubmitted(data),
  onQuestionNew: (data: any) => {
    store.addQuestion({
      studentId: data.studentId,
      studentName: data.studentName,
      text: data.text,
      slideIndex: data.slideIndex || store.currentSlide,
      time: data.time || new Date().toISOString(),
    })
  },
  onSlidesLoaded: (data: { slides: any[]; total: number }) => {
    store.slides = data.slides || []
    store.totalSlides = data.total || store.slides.length
  },
  onSlideGoto: (data: { index: number; total: number }) => {
    store.currentSlide = data.index || 1
    store.totalSlides = data.total || store.totalSlides
    if (showAnnotationOverlay.value) {
      setTimeout(() => redrawCurrentPage(), 30)
    }
  },
  onAnnotationStrokeStart: applyServerStrokeStart,
  onAnnotationStrokePoint: applyServerStrokePoint,
  onAnnotationStrokeEnd: applyServerStrokeEnd,
  onAnnotationClear: applyServerClear,
  onAnnotationUndo: applyServerUndo,
  onQuizStart: (task: any) => {
    activeActivity.value = 'quiz'
    store.activeQuiz = {
      taskId: task.id || task.taskId || 'pending',
      submitted: 0,
      total: task.totalStudents || store.totalCount,
      grading: false,
    }
  },
  onQuizProgress: (data: { taskId: string; submittedCount: number; totalStudents: number }) => {
    store.activeQuiz = {
      taskId: data.taskId,
      submitted: data.submittedCount,
      total: data.totalStudents,
      grading: store.activeQuiz?.grading || false,
    }
  },
  onQuizGrading: () => {
    if (store.activeQuiz) store.activeQuiz.grading = true
  },
  onQuizReport: (report: any) => {
    store.activeQuiz = null
    activeActivity.value = ''
    quizReport.value = report
    toast(`测验报告已生成，平均 ${report?.avgScore ?? 0} 分`, 'success')
  },
  onQuizStop: () => {
    store.activeQuiz = null
    activeActivity.value = ''
  },
  onAiQuizGen: (result: any) => {
    isGeneratingQuiz.value = false
    isGeneratingHomework.value = false
    const questions = normalizeQuestions(result?.questions || [])
    if (questions.length === 0) {
      toast('AI 未返回有效题目')
      return
    }
    if (activePanel.value === 'paper') {
      homeworkDraft.value = questions
      toast(`已生成 ${questions.length} 道作业题`, 'success')
    } else {
      quizDraft.value = questions
      toast(`已生成 ${questions.length} 道测验题`, 'success')
    }
  },
  onAttendanceSigned: (data: any) => {
    if (!store.attendanceSigned.find((s) => s.studentId === data.studentId)) {
      store.attendanceSigned.push({
        studentId: data.studentId,
        studentName: data.studentName,
        time: data.time || new Date().toISOString(),
        photo: data.photo,
        location: data.location,
        distance: data.distance,
        verified: data.verified,
      })
    }
  },
  onAttendanceStart: (data: {
    mode: string
    duration: number
    startedAt?: number
    requirePhoto?: boolean
    requireLocation?: boolean
    radius?: number
    teacherLocation?: { latitude: number; longitude: number }
  }) => {
    store.activeAttendance = {
      mode: data.mode,
      duration: data.duration,
      startedAt: data.startedAt || Date.now(),
      requirePhoto: data.requirePhoto,
      requireLocation: data.requireLocation,
      radius: data.radius,
      teacherLocation: data.teacherLocation,
    }
    activeActivity.value = 'attendance'
  },
  onAttendanceEnd: () => {
    store.activeAttendance = null
    if (activeActivity.value === 'attendance') activeActivity.value = ''
    startingAttendance.value = false
  },
  onAttendanceStartError: (data: { message?: string }) => {
    startingAttendance.value = false
    store.activeAttendance = null
    if (activeActivity.value === 'attendance') activeActivity.value = ''
    toast(data?.message || '签到开启失败')
  },
  onAiPracticeStartError: (data: { message?: string }) => {
    if (activeActivity.value === 'ai') activeActivity.value = ''
    store.activeAiPractice = null
    toast(data?.message || 'AI 实践开启失败')
  },
  onBroadcastMsg: (data: { message: string; from?: string }) => {
    const prefix = data?.from ? `${data.from}：` : ''
    toast(`${prefix}${data?.message || ''}`)
  },
  onCompeteStart: (data: { question: string }) => {
    activeActivity.value = 'compete'
    store.activeCompete = { question: data.question, responders: [] }
  },
  onCompeteAnswer: (data: { studentId: string; studentName: string; responseTime: number }) => {
    if (!store.activeCompete) return
    if (store.activeCompete.responders.find((r) => r.studentId === data.studentId)) return
    store.activeCompete.responders.push(data)
    store.activeCompete.responders.sort((a, b) => a.responseTime - b.responseTime)
  },
  onCompeteStop: (data: { winner?: any; ranking?: any[] } = {}) => {
    activeActivity.value = ''
    if (store.activeCompete && Array.isArray(data?.ranking) && data.ranking.length > 0) {
      store.activeCompete.responders = data.ranking.map((r: any) => ({
        studentId: r.studentId,
        studentName: r.studentName,
        responseTime: r.responseTime,
      }))
    }
    setTimeout(() => { store.activeCompete = null }, 6000)
  },
  onAiPracticeStart: (data: { topic: string; prompt?: string; startedAt?: string }) => {
    activeActivity.value = 'ai'
    store.activeAiPractice = {
      topic: data.topic,
      prompt: data.prompt,
      startedAt: data.startedAt || new Date().toISOString(),
    }
  },
  onAiPracticeEnd: () => {
    if (activeActivity.value === 'ai') activeActivity.value = ''
    store.activeAiPractice = null
  },
  onGroupCreate: (data: { groups?: any[]; topic?: string; duration?: number; strategy?: string }) => {
    if (data?.groups && data.groups.length > 0) {
      activeActivity.value = 'discuss'
      store.activeDiscussion = {
        topic: data.topic || '',
        duration: data.duration || 0,
        startedAt: Date.now(),
        strategy: data.strategy || 'random',
        groupCount: data.groups.length,
      }
    }
  },
  onGroupDissolve: () => {
    if (activeActivity.value === 'discuss') activeActivity.value = ''
    store.activeDiscussion = null
  },
  onWhiteboardGen: (result: any) => {
    isGeneratingWhiteboard.value = false
    whiteboardGenChars.value = 0
    if (result?.error) {
      whiteboardPreview.value = null
      toast(result.error)
      return
    }
    whiteboardPreview.value = result
    toast('板书预览已生成，请检查后推送大屏', 'success')
  },
  onWhiteboardGenProgress: (data: { totalChars: number; done: boolean }) => {
    if (!isGeneratingWhiteboard.value) return
    whiteboardGenChars.value = Math.max(whiteboardGenChars.value, data?.totalChars || 0)
  },
  onInteractiveGen: (result: any) => {
    isGeneratingAiPractice.value = false
    aiPracticeGenChars.value = 0
    if (result?.error) {
      aiPracticePreview.value = null
      toast(result.error)
      return
    }
    aiPracticePreview.value = result
    toast('AI 实践预览已生成，请检查后推送给学生', 'success')
  },
  onInteractiveGenProgress: (data: { totalChars: number; done: boolean }) => {
    if (!isGeneratingAiPractice.value) return
    aiPracticeGenChars.value = Math.max(aiPracticeGenChars.value, data?.totalChars || 0)
  },
  onScreenLock: () => { store.isLocked = true },
  onScreenUnlock: () => { store.isLocked = false },
  onLessonEnd: () => store.resetLesson(),
  onError: (data: { code?: string; message?: string }) => {
    if (data?.code) return
    toast(data?.message || '操作失败', 'none')
  },
  onJoinError: (data: { message?: string }) => {
    toast(data?.message || '加入课堂失败，请先扫码接管大屏', 'none')
    setTimeout(() => uni.redirectTo({ url: '/pages/course-select/index' }), 900)
  },
}

onMounted(() => {
  loadLocalAiSettings()
  const s = connect({ lessonId: lessonId.value, userId: 'teacher-001', userName: '教师' })
  s.on(RoomEvent.Joined, socketHandlers.onRoomJoined)
  s.on(RoomEvent.MemberUpdate, socketHandlers.onMemberUpdate)
  s.on(RoomEvent.HandRaise, socketHandlers.onHandRaise)
  s.on(RoomEvent.HandLower, socketHandlers.onHandLower)
  s.on(RoomEvent.AnswerSubmitted, socketHandlers.onAnswerSubmitted)
  s.on(RoomEvent.QuestionNew, socketHandlers.onQuestionNew)
  s.on(RoomEvent.SlidesLoaded, socketHandlers.onSlidesLoaded)
  s.on(RoomEvent.SlideGoto, socketHandlers.onSlideGoto)
  s.on(RoomEvent.AnnotationStrokeStart, socketHandlers.onAnnotationStrokeStart)
  s.on(RoomEvent.AnnotationStrokePoint, socketHandlers.onAnnotationStrokePoint)
  s.on(RoomEvent.AnnotationStrokeEnd, socketHandlers.onAnnotationStrokeEnd)
  s.on(RoomEvent.AnnotationClear, socketHandlers.onAnnotationClear)
  s.on(RoomEvent.AnnotationUndo, socketHandlers.onAnnotationUndo)
  s.on(RoomEvent.QuizStart, socketHandlers.onQuizStart)
  s.on(RoomEvent.QuizProgress, socketHandlers.onQuizProgress)
  s.on(RoomEvent.QuizGrading, socketHandlers.onQuizGrading)
  s.on(RoomEvent.QuizReport, socketHandlers.onQuizReport)
  s.on(RoomEvent.QuizStop, socketHandlers.onQuizStop)
  s.on(RoomEvent.AiQuizGen, socketHandlers.onAiQuizGen)
  s.on(RoomEvent.AttendanceSigned, socketHandlers.onAttendanceSigned)
  s.on(RoomEvent.AttendanceStart, socketHandlers.onAttendanceStart)
  s.on(RoomEvent.AttendanceEnd, socketHandlers.onAttendanceEnd)
  s.on(RoomEvent.AttendanceStartError, socketHandlers.onAttendanceStartError)
  s.on(RoomEvent.AiPracticeStartError, socketHandlers.onAiPracticeStartError)
  s.on(RoomEvent.BroadcastMsg, socketHandlers.onBroadcastMsg)
  s.on(RoomEvent.CompeteStart, socketHandlers.onCompeteStart)
  s.on(RoomEvent.CompeteAnswer, socketHandlers.onCompeteAnswer)
  s.on(RoomEvent.CompeteStop, socketHandlers.onCompeteStop)
  s.on(RoomEvent.AiPracticeStart, socketHandlers.onAiPracticeStart)
  s.on(RoomEvent.AiPracticeEnd, socketHandlers.onAiPracticeEnd)
  s.on(RoomEvent.GroupCreate, socketHandlers.onGroupCreate)
  s.on(RoomEvent.GroupDissolve, socketHandlers.onGroupDissolve)
  s.on(RoomEvent.AiWhiteboardGen, socketHandlers.onWhiteboardGen)
  s.on(RoomEvent.AiWhiteboardGenProgress, socketHandlers.onWhiteboardGenProgress)
  s.on(RoomEvent.AiInteractiveGen, socketHandlers.onInteractiveGen)
  s.on(RoomEvent.AiInteractiveGenProgress, socketHandlers.onInteractiveGenProgress)
  s.on(RoomEvent.ScreenLock, socketHandlers.onScreenLock)
  s.on(RoomEvent.ScreenUnlock, socketHandlers.onScreenUnlock)
  s.on(RoomEvent.LessonStart, socketHandlers.onLessonStart)
  s.on(RoomEvent.LessonEnd, socketHandlers.onLessonEnd)
  s.on(RoomEvent.CoursewareUploadFile, onCoursewareUploadFile)
  s.on(RoomEvent.TaskPushError, socketHandlers.onError)
  s.on(RoomEvent.QuizStartError, socketHandlers.onError)
  s.on(RoomEvent.JoinError, socketHandlers.onJoinError)
  s.on(RoomEvent.ErrorPermission, socketHandlers.onError)
})

onUnmounted(() => {
  cancelLessonReportGen()
  const s = getSocket()
  if (!s) return
  s.off(RoomEvent.Joined, socketHandlers.onRoomJoined)
  s.off(RoomEvent.MemberUpdate, socketHandlers.onMemberUpdate)
  s.off(RoomEvent.HandRaise, socketHandlers.onHandRaise)
  s.off(RoomEvent.HandLower, socketHandlers.onHandLower)
  s.off(RoomEvent.AnswerSubmitted, socketHandlers.onAnswerSubmitted)
  s.off(RoomEvent.QuestionNew, socketHandlers.onQuestionNew)
  s.off(RoomEvent.SlidesLoaded, socketHandlers.onSlidesLoaded)
  s.off(RoomEvent.SlideGoto, socketHandlers.onSlideGoto)
  s.off(RoomEvent.AnnotationStrokeStart, socketHandlers.onAnnotationStrokeStart)
  s.off(RoomEvent.AnnotationStrokePoint, socketHandlers.onAnnotationStrokePoint)
  s.off(RoomEvent.AnnotationStrokeEnd, socketHandlers.onAnnotationStrokeEnd)
  s.off(RoomEvent.AnnotationClear, socketHandlers.onAnnotationClear)
  s.off(RoomEvent.AnnotationUndo, socketHandlers.onAnnotationUndo)
  s.off(RoomEvent.QuizStart, socketHandlers.onQuizStart)
  s.off(RoomEvent.QuizProgress, socketHandlers.onQuizProgress)
  s.off(RoomEvent.QuizGrading, socketHandlers.onQuizGrading)
  s.off(RoomEvent.QuizReport, socketHandlers.onQuizReport)
  s.off(RoomEvent.QuizStop, socketHandlers.onQuizStop)
  s.off(RoomEvent.AiQuizGen, socketHandlers.onAiQuizGen)
  s.off(RoomEvent.AttendanceSigned, socketHandlers.onAttendanceSigned)
  s.off(RoomEvent.AttendanceStart, socketHandlers.onAttendanceStart)
  s.off(RoomEvent.AttendanceEnd, socketHandlers.onAttendanceEnd)
  s.off(RoomEvent.AttendanceStartError, socketHandlers.onAttendanceStartError)
  s.off(RoomEvent.AiPracticeStartError, socketHandlers.onAiPracticeStartError)
  s.off(RoomEvent.BroadcastMsg, socketHandlers.onBroadcastMsg)
  s.off(RoomEvent.CompeteStart, socketHandlers.onCompeteStart)
  s.off(RoomEvent.CompeteAnswer, socketHandlers.onCompeteAnswer)
  s.off(RoomEvent.CompeteStop, socketHandlers.onCompeteStop)
  s.off(RoomEvent.AiPracticeStart, socketHandlers.onAiPracticeStart)
  s.off(RoomEvent.AiPracticeEnd, socketHandlers.onAiPracticeEnd)
  s.off(RoomEvent.GroupCreate, socketHandlers.onGroupCreate)
  s.off(RoomEvent.GroupDissolve, socketHandlers.onGroupDissolve)
  s.off(RoomEvent.AiWhiteboardGen, socketHandlers.onWhiteboardGen)
  s.off(RoomEvent.AiWhiteboardGenProgress, socketHandlers.onWhiteboardGenProgress)
  s.off(RoomEvent.AiInteractiveGen, socketHandlers.onInteractiveGen)
  s.off(RoomEvent.AiInteractiveGenProgress, socketHandlers.onInteractiveGenProgress)
  s.off(RoomEvent.ScreenLock, socketHandlers.onScreenLock)
  s.off(RoomEvent.ScreenUnlock, socketHandlers.onScreenUnlock)
  s.off(RoomEvent.LessonStart, socketHandlers.onLessonStart)
  s.off(RoomEvent.LessonEnd, socketHandlers.onLessonEnd)
  s.off(RoomEvent.CoursewareUploadFile, onCoursewareUploadFile)
  s.off(RoomEvent.TaskPushError, socketHandlers.onError)
  s.off(RoomEvent.QuizStartError, socketHandlers.onError)
  s.off(RoomEvent.JoinError, socketHandlers.onJoinError)
  s.off(RoomEvent.ErrorPermission, socketHandlers.onError)
})

function emit(event: string, payload?: any) {
  const socket = getSocket()
  if (!socket) {
    toast('课堂未连接，请返回重进')
    return false
  }
  socket.emit(event, payload)
  return true
}

function toast(title: string, icon: 'success' | 'none' = 'none') {
  uni.showToast({ title, icon, duration: 1800 })
}

function publishSlides(slides: SlideItem[], successText: string) {
  if (slides.length === 0) {
    toast('课件为空')
    return
  }
  store.slides = slides
  store.currentSlide = 1
  store.totalSlides = slides.length
  emit(RoomEvent.SlidesUpload, { slides })
  emit(RoomEvent.SlideGoto, { index: 1, total: slides.length })
  closePanel()
  toast(successText, 'success')
}

function chooseSlides() {
  uni.chooseImage({
    count: 12,
    sizeType: ['original', 'compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const paths = Array.isArray(res.tempFilePaths)
        ? res.tempFilePaths
        : res.tempFilePaths
          ? [res.tempFilePaths]
          : []
      if (paths.length === 0) return

      uni.showLoading({ title: '处理课件图片' })
      try {
        const dataUrls = await Promise.all(paths.map((path) => readImagePathAsDataUrl(path)))
        const slides = dataUrls
          .filter(Boolean)
          .map((dataUrl, idx) => ({ index: idx + 1, dataUrl }))
        const hasLocalFallback = slides.some((slide, idx) => slide.dataUrl === paths[idx])
        publishSlides(slides, hasLocalFallback ? '已导入，部分图片可能仅本机可见' : '课件已导入')
      } catch (err) {
        console.error('Choose slides failed:', err)
        toast('图片处理失败，请重试')
      } finally {
        uni.hideLoading()
      }
    },
  })
}

function chooseDocumentSlides() {
  // #ifndef H5
  showDocumentImportHint()
  return
  // #endif
  // #ifdef H5
  if (typeof document === 'undefined') {
    showDocumentImportHint()
    return
  }

  const chooseFile = (uni as any).chooseFile
  if (typeof chooseFile !== 'function') {
    showDocumentImportHint()
    return
  }

  chooseFile({
    count: 1,
    type: 'all',
    extension: ['.pdf', '.ppt', '.pptx'],
    success: async (res: any) => {
      const files = Array.isArray(res?.tempFiles) ? res.tempFiles : []
      const file = files[0]
      const path = file?.path || (Array.isArray(res?.tempFilePaths) ? res.tempFilePaths[0] : '')
      const name = String(file?.name || path || '').toLowerCase()
      if (!name.endsWith('.pdf')) {
        showDocumentImportHint()
        return
      }

      uni.showLoading({ title: '解析 PDF' })
      try {
        const buffer = await readDocumentAsArrayBuffer(file, path)
        const slides = await renderPdfToSlides(buffer)
        publishSlides(slides, `PDF 已导入（${slides.length} 页）`)
      } catch (err) {
        console.error('PDF import failed:', err)
        toast('PDF 解析失败，请重试')
      } finally {
        uni.hideLoading()
      }
    },
  })
  // #endif
}

/* ===== 手机扫码上传课件（QR beam）===== */

const showCoursewareQr = ref(false)
const coursewareUploadSessionId = ref('')
const coursewareQrDataUrl = ref('')
const coursewareUploadStatus = ref<'idle' | 'creating' | 'waiting' | 'received' | 'processing' | 'error'>('idle')
const coursewareUploadError = ref('')
const coursewareUploadReceivedName = ref('')

function openCoursewareScanUpload() {
  // 先关闭课件面板，避免两个 modal-mask 堆叠
  closePanel()
  showCoursewareQr.value = true
  coursewareUploadStatus.value = 'creating'
  coursewareUploadError.value = ''
  coursewareUploadReceivedName.value = ''
  coursewareUploadSessionId.value = ''
  coursewareQrDataUrl.value = ''

  uni.request({
    url: `${API_BASE}/courseware-upload/sessions`,
    method: 'POST',
    timeout: 8000,
    success: (res: any) => {
      const data = res?.data || {}
      if (res?.statusCode !== 200 && res?.statusCode !== 201) {
        coursewareUploadStatus.value = 'error'
        coursewareUploadError.value = `服务端返回 ${res?.statusCode}`
        return
      }
      if (!data.sessionId || !data.qrDataUrl) {
        coursewareUploadStatus.value = 'error'
        coursewareUploadError.value = '服务端响应缺字段'
        return
      }
      coursewareUploadSessionId.value = data.sessionId
      coursewareQrDataUrl.value = data.qrDataUrl
      coursewareUploadStatus.value = 'waiting'
      // 订阅 WS 等手机推文件回来
      const s = getSocket()
      s?.emit(RoomEvent.CoursewareUploadSubscribe, { sessionId: data.sessionId })
    },
    fail: (err: any) => {
      console.error('[courseware-upload] create session failed', err)
      coursewareUploadStatus.value = 'error'
      coursewareUploadError.value = err?.errMsg || '网络错误'
    },
  })
}

function closeCoursewareScanUpload() {
  // 主动告诉服务端取消订阅（避免 stale）
  if (coursewareUploadSessionId.value && coursewareUploadStatus.value === 'waiting') {
    const s = getSocket()
    s?.emit(RoomEvent.CoursewareUploadUnsubscribe, { sessionId: coursewareUploadSessionId.value })
  }
  showCoursewareQr.value = false
  coursewareUploadStatus.value = 'idle'
  coursewareUploadSessionId.value = ''
  coursewareQrDataUrl.value = ''
  coursewareUploadError.value = ''
  coursewareUploadReceivedName.value = ''
}

async function onCoursewareUploadFile(payload: {
  sessionId: string
  slides: Array<{ filename: string; mimetype: string; size: number; dataUrl: string }>
  totalCount: number
}) {
  if (!payload?.slides?.length || payload.sessionId !== coursewareUploadSessionId.value) return
  coursewareUploadStatus.value = 'received'
  const first = payload.slides[0]
  coursewareUploadReceivedName.value = payload.totalCount > 1
    ? `已收到 ${payload.totalCount} 页课件`
    : (first?.filename || '已收到课件')

  setTimeout(() => {
    coursewareUploadStatus.value = 'processing'
    try {
      // 手机端已经把 PDF 转成图片 + 多文件直传，平板这里直接平铺成 slide 列表
      const slides: SlideItem[] = payload.slides.map((s, i) => ({
        index: i + 1,
        dataUrl: s.dataUrl,
      }))
      const totalBytes = payload.slides.reduce((s, x) => s + x.size, 0)
      publishSlides(slides, `已从手机导入 ${slides.length} 页课件（${humanSize(totalBytes)}）`)
      closeCoursewareScanUpload()
    } catch (err: any) {
      console.error('[courseware-upload] publish failed', err)
      coursewareUploadStatus.value = 'error'
      coursewareUploadError.value = '处理失败：' + (err?.message || String(err))
    }
  }, 500)
}

function humanSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}

async function readDocumentAsArrayBuffer(file: any, path: string): Promise<ArrayBuffer> {
  const rawFile = file?.file || file
  if (rawFile && typeof rawFile.arrayBuffer === 'function') {
    return await rawFile.arrayBuffer()
  }
  if (path && typeof fetch === 'function') {
    const response = await fetch(path)
    return await response.arrayBuffer()
  }
  throw new Error('Cannot read selected document')
}

async function renderPdfToSlides(buffer: ArrayBuffer): Promise<SlideItem[]> {
  // #ifdef H5
  if (typeof document === 'undefined') throw new Error('PDF rendering requires H5 document')

  const pdfjsLib: any = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const total = pdf.numPages
  const slides: SlideItem[] = []

  for (let i = 1; i <= total; i++) {
    uni.showLoading({ title: `解析 PDF ${i}/${total}` })
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Cannot create canvas context')
    await page.render({ canvas, canvasContext: ctx, viewport } as any).promise
    slides.push({ index: i, dataUrl: canvas.toDataURL('image/jpeg', 0.9) })
  }

  return slides
  // #endif
  // #ifndef H5
  void buffer
  throw new Error('PDF 解析仅支持 H5 平台，请在浏览器中操作')
  // #endif
}

async function readImagePathAsDataUrl(path: string): Promise<string> {
  if (!path || path.startsWith('data:image/')) return path

  const byFetch = await readPathByFetch(path)
  if (byFetch) return byFetch

  const byFileSystem = await readPathByFileSystem(path)
  return byFileSystem || path
}

async function readPathByFetch(path: string): Promise<string> {
  if (typeof fetch !== 'function' || typeof FileReader === 'undefined') return ''
  try {
    const response = await fetch(path)
    const blob = await response.blob()
    if (blob.type && !blob.type.startsWith('image/')) return ''
    return await readBlobAsDataUrl(blob)
  } catch {
    return ''
  }
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => resolve('')
    reader.readAsDataURL(blob)
  })
}

function readPathByFileSystem(path: string): Promise<string> {
  return new Promise((resolve) => {
    const getFileSystemManager = (uni as any).getFileSystemManager
    if (typeof getFileSystemManager !== 'function') {
      resolve('')
      return
    }

    getFileSystemManager().readFile({
      filePath: path,
      encoding: 'base64',
      success: (res: any) => {
        const base64 = typeof res?.data === 'string' ? res.data : ''
        resolve(base64 ? `data:${guessImageMime(path)};base64,${base64}` : '')
      },
      fail: () => resolve(''),
    })
  })
}

function guessImageMime(path: string) {
  const lower = path.toLowerCase()
  if (lower.includes('.png')) return 'image/png'
  if (lower.includes('.webp')) return 'image/webp'
  if (lower.includes('.gif')) return 'image/gif'
  return 'image/jpeg'
}

/** 走 AI 生成针对当前课题的课件大纲；AI 不可用时仍 fallback 到模板，但 toast 会清楚提示。*/
async function generateAiCourseware() {
  if (isGeneratingCourseware.value) return
  isGeneratingCourseware.value = true
  uni.showLoading({ title: 'AI 生成课件中' })
  let usedFallback = false
  try {
    let specs: GeneratedSlideSpec[]
    try {
      specs = await fetchAiCoursewareSpecs()
    } catch (err) {
      console.warn('[generateAiCourseware] AI gen failed, fallback to template:', err)
      usedFallback = true
      specs = buildGeneratedSlideSpecs()
    }
    const slides = await Promise.all(
      specs.map(async (spec, idx) => ({
        index: idx + 1,
        dataUrl: await renderGeneratedSlide(spec, idx + 1, specs.length),
      })),
    )
    publishSlides(
      slides,
      usedFallback
        ? `AI 不可用，已用模板生成 ${slides.length} 页`
        : `AI 已生成 ${slides.length} 页课件`,
    )
  } catch (err) {
    console.error('Generate AI courseware failed:', err)
    toast('生成课件失败，请重试')
  } finally {
    isGeneratingCourseware.value = false
    uni.hideLoading()
  }
}

/** 强制走本地通用模板，不调 AI；速度快、无需 AI 配置，适合调试和兜底。*/
async function generateDemoCourseware() {
  if (isGeneratingCourseware.value) return
  isGeneratingCourseware.value = true
  uni.showLoading({ title: '生成演示模板' })
  try {
    const specs = buildGeneratedSlideSpecs()
    const slides = await Promise.all(
      specs.map(async (spec, idx) => ({
        index: idx + 1,
        dataUrl: await renderGeneratedSlide(spec, idx + 1, specs.length),
      })),
    )
    publishSlides(slides, `已生成 ${slides.length} 页演示模板`)
  } catch (err) {
    console.error('Generate demo courseware failed:', err)
    toast('生成演示模板失败，请重试')
  } finally {
    isGeneratingCourseware.value = false
    uni.hideLoading()
  }
}

/**
 * 调后端 /api/v1/ai/generate-courseware 拿 AI 生成的 slides[]。
 * 用 uni.request（H5 + App-Plus 都支持），15s 超时。
 * AI 走教师端在 AI 设置里配的 model / apiKey / baseUrl；都为空就走服务端默认。
 */
function fetchAiCoursewareSpecs(): Promise<GeneratedSlideSpec[]> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${API_BASE}/ai/generate-courseware`,
      method: 'POST',
      timeout: 90_000,
      header: { 'content-type': 'application/json' },
      data: {
        courseContext: store.courseName || '三元课堂',
        lessonTitle: store.lessonTitle || '本节课',
        slideCount: 6,
        model: aiModel.value || undefined,
        apiKey: aiApiKey.value || undefined,
        baseUrl: aiBaseUrl.value || undefined,
      },
      success: (res: any) => {
        if (res?.statusCode !== 200 && res?.statusCode !== 201) {
          reject(new Error(`HTTP ${res?.statusCode}`))
          return
        }
        const data = res?.data
        if (!data?.success || !Array.isArray(data?.data?.slides) || data.data.slides.length === 0) {
          reject(new Error(data?.message || '服务端返回 slides 为空'))
          return
        }
        const specs: GeneratedSlideSpec[] = data.data.slides.map((s: any) => ({
          kicker: String(s.kicker || '本节'),
          title: String(s.title || '课件页'),
          subtitle: s.subtitle ? String(s.subtitle) : '',
          accent: String(s.accent || '#2f6bff'),
          blocks: Array.isArray(s.blocks)
            ? s.blocks.map((b: any) => ({
                title: String(b?.title || ''),
                body: String(b?.body || ''),
                accent: String(b?.accent || s.accent || '#2f6bff'),
              })).filter((b: any) => b.title && b.body).slice(0, 4)
            : [],
        }))
        resolve(specs)
      },
      fail: (err: any) => reject(new Error(err?.errMsg || '请求失败')),
    })
  })
}

function buildGeneratedSlideSpecs(): GeneratedSlideSpec[] {
  const course = store.courseName || '三元课堂'
  const lesson = store.lessonTitle || '课堂教学'
  const room = store.roomCode || '------'
  return [
    {
      kicker: '三元课堂 · 课程导入',
      title: lesson,
      subtitle: `${course} · 课堂码 ${room}`,
      accent: '#2f6bff',
      blocks: [
        { title: '课堂目标', body: '明确本节课核心知识、实训任务与评价方式', accent: '#2f6bff' },
        { title: '学习方式', body: '大屏同步讲解，学生端跟随课件与互动任务', accent: '#20a546' },
        { title: '课堂节奏', body: '讲解、示范、练习、测验、反馈闭环推进', accent: '#f5a623' },
        { title: '互动提醒', body: '遇到问题可在学生端举手或提交提问', accent: '#eb2f96' },
      ],
    },
    {
      kicker: course,
      title: '本节课学习目标',
      subtitle: '把知识点拆成可观察、可练习、可反馈的课堂任务',
      accent: '#20a546',
      blocks: [
        { title: '知识理解', body: `说清楚「${lesson}」的关键概念和应用场景`, accent: '#2f6bff' },
        { title: '操作能力', body: '按步骤完成课堂演示中的核心操作', accent: '#20a546' },
        { title: '问题诊断', body: '能根据现象判断常见错误并提出修正方案', accent: '#f5a623' },
        { title: '结果表达', body: '用规范语言说明实训过程、结果和改进点', accent: '#7c4dff' },
      ],
    },
    {
      kicker: '课堂流程',
      title: '教学活动安排',
      subtitle: '教师端控制节奏，大屏和学生端实时同步',
      accent: '#f5a623',
      blocks: [
        { title: '01 情境导入', body: '结合真实岗位任务，说明为什么要学这个知识点', accent: '#2f6bff' },
        { title: '02 教师示范', body: '展示关键步骤，强调容易出错的位置', accent: '#20a546' },
        { title: '03 学生练习', body: '学生端接收任务，完成练习并提交反馈', accent: '#f5a623' },
        { title: '04 即时评价', body: '通过测验、举手和提问定位薄弱点', accent: '#eb2f96' },
      ],
    },
    {
      kicker: '核心知识',
      title: '关键概念速览',
      subtitle: '讲解时可配合板书、案例扩展或 AI 实践',
      accent: '#7c4dff',
      blocks: [
        { title: '概念一', body: '先给定义，再用一个现场可见的例子建立直觉', accent: '#2f6bff' },
        { title: '概念二', body: '对比相似概念，避免学生只记结论不懂边界', accent: '#20a546' },
        { title: '方法步骤', body: '把复杂操作拆成检查点，降低跟练失败率', accent: '#f5a623' },
        { title: '常见误区', body: '提前点出错误现象、原因和修正动作', accent: '#e23d3d' },
      ],
    },
    {
      kicker: '实训任务',
      title: '课堂练习与提交要求',
      subtitle: '把练习结果留在学生端，便于课中反馈和课后复盘',
      accent: '#0f8b8d',
      blocks: [
        { title: '任务说明', body: `围绕「${lesson}」完成一项 5 到 10 分钟练习`, accent: '#2f6bff' },
        { title: '过程记录', body: '保留关键步骤截图、参数或操作说明', accent: '#0f8b8d' },
        { title: '自查标准', body: '结果正确、过程完整、表达清楚、能说明原因', accent: '#20a546' },
        { title: '教师反馈', body: '根据提交情况推送测验、讲评或分组讨论', accent: '#eb2f96' },
      ],
    },
    {
      kicker: '课堂收束',
      title: '随堂检测与总结',
      subtitle: '用数据判断是否进入下一环节',
      accent: '#eb2f96',
      blocks: [
        { title: '随堂测验', body: '下发 3 到 5 道题，检查核心概念是否掌握', accent: '#f5a623' },
        { title: '集中答疑', body: '优先处理学生提问和举手中的共性问题', accent: '#2f6bff' },
        { title: '作业延伸', body: '按课堂表现布置分层练习或课后任务', accent: '#7c4dff' },
        { title: '下节预告', body: '说明下一节课要准备的材料和先修知识', accent: '#20a546' },
      ],
    },
  ]
}

async function renderGeneratedSlide(spec: GeneratedSlideSpec, page: number, total: number): Promise<string> {
  const svg = renderGeneratedSlideSvg(spec, page, total)
  const svgUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
  if (typeof document === 'undefined' || typeof Image === 'undefined') return svgUrl

  return new Promise((resolve) => {
    const image = new Image()
    const timer = setTimeout(() => resolve(svgUrl), 1500)
    image.onload = () => {
      clearTimeout(timer)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 1280
        canvas.height = 720
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(svgUrl)
          return
        }
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(image, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(svgUrl)
      }
    }
    image.onerror = () => {
      clearTimeout(timer)
      resolve(svgUrl)
    }
    image.src = svgUrl
  })
}

function renderGeneratedSlideSvg(spec: GeneratedSlideSpec, page: number, total: number) {
  const blockCards = spec.blocks.map((block, idx) => {
    const col = idx % 2
    const row = Math.floor(idx / 2)
    const x = 72 + col * 568
    const y = 300 + row * 150
    const color = block.accent || spec.accent
    return `
      <g>
        <rect x="${x}" y="${y}" width="520" height="118" rx="12" fill="#ffffff" stroke="#dce3ef" stroke-width="2"/>
        <rect x="${x}" y="${y}" width="8" height="118" rx="4" fill="${color}"/>
        <text x="${x + 30}" y="${y + 38}" font-size="24" font-weight="700" fill="#0f172a">${escapeXml(block.title)}</text>
        ${renderSvgLines(block.body, x + 30, y + 72, 23, 25, '#475569')}
      </g>
    `
  }).join('')

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#f8fafc"/>
  <rect x="0" y="0" width="1280" height="82" fill="#0f172a"/>
  <rect x="0" y="82" width="1280" height="6" fill="${spec.accent}"/>
  <path d="M1010 120h210v32h-210zM1010 172h144v22h-144zM1010 212h188v22h-188z" fill="${spec.accent}" opacity="0.12"/>
  <text x="72" y="52" font-size="22" font-weight="700" fill="#ffffff">三元课堂</text>
  <text x="1208" y="52" text-anchor="end" font-size="18" fill="#cbd5e1">${page} / ${total}</text>
  <text x="72" y="152" font-size="20" font-weight="700" fill="${spec.accent}">${escapeXml(spec.kicker)}</text>
  ${renderSvgLines(spec.title, 72, 222, 20, 58, '#0f172a', 66)}
  ${spec.subtitle ? renderSvgLines(spec.subtitle, 74, 270, 34, 24, '#64748b', 22) : ''}
  ${blockCards}
  <line x1="72" y1="658" x2="1208" y2="658" stroke="#dce3ef" stroke-width="2"/>
  <text x="72" y="690" font-size="18" fill="#64748b">${escapeXml(store.courseName || '三元课堂')}</text>
  <text x="1208" y="690" text-anchor="end" font-size="18" fill="#64748b">教师端生成课件 · 已同步课堂</text>
</svg>`.trim()
}

function renderSvgLines(text: string, x: number, y: number, maxChars: number, fontSize: number, color: string, lineHeight = Math.round(fontSize * 1.35)) {
  const lines = splitTextLines(text, maxChars).slice(0, 2)
  const weight = fontSize >= 40 ? 800 : 500
  return lines.map((line, idx) => (
    `<text x="${x}" y="${y + idx * lineHeight}" font-size="${fontSize}" font-weight="${weight}" fill="${color}">${escapeXml(line)}</text>`
  )).join('')
}

function splitTextLines(text: string, maxChars: number) {
  const value = text.trim()
  if (value.length <= maxChars) return [value]
  const lines: string[] = []
  let index = 0
  while (index < value.length) {
    lines.push(value.slice(index, index + maxChars))
    index += maxChars
  }
  return lines
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function showDocumentImportHint() {
  uni.showModal({
    title: 'PDF / PPT 导入',
    content: 'Web 教师端可以用浏览器能力解析 PDF。UniApp 原生端要稳定支持 PDF/PPT，建议接后端转换服务；当前可先在 Web 教师端导入，或把课件导出为图片后上传。',
    showCancel: false,
    confirmText: '知道了',
  })
}

function gotoSlide(index: number) {
  if (index < 1 || index > store.totalSlides) return
  store.currentSlide = index
  emit(RoomEvent.SlideGoto, { index, total: store.totalSlides })
  // 服务端不会把 slide:goto 回 echo 给教师本人；如果当前正在涂画蒙版里，必须本地手动重绘到新页的笔画
  if (showAnnotationOverlay.value) {
    setTimeout(() => redrawCurrentPage(), 30)
  }
}

function prevSlide() {
  gotoSlide(store.currentSlide - 1)
}

function nextSlide() {
  gotoSlide(store.currentSlide + 1)
}

function selectActivity(key: string) {
  activeActivity.value = activeActivity.value === key ? '' : key
  if (['quiz', 'attendance', 'compete', 'ai', 'discuss', 'paper', 'report', 'ai-whiteboard'].includes(key)) {
    activePanel.value = key as Panel
    return
  }
  if (key === 'knowledge') {
    emit(RoomEvent.BroadcastMsg, { message: '请注意听讲，教师正在进行知识讲解', type: 'text' })
    toast('已发送知识讲解提示', 'success')
  }
  if (key === 'case') {
    emit(RoomEvent.BroadcastMsg, { message: '请查看当前课件，教师正在展示案例', type: 'text' })
    toast('已发送案例扩展提示', 'success')
  }
}

function openPanel(panel: Panel) {
  activePanel.value = panel
}

function closePanel() {
  activePanel.value = ''
}

function getAiConfig() {
  return {
    model: aiModel.value || undefined,
    apiKey: aiApiKey.value || undefined,
    baseUrl: aiBaseUrl.value || undefined,
  }
}

function normalizeQuestions(input: any[]): QuizQuestion[] {
  return input
    .filter((q) => q && (q.stem || q.content))
    .map((q, idx) => ({
      id: q.id || `q-${Date.now()}-${idx}`,
      type: q.type || 'single_choice',
      stem: q.stem || q.content,
      content: q.content || q.stem,
      options: q.options || [],
      answer: q.answer,
      referenceAnswer: q.referenceAnswer || q.answer,
      analysis: q.analysis,
      score: q.score || q.points || 10,
      points: typeof q.points === 'number' ? q.points : (typeof q.score === 'number' ? q.score : undefined),
      difficulty: q.difficulty,
      knowledgePoints: Array.isArray(q.knowledgePoints) ? q.knowledgePoints : undefined,
      timeLimit: q.timeLimit || 120,
    }))
}

function onRemoveQuizDraft(idx: number) {
  quizDraft.value.splice(idx, 1)
  toast('已删除题目')
}

function onRemoveHomeworkDraft(idx: number) {
  homeworkDraft.value.splice(idx, 1)
  toast('已删除题目')
}

function addManualQuestion() {
  const stem = manualQuestionStem.value.trim()
  if (!stem) return toast('请输入题目内容')
  const options = manualQuestionOptions.value
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
  quizDraft.value.push({
    id: `manual-${Date.now()}`,
    type: manualQuestionType.value,
    stem,
    content: stem,
    options: manualQuestionType.value === 'single_choice' || manualQuestionType.value === 'multiple_choice' ? options : [],
    answer: manualQuestionAnswer.value.trim(),
    referenceAnswer: manualQuestionAnswer.value.trim(),
    score: 10,
    timeLimit: 120,
  })
  manualQuestionStem.value = ''
  manualQuestionAnswer.value = ''
  toast('已添加题目', 'success')
}

function generateQuiz() {
  const topic = quizTopic.value.trim() || store.lessonTitle || store.courseName
  isGeneratingQuiz.value = true
  emit(RoomEvent.AiQuizGen, {
    topic,
    count: 20,
    types: ['single_choice', 'multiple_choice', 'true_false', 'short_answer'],
    difficulty: quizDifficulty.value,
    courseContext: store.courseName,
    ...getAiConfig(),
  })
  setTimeout(() => {
    if (!isGeneratingQuiz.value) return
    isGeneratingQuiz.value = false
    quizDraft.value = normalizeQuestions([
      {
        type: 'single_choice',
        content: `${topic} 的核心应用场景是什么？`,
        options: ['课堂演示', '技能训练', '设备巡检', '以上都可能'],
        answer: 'D',
      },
      {
        type: 'true_false',
        content: `${topic} 的操作过程需要遵守安全规范。`,
        answer: '对',
      },
      {
        type: 'short_answer',
        content: `请简述 ${topic} 的关键步骤。`,
        referenceAnswer: '能够说明主要概念、流程和注意事项即可。',
      },
    ])
    toast('已生成本地备用题目', 'success')
  }, 12000)
}

const perStudentOptions = computed(() => {
  const pool = quizDraft.value.length
  return [3, 5, 8, 10].filter(n => n <= pool)
})

function pushQuizDraft() {
  if (quizDraft.value.length === 0) return
  const actualPerStudent = randomQuizMode.value
    ? Math.min(perStudentCount.value, quizDraft.value.length)
    : quizDraft.value.length
  emit(RoomEvent.QuizStart, {
    title: manualQuizTitle.value || quizTopic.value || '随堂测验',
    questions: quizDraft.value,
    timeLimit: 120,
    randomMode: randomQuizMode.value,
    perStudentCount: actualPerStudent,
  })
  store.activeQuiz = { taskId: 'pending', submitted: 0, total: store.totalCount, grading: false }
  closePanel()
  toast(randomQuizMode.value
    ? `测验已下发（题库 ${quizDraft.value.length} 题，每人随机 ${actualPerStudent} 题）`
    : '测验已下发', 'success')
}

function sendBroadcast() {
  const message = broadcastMessage.value.trim()
  if (!message) return toast('请输入广播内容')
  emit(RoomEvent.BroadcastMsg, { message, type: 'text' })
  broadcastMessage.value = ''
  closePanel()
  toast('广播已发送', 'success')
}

function startQuiz() {
  const topic = quizTopic.value.trim() || `${store.lessonTitle} 随堂测验`
  const payload = {
    title: topic,
    type: 'quick',
    questions: [
      {
        id: `q-${Date.now()}`,
        type: 'single',
        stem: `${topic} 的关键知识点是什么？`,
        options: ['概念理解', '设备维护', '安全规范', '工艺记录'],
        answer: 0,
        score: 10,
      },
    ],
  }
  emit(RoomEvent.QuizStart, payload)
  store.activeQuiz = { taskId: 'pending', submitted: 0, total: store.totalCount, grading: false }
  closePanel()
  toast('测验已下发', 'success')
}

function endQuiz() {
  if (!store.activeQuiz) return
  store.activeQuiz.grading = true
  emit(RoomEvent.QuizComplete)
  toast('已结束测验')
}

function startAttendance() {
  if (startingAttendance.value) return
  if (store.activeAttendance) {
    toast('签到已在进行中，请先结束')
    return
  }
  startingAttendance.value = true
  uni.getLocation({
    type: 'gcj02',
    isHighAccuracy: true,
    success: (res) => {
      store.attendanceSigned = []
      const payload = {
        mode: 'face-location',
        duration: 2,
        startedAt: Date.now(),
        requirePhoto: true,
        requireLocation: true,
        radius: 50,
        teacherLocation: {
          latitude: res.latitude,
          longitude: res.longitude,
        },
      }
      emit(RoomEvent.AttendanceStart, payload)
      // 乐观更新：等不到服务端 echo 时按钮也会立刻切到"结束"状态
      store.activeAttendance = {
        mode: payload.mode,
        duration: payload.duration,
        startedAt: payload.startedAt,
        requirePhoto: true,
        requireLocation: true,
        radius: 50,
        teacherLocation: payload.teacherLocation,
      }
      activeActivity.value = 'attendance'
      toast('拍照定位签到已开始', 'success')
    },
    fail: () => {
      toast('教师端定位失败，请开启定位权限')
    },
    complete: () => {
      startingAttendance.value = false
    },
  })
}

function startGroupDiscussion() {
  emit(RoomEvent.GroupCreate, {
    strategy: groupStrategy.value,
    groupCount: groupCount.value,
    topic: groupTopic.value.trim(),
    duration: groupDuration.value,
  })
  store.activeDiscussion = {
    topic: groupTopic.value.trim(),
    duration: groupDuration.value,
    startedAt: Date.now(),
    strategy: groupStrategy.value,
    groupCount: groupCount.value,
  }
  closePanel()
  toast('分组讨论已开始', 'success')
}

function endGroupDiscussion() {
  if (!store.activeDiscussion) return
  emit(RoomEvent.GroupDissolve, {})
  store.activeDiscussion = null
  toast('已结束分组讨论')
}

function startCompete() {
  const question = competeQuestion.value.trim()
  if (!question) return toast('请输入抢答题目')
  emit(RoomEvent.CompeteStart, { question, timeLimit: 30, startTime: Date.now() })
  store.activeCompete = { question, responders: [] }
  closePanel()
  toast('抢答已开始', 'success')
}

function endCompete() {
  if (!store.activeCompete) return
  emit(RoomEvent.CompeteStop, {})
  toast('已结束抢答')
}

function endAttendance() {
  emit(RoomEvent.AttendanceEnd)
  startingAttendance.value = false
  store.activeAttendance = null
  if (activeActivity.value === 'attendance') activeActivity.value = ''
  toast('已结束签到')
}

/**
 * 旧版 startAiPractice 是"一键直推"模式 · 现在替换为"先生成预览 · 教师审核 · 再下发"两步流程。
 * 保留 startAiPractice 函数名仅为 fallback / 兼容旧调用点（如有）。
 */
function generateAiPracticePreview() {
  const topic = aiTopic.value.trim()
  if (!topic) return toast('请输入 AI 实践主题')
  isGeneratingAiPractice.value = true
  aiPracticeGenChars.value = 0
  aiPracticePreview.value = null
  emit(RoomEvent.AiInteractiveGen, {
    topic,
    extraHint: aiPrompt.value.trim() || undefined,
    courseContext: store.courseName,
    broadcast: false,
    ...getAiConfig(),
  })
  // 服务端会持续推 ai:interactive:gen:progress，超时阈值放宽到 3 分钟
  // （HTML 沙盘生成 + 服务端 sanitize 时间较长，原 60s 经常误判）
  setTimeout(() => {
    if (!isGeneratingAiPractice.value) return
    isGeneratingAiPractice.value = false
    aiPracticeGenChars.value = 0
    toast('AI 实践生成超时，请稍后再试或换个简单主题')
  }, 180000)
}

function pushAiPracticeToStudents() {
  if (!aiPracticePreview.value || !aiPracticePreview.value.html) {
    toast('当前无可推送的 AI 实践预览')
    return
  }
  const topic = aiPracticePreview.value.topic || aiPracticePreview.value.title || aiTopic.value.trim()
  if (!topic) return toast('AI 实践主题缺失')
  emit(RoomEvent.AiPracticeStart, {
    topic,
    prompt: aiPrompt.value.trim(),
    startedAt: new Date().toISOString(),
  })
  emit(RoomEvent.AiInteractiveShow, aiPracticePreview.value)
  emit(RoomEvent.BroadcastMsg, { message: `【AI实践任务】${topic}`, type: 'text' })
  closePanel()
  toast('AI 实践已下发到所有学生平板', 'success')
}

function discardAiPracticePreview() {
  aiPracticePreview.value = null
}

function endAiPractice() {
  if (!store.activeAiPractice) return
  emit(RoomEvent.AiPracticeEnd, {})
  store.activeAiPractice = null
  toast('已结束 AI 实践')
}

/**
 * 旧版 generateWhiteboard 是"一键生成 + 直推大屏"模式 · 现在替换为"先生成预览 · 教师审核 · 再推送"两步。
 */
function generateWhiteboard() {
  const topic = whiteboardTopic.value.trim()
  if (!topic) return toast('请输入板书主题')
  isGeneratingWhiteboard.value = true
  whiteboardGenChars.value = 0
  whiteboardPreview.value = null
  emit(RoomEvent.AiWhiteboardGen, {
    topic,
    extraHint: whiteboardHint.value.trim() || undefined,
    broadcast: false,
    ...getAiConfig(),
  })
  // 服务端会持续推 ai:whiteboard:gen:progress，超时阈值从 30s 放宽到 2 分钟
  setTimeout(() => {
    if (!isGeneratingWhiteboard.value) return
    isGeneratingWhiteboard.value = false
    whiteboardGenChars.value = 0
    toast('AI 板书生成超时，请稍后再试或换个简单主题')
  }, 120000)
}

function pushWhiteboardToScreen() {
  if (!whiteboardPreview.value || !Array.isArray(whiteboardPreview.value.items) || whiteboardPreview.value.items.length === 0) {
    toast('当前无可推送的板书预览')
    return
  }
  emit(RoomEvent.AiWhiteboardShow, whiteboardPreview.value)
  toast('已推送到大屏', 'success')
}

function discardWhiteboardPreview() {
  whiteboardPreview.value = null
}

function hideWhiteboard() {
  emit(RoomEvent.AiWhiteboardHide)
  toast('已通知大屏关闭板书', 'success')
}

function deadlineDate() {
  const now = new Date()
  if (homeworkDeadline.value === 'today') {
    now.setHours(23, 59, 59, 0)
  } else if (homeworkDeadline.value === 'tomorrow') {
    now.setDate(now.getDate() + 1)
    now.setHours(23, 59, 59, 0)
  } else {
    const day = now.getDay()
    now.setDate(now.getDate() + (day === 0 ? 0 : 7 - day))
    now.setHours(23, 59, 59, 0)
  }
  return now.toISOString()
}

function generateHomework() {
  const topic = homeworkTopic.value.trim() || store.lessonTitle || store.courseName
  isGeneratingHomework.value = true
  emit(RoomEvent.AiQuizGen, {
    topic,
    count: 5,
    types: ['single_choice', 'true_false', 'short_answer'],
    difficulty: 'medium',
    courseContext: store.courseName,
    purpose: 'homework',
    ...getAiConfig(),
  })
  setTimeout(() => {
    if (!isGeneratingHomework.value) return
    isGeneratingHomework.value = false
    homeworkDraft.value = normalizeQuestions([
      { type: 'single_choice', content: `${topic} 的课堂重点是哪一项？`, options: ['概念', '流程', '安全', '全部'], answer: 'D' },
      { type: 'true_false', content: `${topic} 可以脱离实际操作规范单独训练。`, answer: '错' },
      { type: 'short_answer', content: `结合课堂内容，写出 ${topic} 的一个应用案例。`, referenceAnswer: '说明场景、步骤和注意事项。' },
    ])
    toast('已生成本地备用作业', 'success')
  }, 6000)
}

function publishHomework() {
  const title = manualHomeworkTitle.value.trim() || `${store.lessonTitle} 课后作业`
  const desc = manualHomeworkDesc.value.trim()
  const questions = homeworkDraft.value
  if (!desc && questions.length === 0) return toast('请填写作业要求或生成题目')
  emit(RoomEvent.HomeworkPublish, {
    title,
    description: desc,
    questions,
    deadline: deadlineDate(),
    createdAt: new Date().toISOString(),
  })
  closePanel()
  toast('作业已发布', 'success')
}

/**
 * 教师下发"AI 生成详细课堂报告"。
 *
 * 走 WebSocket `lesson:report:gen` → 服务端聚合 RoomState → AI 流式 markdown → `lesson:report:stream` 增量推回。
 * 本函数边收边渲染，结束后留在 lessonReportContent 给用户复制 / 导出。
 */
function generateLessonReport() {
  const s = getSocket()
  if (!s?.connected) {
    toast('未连接服务器')
    return
  }
  if (isGeneratingReport.value) return

  isGeneratingReport.value = true
  lessonReportContent.value = ''

  if (reportStreamHandler) s.off(RoomEvent.LessonReportStream, reportStreamHandler)
  reportStreamHandler = (data: any) => {
    if (data?.error) {
      toast('AI 报告生成失败：' + data.error)
      cancelLessonReportGen()
      return
    }
    if (data?.done) {
      lessonReportContent.value = data.fullContent || lessonReportContent.value
      cancelLessonReportGen()
      toast('AI 报告已生成', 'success')
      return
    }
    lessonReportContent.value += data?.chunk || ''
  }
  s.on(RoomEvent.LessonReportStream, reportStreamHandler)

  if (reportTimeoutId) clearTimeout(reportTimeoutId)
  reportTimeoutId = setTimeout(() => {
    if (isGeneratingReport.value) {
      toast('AI 生成超时（>180s），请重试')
      cancelLessonReportGen()
    }
  }, 180_000)

  emit(RoomEvent.LessonReportGen, getAiConfig())
  toast('AI 正在分析全堂数据…', 'success')
}

function cancelLessonReportGen() {
  isGeneratingReport.value = false
  if (reportTimeoutId) { clearTimeout(reportTimeoutId); reportTimeoutId = null }
  const s = getSocket()
  if (s && reportStreamHandler) {
    s.off(RoomEvent.LessonReportStream, reportStreamHandler)
    reportStreamHandler = null
  }
}

function copyLessonReport() {
  const text = lessonReportContent.value
  if (!text) {
    toast('暂无内容可复制')
    return
  }
  uni.setClipboardData({ data: text, success: () => toast('完整报告已复制', 'success') })
}

function exportReport() {
  const text = [
    `课程：${store.courseName}`,
    `课堂码：${store.roomCode}`,
    `学生数：${store.totalCount}`,
    `在线：${store.onlineCount}`,
    `已提交：${store.submittedCount}`,
    `提问：${store.questions.length}`,
    `举手：${store.handRaisedList.length}`,
    `建议：${reportSuggestion.value}`,
  ].join('\n')
  uni.setClipboardData({ data: text, success: () => toast('报告已复制', 'success') })
}

function loadLocalAiSettings() {
  const raw = uni.getStorageSync('teacher-ai-settings')
  if (!raw) return
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    aiProvider.value = data.provider || ''
    aiModel.value = data.model || ''
    aiApiKey.value = data.apiKey || ''
    aiBaseUrl.value = data.baseUrl || ''
  } catch {
    // ignore invalid local data
  }
}

function selectProvider(providerId: string) {
  aiProvider.value = providerId
  const provider = providers.value.find((p) => p.id === providerId)
  const firstModel = provider?.models?.[0]
  if (firstModel) aiModel.value = `${providerId}:${firstModel.id}`
}

function loadProviders() {
  loadingProviders.value = true
  uni.request({
    url: `${API_BASE}/ai/providers`,
    method: 'GET',
    success: (res: any) => {
      const list = res?.data?.data
      if (Array.isArray(list)) {
        providers.value = [{ id: '', name: '服务端默认', requiresApiKey: false }, ...list]
      }
      toast('模型列表已刷新', 'success')
    },
    fail: () => toast('模型列表加载失败，已保留默认选项'),
    complete: () => { loadingProviders.value = false },
  })
}

function saveAiSettings() {
  uni.setStorageSync('teacher-ai-settings', JSON.stringify({
    provider: aiProvider.value,
    model: aiModel.value,
    apiKey: aiApiKey.value,
    baseUrl: aiBaseUrl.value,
    updatedAt: new Date().toISOString(),
  }))
  toast('AI 设置已保存', 'success')
}

function resetAiSettings() {
  aiProvider.value = ''
  aiModel.value = ''
  aiApiKey.value = ''
  aiBaseUrl.value = ''
  uni.removeStorageSync('teacher-ai-settings')
  toast('已恢复服务端默认', 'success')
}

function rollCall(student: StudentInfo) {
  emit(RoomEvent.RollCall, { mode: 'manual', studentId: student.id })
  closePanel()
  toast(`已点名 ${student.name}`)
}

function toggleLock() {
  store.isLocked = !store.isLocked
  emit(store.isLocked ? RoomEvent.ScreenLock : RoomEvent.ScreenUnlock)
  toast(store.isLocked ? '已锁定学生屏幕' : '已解锁学生屏幕', 'success')
}

function confirmEndLesson() {
  uni.showModal({
    title: '确认下课？',
    content: '所有学生端将收到下课通知，教师端将退出课堂并回到扫码接管。',
    confirmText: '下课',
    confirmColor: '#e23d3d',
    success: (res) => {
      if (!res.confirm) return
      try {
        emit(RoomEvent.LessonEnd)
        emit(RoomEvent.BroadcastMsg, { message: '本节课已结束，感谢大家。', type: 'text' })
      } catch (err) {
        console.warn('[teacher lesson:end emit failed]', err)
      }
      store.resetLesson()
      store.roomCode = ''
      activeActivity.value = ''
      activePanel.value = ''
      toast('本节课已结束', 'success')
      // 关键：emit 是异步的，uni.sendSocketMessage 把数据丢给底层 TCP 后立刻返回，
      // 此时如果立刻 close socket，底层缓冲可能还没把 lesson:end / broadcast:msg 推到服务端。
      // 给 600ms 缓冲，让两条 WS 帧 flush 出去，服务端才会广播给学生 → 学生才能跳到 after-class。
      // 上一轮把这个 setTimeout 去掉了，导致 App-Plus 上学生收不到 lesson:end。
      setTimeout(() => {
        forceDisconnect()
        uni.reLaunch({
          url: '/pages/course-select/index',
          fail: (err) => {
            console.error('[teacher reLaunch failed]', err)
            uni.navigateBack({ delta: 1, fail: () => uni.switchTab?.({ url: '/pages/course-select/index' }) })
          },
        })
      }, 600)
    },
  })
}

function truncate(text: string, max: number) {
  const s = String(text || '')
  return s.length > max ? `${s.slice(0, max)}…` : s
}

function studentQuestions(sub: any) {
  const stats = quizReport.value?.questionStats || []
  if (!quizReport.value?.randomMode || !sub.assignedQuestionIds) return stats
  const ids = new Set(sub.assignedQuestionIds)
  return stats.filter((qs: any) => ids.has(qs.question.id))
}

function stateText(state: StudentInfo['state']) {
  const map = {
    online: '在线',
    working: '作答',
    submitted: '已交',
    offline: '离线',
  }
  return map[state]
}
</script>

<style scoped lang="scss">
@import '@/styles/variables.scss';

.page {
  min-height: 100vh;
  background: var(--color-bg);
}

.header,
.header-badges,
.badge,
.card-head,
.mini-badges,
.slide-controls,
.status-card,
.status-left,
.control-bar,
.ctrl-btn,
.modal-head,
.option-row,
.student-row,
.rank-row,
.hand-tag {
  display: flex;
  align-items: center;
}

.header {
  min-height: 112rpx;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  background: var(--color-surface);
  border-bottom: 2rpx solid var(--color-outline-variant);
}

.title-block {
  min-width: 0;
}

.course-name,
.lesson-title,
.card-title,
.slide-empty-title,
.slide-empty-desc,
.status-title,
.status-desc,
.section-label,
.question-meta,
.question-text,
.compete-question {
  display: block;
}

.course-name {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
}

.lesson-title {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}

.header-badges {
  gap: var(--space-2);
  flex-shrink: 0;
}

.badge {
  min-height: 56rpx;
  gap: var(--space-1);
  padding: 0 var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--color-success-container);
  color: var(--color-on-success-container);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
}

.badge.danger {
  background: var(--color-danger-container);
  color: var(--color-on-danger-container);
}

.badge.record {
  background: var(--color-primary-container);
  color: var(--color-on-primary-container);
}

.body {
  height: calc(100vh - 112rpx);
  padding-bottom: 148rpx;
}

.layout {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  padding-bottom: 164rpx;
}

.main-column,
.side-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.card {
  padding: var(--space-4);
  border: 2rpx solid var(--color-outline-variant);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--elevation-1);
}

.card-head {
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.courseware-head-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.card-title {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
}

.slide-preview {
  height: 360rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  border: 2rpx dashed var(--color-outline);
  background: var(--color-surface-variant);
  overflow: hidden;
}

.slide-image {
  width: 100%;
  height: 100%;
}

.slide-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
}

.slide-empty-title {
  color: var(--color-text-primary);
  font-size: var(--font-body);
  font-weight: var(--font-weight-semibold);
}

.slide-empty-desc {
  font-size: var(--font-caption);
}

.slide-controls {
  justify-content: center;
  gap: var(--space-5);
  margin-top: var(--space-4);
}

.round-btn {
  width: 88rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text-primary);
}

.round-btn[disabled] {
  opacity: 0.35;
}

.round-press {
  background: var(--color-primary-container);
  color: var(--color-primary);
}

.slide-count {
  min-width: 160rpx;
  text-align: center;
}

.slide-current {
  color: var(--color-primary);
  font-size: 56rpx;
  font-weight: var(--font-weight-bold);
}

.slide-total {
  color: var(--color-text-tertiary);
  font-size: var(--font-label);
}

.thumb-row {
  white-space: nowrap;
  margin-top: var(--space-3);
}

.thumb {
  width: 112rpx;
  height: 72rpx;
  display: inline-flex;
  margin-right: var(--space-2);
  border: 4rpx solid var(--color-outline);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.thumb.active {
  border-color: var(--color-primary);
}

.thumb image {
  width: 100%;
  height: 100%;
}

.activity-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
}

.activity-card {
  min-height: 144rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
}

.activity-press {
  transform: scale(0.97);
  background: var(--color-state-overlay-press);
}

.activity-card.active {
  border-width: 4rpx;
}

.activity-icon {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: var(--color-surface-variant);
}

.status-card {
  gap: var(--space-3);
}

.status-left {
  gap: var(--space-2);
  flex-shrink: 0;
}

.pulse-dot {
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
  background: var(--color-success);
  box-shadow: 0 0 0 8rpx rgba(32, 165, 70, 0.16);
}

.pulse-dot.grading {
  background: var(--color-primary);
  box-shadow: 0 0 0 8rpx rgba(47, 107, 255, 0.16);
}

.status-title {
  font-size: var(--font-label);
  font-weight: var(--font-weight-bold);
}

.status-desc {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}

.progress-track {
  flex: 1;
  height: 12rpx;
  border-radius: var(--radius-pill);
  overflow: hidden;
  background: var(--color-surface-variant);
}

.progress-fill {
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
}

.mini-badges {
  gap: var(--space-2);
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}

.hand-list {
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-warning-container);
}

.section-label {
  margin-bottom: var(--space-2);
  color: var(--color-on-warning-container);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-bold);
}

.hand-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.hand-tag {
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  font-size: var(--font-caption);
}

.empty {
  min-height: 220rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  color: var(--color-text-tertiary);
  font-size: var(--font-label);
}

.empty.compact {
  min-height: 88rpx;
}

.student-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.student-row {
  gap: var(--space-2);
  min-height: 56rpx;
}

.student-name {
  width: 112rpx;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: var(--font-caption);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.student-track {
  flex: 1;
  height: 12rpx;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-surface-variant);
}

.student-fill {
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--color-outline);
}

.student-fill.working {
  background: var(--color-warning);
}

.student-fill.submitted {
  background: var(--color-success);
}

.student-state {
  width: 64rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  text-align: right;
}

.question-card,
.compete-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.count-text,
.question-meta {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}

.question-item {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface-variant);
}

.question-text {
  margin-top: var(--space-1);
  color: var(--color-text-primary);
  font-size: var(--font-label);
}

.compete-question {
  color: var(--color-text-secondary);
  font-size: var(--font-label);
}

.rank-row {
  gap: var(--space-2);
  min-height: 56rpx;
}

.rank-index {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: var(--color-primary-container);
  color: var(--color-primary);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-bold);
  text-align: center;
  line-height: 44rpx;
}

.rank-name {
  flex: 1;
  font-size: var(--font-label);
}

.rank-time {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}

.control-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-sticky);
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4) calc(var(--space-3) + var(--safe-bottom));
  border-top: 2rpx solid var(--color-outline-variant);
  background: var(--color-surface);
  box-shadow: var(--elevation-3);
}

.ctrl-btn {
  flex: 1;
  min-height: 96rpx;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-1);
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
}

.ctrl-btn.active {
  border-color: var(--color-primary);
  background: var(--color-primary-container);
  color: var(--color-primary);
}

.ctrl-btn.danger {
  border-color: rgba(226, 61, 61, 0.28);
  color: var(--color-danger);
}

.ctrl-press {
  transform: scale(0.97);
  background: var(--color-state-overlay-press);
}

.modal-mask {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: var(--space-4);
  background: var(--color-scrim);
}

.modal-card {
  width: 100%;
  max-width: 760rpx;
  max-height: calc(85vh - var(--safe-bottom));
  overflow-y: auto;
  padding: var(--space-5);
  padding-bottom: calc(var(--space-5) + var(--safe-bottom));
  border-radius: var(--radius-2xl);
  background: var(--color-surface-raised);
  box-shadow: var(--elevation-5);
}

.modal-card:has(.quiz-two-col) {
  max-width: 1200rpx;
  overflow-y: hidden;
}

.modal-head {
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.modal-title {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
}

.close-btn {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  background: var(--color-surface-variant);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.form.quiz-two-col {
  flex-direction: row;
  align-items: stretch;
  gap: var(--space-4);
  max-height: calc(70vh - 120rpx);
}

.quiz-left {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  flex-shrink: 0;
  min-width: 0;
  overflow-y: auto;
}

.form.quiz-two-col .quiz-left {
  width: 44%;
  max-width: 520rpx;
}

.form.quiz-two-col .segmented {
  flex-wrap: wrap;
}

.quiz-right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  border-left: 2rpx solid var(--color-outline-variant);
  padding-left: var(--space-4);
}

.quiz-preview-scroll {
  height: calc(55vh - 280rpx);
}

.quiz-dispatch-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-surface-variant);
  border-radius: var(--radius-lg);
}
.quiz-dispatch-settings .option-label {
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
  flex-shrink: 0;
  white-space: nowrap;
}
.quiz-dispatch-settings .option-row {
  align-items: center;
}
.hint-text {
  font-size: 22rpx;
  color: var(--color-text-tertiary);
  text-align: center;
}

.random-mode-badge {
  text-align: center;
  padding: var(--space-1) var(--space-3);
  background: #f0f7ff;
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
}
.random-mode-badge text {
  font-size: var(--font-caption);
  color: #2f6bff;
  font-weight: var(--font-weight-semibold);
}

.segmented {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-1);
  border-radius: var(--radius-lg);
  background: var(--color-surface-variant);
}

.segmented button {
  flex: 1;
  min-height: 72rpx;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
}

.segmented button.active {
  background: var(--color-surface);
  color: var(--color-primary);
  box-shadow: var(--elevation-1);
}

.input,
.textarea {
  width: 100%;
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-lg);
  background: var(--color-surface-variant);
  color: var(--color-text-primary);
  font-size: var(--font-body);
}

.input {
  height: 96rpx;
  padding: 0 var(--space-4);
}

.textarea {
  min-height: 180rpx;
  padding: var(--space-4);
}

.textarea.small {
  min-height: 140rpx;
}

.option-row {
  gap: var(--space-3);
}

.option-card {
  flex: 1;
  min-height: 144rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  font-size: var(--font-label);
}

.option-card.active {
  border-color: var(--color-success);
  background: var(--color-success-container);
}

.option-card.compact {
  min-height: 76rpx;
  padding: 0 var(--space-2);
  font-size: var(--font-caption);
}

.option-desc {
  display: block;
  margin-top: var(--space-1);
  color: var(--color-text-tertiary);
  font-size: var(--font-overline);
}

.courseware-choice-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.courseware-choice {
  min-height: 184rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-4);
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  text-align: left;
}

.courseware-choice.wide {
  min-height: 116rpx;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
}

.courseware-choice.highlight {
  border-color: var(--color-primary);
  background: linear-gradient(135deg, var(--color-primary-container) 0%, var(--color-surface) 100%);
}

.scan-qr-card {
  max-width: 520rpx;
}
.scan-qr-body {
  padding: var(--space-5);
  min-height: 520rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.scan-qr-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  text-align: center;
}
.scan-qr-spinner {
  width: 88rpx;
  height: 88rpx;
  border: 8rpx solid var(--color-outline-variant);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: scan-spin 0.8s linear infinite;
}
@keyframes scan-spin {
  to { transform: rotate(360deg); }
}
.scan-qr-qrwrap {
  width: 480rpx;
  height: 480rpx;
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  background: #fff;
  border: 2rpx solid var(--color-outline-variant);
  display: flex;
  align-items: center;
  justify-content: center;
}
.scan-qr-img {
  width: 100%;
  height: 100%;
}
.scan-qr-session {
  font-size: var(--font-label);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
  font-family: ui-monospace, "SF Mono", monospace;
  letter-spacing: 2rpx;
  padding: var(--space-2) var(--space-4);
  background: var(--color-primary-container);
  border-radius: var(--radius-pill);
}
.scan-qr-tip {
  font-size: var(--font-body);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
  line-height: 1.6;
  max-width: 420rpx;
}
.scan-qr-hint {
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
  max-width: 420rpx;
}
.scan-qr-ok-icon,
.scan-qr-err-icon {
  width: 144rpx;
  height: 144rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.scan-qr-ok-icon { background: var(--color-success-container); }
.scan-qr-err-icon { background: var(--color-danger-container); }
.scan-qr-ok-title {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-success);
}
.scan-qr-err-title {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-danger);
}

.choice-icon {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: var(--radius-md);
}

.choice-icon.primary {
  background: var(--color-primary-container);
  color: var(--color-on-primary-container);
}

.choice-icon.accent {
  background: var(--color-secondary-container);
  color: var(--color-on-secondary-container);
}

.choice-icon.neutral {
  background: var(--color-surface-variant);
  color: var(--color-text-secondary);
}

.choice-copy {
  min-width: 0;
}

.choice-title,
.choice-desc {
  display: block;
}

.choice-title {
  color: var(--color-text-primary);
  font-size: var(--font-label);
  font-weight: var(--font-weight-bold);
}

.choice-desc {
  margin-top: var(--space-1);
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: 1.4;
}

.stepper {
  min-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 0 var(--space-3);
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-lg);
  background: var(--color-surface-variant);
  color: var(--color-text-primary);
  font-size: var(--font-label);
  font-weight: var(--font-weight-semibold);
}

.stepper button,
.mini-icon {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text-primary);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.chip {
  min-height: 64rpx;
  padding: 0 var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--color-primary-container);
  color: var(--color-primary);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
}

.draft-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  background: var(--color-surface-variant);
}

.section-label.neutral {
  color: var(--color-text-secondary);
}

.draft-item,
.submission-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 72rpx;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.draft-index {
  width: 44rpx;
  height: 44rpx;
  border-radius: var(--radius-pill);
  background: var(--color-primary-container);
  color: var(--color-primary);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-bold);
  line-height: 44rpx;
  text-align: center;
}

.draft-body {
  flex: 1;
  min-width: 0;
}

.draft-type,
.draft-text,
.report-text {
  display: block;
}

.draft-type {
  color: var(--color-primary);
  font-size: var(--font-overline);
  font-weight: var(--font-weight-bold);
}

.draft-text {
  color: var(--color-text-primary);
  font-size: var(--font-caption);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
}

.summary-stat {
  min-height: 112rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  border-radius: var(--radius-lg);
  background: var(--color-surface-variant);
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}

.s-num {
  color: var(--color-primary);
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
}

.submission-row {
  justify-content: space-between;
  font-size: var(--font-label);
}

.student-detail-block {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  margin-bottom: var(--space-2);
}

.student-detail-name {
  font-weight: 600;
}

.per-q-row {
  padding: var(--space-1) 0;
  border-top: 1px solid var(--color-border, rgba(0,0,0,0.06));
}

.per-q-head {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-caption);
}

.per-q-idx {
  flex-shrink: 0;
  color: var(--color-text-secondary);
  min-width: 40rpx;
}

.per-q-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-secondary);
}

.per-q-badge {
  flex-shrink: 0;
  font-size: 22rpx;
  padding: 2rpx 12rpx;
  border-radius: var(--radius-sm);
}

.badge-ok {
  background: rgba(34,197,94,0.12);
  color: #16a34a;
}

.badge-wrong {
  background: rgba(239,68,68,0.12);
  color: #dc2626;
}

.badge-miss {
  background: rgba(156,163,175,0.12);
  color: #6b7280;
}

.per-q-comment {
  font-size: 22rpx;
  color: var(--color-text-secondary);
  padding: var(--space-1) 0 0 40rpx;
  line-height: 1.4;
}

.attendance-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 420rpx;
  overflow-y: auto;
}

.anno-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  flex-direction: column;
  background: #0a0e1f;
  color: #e5e7eb;
}

.anno-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  padding-top: calc(var(--space-3) + var(--safe-top));
  background: rgba(15, 23, 42, 0.85);
  border-bottom: 2rpx solid rgba(255, 255, 255, 0.08);
}

.anno-meta {
  display: flex;
  flex-direction: column;
  gap: 2rpx;
  min-width: 0;
}

.anno-title {
  font-size: var(--font-label);
  font-weight: var(--font-weight-bold);
  color: #fff;
}

.anno-page {
  font-size: var(--font-caption);
  color: rgba(255, 255, 255, 0.55);
}

.anno-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.anno-color-group,
.anno-width-group {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: 4rpx 8rpx;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.08);
}

.anno-color {
  width: 48rpx;
  height: 48rpx;
  padding: 0;
  border-radius: 50%;
  border: 4rpx solid transparent;
  transition: border-color var(--duration-fast) var(--ease-standard);

  &.active {
    border-color: #fff;
  }
}

.anno-width {
  width: 56rpx;
  height: 48rpx;
  padding: 0;
  background: transparent;
  border: 2rpx solid transparent;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;

  &.active {
    border-color: rgba(255, 255, 255, 0.45);
    background: rgba(255, 255, 255, 0.08);
  }
}

.anno-width-dot {
  border-radius: 50%;
  background: #fff;
}

.anno-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  min-height: 64rpx;
  padding: 0 var(--space-3);
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
  border: 0;

  &.danger {
    background: rgba(239, 68, 68, 0.22);
    color: #fecaca;
  }
}

.anno-action-press {
  background: rgba(255, 255, 255, 0.18);
}

.anno-stage {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #0a0e1f;
}

.anno-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.anno-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
}

.anno-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-5);
  padding-bottom: calc(var(--space-3) + var(--safe-bottom));
  background: rgba(15, 23, 42, 0.85);
  border-top: 2rpx solid rgba(255, 255, 255, 0.08);
}

.anno-nav-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 80rpx;
  padding: 0 var(--space-5);
  border-radius: var(--radius-lg);
  background: rgba(59, 130, 246, 0.32);
  color: #fff;
  font-size: var(--font-label);
  font-weight: var(--font-weight-semibold);
  border: 0;

  &[disabled] {
    opacity: 0.3;
  }
}

.anno-page-indicator {
  font-size: var(--font-label);
  font-weight: var(--font-weight-bold);
  color: #fff;
  font-variant-numeric: tabular-nums;
}

.report-card {
  max-width: 880rpx;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.report-body {
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.kp-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 56rpx;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.kp-name {
  flex: 1;
  min-width: 0;
  font-size: var(--font-caption);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kp-bar {
  width: 200rpx;
  height: 12rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-variant);
  overflow: hidden;
  flex-shrink: 0;
}

.kp-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-pill);
  transition: width 0.4s ease;

  &.mastered { background: var(--color-success); }
  &.practicing { background: var(--color-warning); }
  &.needs_improvement { background: var(--color-danger); }
}

.kp-pct {
  width: 76rpx;
  text-align: right;
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.attendance-row {
  min-height: 104rpx;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
  border-radius: var(--radius-lg);
  background: var(--color-surface-variant);
}

.attendance-photo {
  width: 80rpx;
  height: 80rpx;
  border-radius: var(--radius-md);
  background: var(--color-outline);
}

.attendance-info {
  flex: 1;
  min-width: 0;
}

.attendance-name,
.attendance-meta {
  display: block;
}

.attendance-name {
  color: var(--color-text-primary);
  font-size: var(--font-label);
  font-weight: var(--font-weight-bold);
}

.attendance-meta {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}

.ok-text {
  color: var(--color-success);
  font-weight: var(--font-weight-semibold);
}

.muted-text {
  color: var(--color-text-tertiary);
}

.report-block,
.hint-box {
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  background: var(--color-surface-variant);
}

.report-text,
.hint-box {
  color: var(--color-text-secondary);
  font-size: var(--font-label);
  line-height: var(--line-height-normal);
}

/* AI 生成中的流式进度条：让 30s+ 的等待不再像"卡死" */
.gen-progress {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 12rpx 16rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-variant);
}

.gen-progress-bar {
  position: relative;
  width: 100%;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.gen-progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #6c8cff 0%, #b88aff 100%);
  border-radius: 999rpx;
  transition: width 240ms ease-out;
}

.gen-progress-text {
  font-size: var(--font-caption, 22rpx);
  color: var(--color-text-secondary);
}

.report-scroll {
  max-height: 60vh;
  padding: var(--space-4);
  background: var(--color-surface);
  border: 2rpx solid var(--color-outline-variant);
  border-radius: var(--radius-md);
}

.report-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

/* —— 课堂分析 markdown 渲染样式（rich-text 内） —— */
.md-body {
  display: block;
  font-size: var(--font-body);
  line-height: var(--line-height-normal);
  color: var(--color-text-primary);
  word-break: break-word;
}
.md-body :deep(h1),
.md-body :deep(h2),
.md-body :deep(h3),
.md-body :deep(h4) {
  font-weight: var(--font-weight-bold);
  margin: 24rpx 0 12rpx;
  color: var(--color-text-primary);
}
.md-body :deep(h1) { font-size: var(--font-headline); }
.md-body :deep(h2) { font-size: var(--font-title); border-bottom: 2rpx solid var(--color-outline-variant); padding-bottom: 8rpx; }
.md-body :deep(h3) { font-size: var(--font-title-sm); }
.md-body :deep(h4) { font-size: var(--font-body-lg); }
.md-body :deep(p) { margin: 0 0 16rpx; }
.md-body :deep(p:last-child) { margin-bottom: 0; }
.md-body :deep(strong) { font-weight: var(--font-weight-bold); color: var(--color-primary); }
.md-body :deep(em) { font-style: italic; }
.md-body :deep(del) { text-decoration: line-through; color: var(--color-text-tertiary); }
.md-body :deep(a) {
  color: var(--color-primary);
  text-decoration: none;
}
.md-body :deep(ul),
.md-body :deep(ol) {
  margin: 8rpx 0 16rpx;
  padding-left: 40rpx;
}
.md-body :deep(li) { margin: 6rpx 0; }
.md-body :deep(ol) { list-style: decimal; }
.md-body :deep(ul) { list-style: disc; }
.md-body :deep(code) {
  font-family: 'SFMono-Regular', Consolas, monospace;
  background: var(--color-surface-variant);
  color: var(--color-secondary);
  padding: 2rpx 10rpx;
  border-radius: var(--radius-xs);
  font-size: 25rpx;
}
.md-body :deep(pre) {
  background: var(--color-surface-variant);
  border: 2rpx solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  padding: 16rpx 20rpx;
  margin: 12rpx 0;
  overflow-x: auto;
}
.md-body :deep(pre code) {
  background: transparent;
  padding: 0;
  color: var(--color-text-primary);
  font-size: 23rpx;
}
.md-body :deep(blockquote) {
  margin: 12rpx 0;
  padding: 12rpx 20rpx;
  border-left: 6rpx solid var(--color-primary);
  background: var(--color-primary-container);
  color: var(--color-text-secondary);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
.md-body :deep(hr) {
  border: none;
  border-top: 2rpx solid var(--color-outline-variant);
  margin: 16rpx 0;
}

/* ===== AI 板书 / AI 实践 · 预览卡片 ===== */
.preview-card {
  margin-top: var(--space-3);
  padding: var(--space-4);
  background: linear-gradient(135deg, rgba(47, 107, 255, 0.04), rgba(124, 77, 255, 0.04));
  border: 2rpx solid rgba(47, 107, 255, 0.18);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.preview-card-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.preview-card-badge {
  flex-shrink: 0;
  padding: 4rpx 16rpx;
  font-size: var(--font-overline);
  font-weight: var(--font-weight-bold);
  background: rgba(47, 107, 255, 0.12);
  color: var(--color-primary);
  border-radius: var(--radius-sm);
}

.preview-card-title {
  flex: 1;
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.preview-card-subtitle {
  font-size: var(--font-label);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}

.preview-items {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  max-height: 480rpx;
  overflow: auto;
}

.preview-item-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.preview-item-bullet {
  flex-shrink: 0;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background: var(--color-primary);
  color: #ffffff;
  font-size: 20rpx;
  font-weight: var(--font-weight-bold);
  text-align: center;
  line-height: 36rpx;
}

.preview-item-text {
  flex: 1;
  font-size: var(--font-body);
  line-height: var(--line-height-normal);
  color: var(--color-text-primary);
  word-break: break-word;
}

.preview-item-more {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
  text-align: center;
  padding: var(--space-2);
}

.preview-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.preview-meta-chip {
  padding: 4rpx 16rpx;
  font-size: var(--font-caption);
  background: var(--color-surface);
  border: 2rpx solid var(--color-outline-variant);
  border-radius: var(--radius-pill);
  color: var(--color-text-secondary);
}

.preview-meta-chip.warn {
  border-color: rgba(245, 166, 35, 0.5);
  background: rgba(245, 166, 35, 0.08);
  color: #d46b08;
}

.preview-hint {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
  line-height: var(--line-height-normal);
}

.preview-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.link-btn {
  align-self: flex-start;
  min-height: 56rpx;
  padding: 0 var(--space-2);
  color: var(--color-primary);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
}

.student-pick {
  min-height: 88rpx;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-4);
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  font-size: var(--font-body);
  text-align: left;
}

@media (min-width: 900px) {
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(360rpx, 0.75fr);
    max-width: 1440rpx;
    margin: 0 auto;
  }

  .slide-preview {
    height: 460rpx;
  }

  .activity-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .modal-mask {
    align-items: center;
  }
}
</style>
