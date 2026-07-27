<template>
  <view class="after-class" :class="{ landscape: isLandscape, portrait: !isLandscape }">
    <!-- 装饰：飘落的彩纸点 -->
    <view class="confetti" aria-hidden="true">
      <view
        v-for="n in 12"
        :key="n"
        class="confetto"
        :class="`c-${n}`"
      ></view>
    </view>

    <view class="header">
      <view class="header-icon-wrap">
        <view class="header-icon-glow"></view>
        <Icon name="party-popper" size="2xl" tone="primary" />
      </view>
      <text class="title fade-up" style="animation-delay: 120ms">本节课已结束</text>
      <text class="sub fade-up" style="animation-delay: 240ms">辛苦了！课后作业可以在下方查看</text>
    </view>

    <!-- AI 错题本入口（始终可见，引导课后巩固） -->
    <Card
      :elevation="2"
      padding="md"
      class="wrong-book-entry fade-up"
      :style="{ animationDelay: '160ms' }"
      interactive
      @tap="openWrongBook"
    >
      <view class="wbe-row">
        <view class="wbe-icon-wrap">
          <Icon name="brain" size="lg" tone="inverse" />
          <view class="wbe-icon-glow"></view>
        </view>
        <view class="wbe-text">
          <text class="wbe-title">我的错题本 · AI 讲解</text>
          <text class="wbe-desc">本节课答错的题已自动归集，点开有 AI 一对一讲解</text>
        </view>
        <view class="wbe-arrow">
          <Icon name="chevron-right" size="md" tone="inverse" />
        </view>
      </view>
    </Card>

    <view v-if="store.homeworkList.length === 0" class="empty-state">
      <view class="empty-icon-wrap"><Icon name="check-circle" size="2xl" tone="success" /></view>
      <text class="empty-title">没有待完成的作业</text>
      <text class="empty-desc">去复习一下笔记，巩固今天的内容吧</text>
      <Button variant="primary" size="md" icon-left="arrow-left" @tap="goBack">
        回到加入页
      </Button>
    </view>

    <scroll-view v-else scroll-y class="hw-scroll">
      <view class="hw-list">
        <Card
          v-for="(hw, i) in store.homeworkList"
          :key="hw.id"
          :elevation="1"
          padding="md"
          class="hw-card fade-up"
          :style="{ animationDelay: (200 + i * 80) + 'ms' }"
        >
          <view class="hw-head">
            <view class="hw-title-wrap">
              <Icon name="book-open" size="sm" tone="primary" />
              <text class="hw-title">{{ hw.title }}</text>
            </view>
            <Tag v-if="hw.deadline" tone="warning" icon="clock">
              {{ formatDeadline(hw.deadline) }}
            </Tag>
          </view>
          <text class="hw-desc">{{ hw.description || '老师布置了一份课后作业，请认真完成。' }}</text>
          <view class="hw-meta">
            <Tag tone="primary" icon="file-text">{{ hw.questions.length }} 题</Tag>
            <Tag v-if="hw.type" tone="neutral">{{ hw.type }}</Tag>
          </view>
          <view v-if="hw.questions.length > 0" class="hw-questions">
            <view v-for="(q, i) in hw.questions.slice(0, 3)" :key="i" class="hw-q">
              <text class="hw-q-num">{{ i + 1 }}</text>
              <text class="hw-q-text">{{ q.content }}</text>
            </view>
            <text v-if="hw.questions.length > 3" class="hw-more">
              还有 {{ hw.questions.length - 3 }} 题
            </text>
          </view>
          <Button variant="primary" size="md" block icon-right="arrow-right">
            开始作答
          </Button>
        </Card>
      </view>
    </scroll-view>

    <view class="footer" :style="{ paddingBottom: `max(var(--space-4), var(--safe-bottom))` }">
      <Button variant="secondary" size="md" icon-left="arrow-left" @tap="goBack">
        退出课堂
      </Button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useStudentStore } from '@/stores/student'
import { useOrientation } from '@/composables/useOrientation'
import Icon from '@/student-components/ui/Icon.vue'
import Button from '@/student-components/ui/Button.vue'
import Tag from '@/student-components/ui/Tag.vue'
import Card from '@/student-components/ui/Card.vue'

const store = useStudentStore()
const { isLandscape } = useOrientation()

function formatDeadline(s: string): string {
  try {
    const d = new Date(s)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `截止 ${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch { return s }
}

function goBack() {
  uni.reLaunch({ url: '/pages/student/join/index' })
}

function openWrongBook() {
  uni.navigateTo({ url: '/pages/student/wrong-book/index' })
}
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.after-class {
  min-height: 100vh;
  padding: var(--space-7);
  padding-top: max(var(--space-7), var(--safe-top));
  padding-left: max(var(--space-7), var(--safe-left));
  padding-right: max(var(--space-7), var(--safe-right));
  background:
    radial-gradient(ellipse 60% 40% at 50% -10%, rgba(47, 107, 255, 0.10), transparent 70%),
    var(--color-bg);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  box-sizing: border-box;
  position: relative;
  overflow-x: hidden;
}

/* —— 庆祝彩纸 —— */
.confetti {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}
.confetto {
  position: absolute;
  width: 16rpx;
  height: 24rpx;
  border-radius: 4rpx;
  animation: confetto-fall var(--dur, 8s) linear infinite;
  animation-delay: var(--delay, 0s);
  will-change: transform, opacity;
}
/* 给每片彩纸一个不同的色、位置、时序 */
.c-1  { left:  8%; --delay: 0s;   --dur: 8s;  background: var(--p-blue-500); }
.c-2  { left: 16%; --delay: 1.2s; --dur: 9s;  background: var(--p-purple-500); }
.c-3  { left: 24%; --delay: 2.8s; --dur: 7s;  background: var(--p-amber-500); }
.c-4  { left: 32%; --delay: 0.5s; --dur: 10s; background: var(--p-green-500); }
.c-5  { left: 40%; --delay: 3.4s; --dur: 8.5s; background: var(--p-red-500); }
.c-6  { left: 48%; --delay: 1.8s; --dur: 9.5s; background: var(--p-blue-300); }
.c-7  { left: 56%; --delay: 4.0s; --dur: 8s;  background: var(--p-purple-300); }
.c-8  { left: 64%; --delay: 2.2s; --dur: 7.5s; background: var(--p-amber-300); }
.c-9  { left: 72%; --delay: 5.0s; --dur: 9s;  background: var(--p-green-300); }
.c-10 { left: 80%; --delay: 0.8s; --dur: 10s; background: var(--p-red-300); }
.c-11 { left: 88%; --delay: 3.0s; --dur: 8s;  background: var(--p-blue-500); }
.c-12 { left: 96%; --delay: 1.5s; --dur: 9s;  background: var(--p-purple-500); }

@keyframes confetto-fall {
  0%   { transform: translateY(-40rpx) rotate(0deg); opacity: 0; }
  10%  { opacity: 0.85; }
  100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
}

.after-class > :not(.confetti) { position: relative; z-index: 1; }

@media (prefers-reduced-motion: reduce) {
  .confetto { animation: none; opacity: 0; }
}

/* —— fade-up 入场（与 join 同套） —— */
.fade-up {
  opacity: 0;
  animation: fade-up var(--duration-slow) var(--ease-decelerate) forwards;
}
@keyframes fade-up {
  from { opacity: 0; transform: translateY(20rpx); }
  to   { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .fade-up { opacity: 1; animation: none; transform: none; }
}

.header {
  text-align: center;
  padding: var(--space-4) 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.header-icon-wrap {
  position: relative;
  width: 144rpx;
  height: 144rpx;
  border-radius: var(--radius-full);
  background: var(--color-primary-container);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: icon-celebrate 800ms var(--ease-emphasized) both;
}

.header-icon-glow {
  position: absolute;
  inset: -12rpx;
  border-radius: var(--radius-full);
  background: radial-gradient(circle, rgba(47, 107, 255, 0.35), transparent 70%);
  filter: blur(24rpx);
  z-index: -1;
  animation: icon-glow-pulse 2.8s var(--ease-standard) infinite;
}

@keyframes icon-celebrate {
  0%   { opacity: 0; transform: scale(0.4) rotate(-20deg); }
  60%  { opacity: 1; transform: scale(1.1) rotate(8deg); }
  100% { opacity: 1; transform: scale(1) rotate(0); }
}

@keyframes icon-glow-pulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50%      { opacity: 1;   transform: scale(1.18); }
}

@media (prefers-reduced-motion: reduce) {
  .header-icon-wrap, .header-icon-glow { animation: none; }
}

.title {
  font-size: var(--font-headline);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.sub {
  font-size: var(--font-body);
  color: var(--color-text-secondary);
}

/* ===== 错题本入口卡 ===== */
.wrong-book-entry {
  background: linear-gradient(135deg, #722ed1 0%, #5b1eb0 60%, #2f6bff 100%);
  border-radius: var(--radius-xl);
  overflow: hidden;
  position: relative;
}
.wrong-book-entry :deep(.card-hover) { opacity: 0.92; }
.wbe-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  position: relative;
  z-index: 1;
}
.wbe-icon-wrap {
  position: relative;
  width: 96rpx;
  height: 96rpx;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.20);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wbe-icon-glow {
  position: absolute;
  inset: -16rpx;
  border-radius: var(--radius-full);
  background: radial-gradient(circle, rgba(255, 255, 255, 0.35), transparent 70%);
  filter: blur(20rpx);
  z-index: -1;
  animation: icon-glow-pulse 3s var(--ease-standard) infinite;
}
.wbe-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}
.wbe-title {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
  color: #fff;
}
.wbe-desc {
  font-size: var(--font-caption);
  color: rgba(255, 255, 255, 0.85);
  line-height: var(--line-height-snug);
}
.wbe-arrow {
  width: 56rpx;
  height: 56rpx;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-9) 0;
  text-align: center;
}

.empty-icon-wrap {
  width: 144rpx;
  height: 144rpx;
  border-radius: var(--radius-full);
  background: var(--color-success-container);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-3);
}

.empty-title {
  font-size: var(--font-title);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.empty-desc {
  font-size: var(--font-body);
  color: var(--color-text-secondary);
}

.hw-scroll { flex: 1; min-height: 0; }

.landscape .hw-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}
.portrait .hw-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.hw-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.hw-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
}

.hw-title-wrap {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.hw-title {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hw-desc {
  font-size: var(--font-body);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}

.hw-meta {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.hw-questions {
  padding: var(--space-4);
  background: var(--color-surface-variant);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.hw-q {
  display: flex;
  gap: var(--space-3);
  font-size: var(--font-label);
  line-height: var(--line-height-snug);
}

.hw-q-num {
  width: 40rpx;
  height: 40rpx;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: var(--color-primary-container);
  color: var(--color-on-primary-container);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-bold);
  display: flex;
  align-items: center;
  justify-content: center;
}

.hw-q-text {
  flex: 1;
  color: var(--color-text-secondary);
}

.hw-more {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
  font-style: italic;
}

.footer {
  display: flex;
  justify-content: center;
  padding-top: var(--space-4);
  border-top: 2rpx solid var(--color-outline-variant);
}
</style>
