/**
 * SVG 图标库 · Lucide 风格
 *
 * 设计规范：
 *   - viewBox 0 0 24 24
 *   - fill="none"  stroke="currentColor"  stroke-width="2"
 *   - stroke-linecap="round"  stroke-linejoin="round"
 *   - 与「Icon.vue」配合使用，color/size 通过 CSS 控制
 *
 * 致敬 Lucide（lucide.dev，ISC license）。
 */

export type IconName =
  | 'logo'
  | 'graduation-cap'
  | 'hand'
  | 'help-circle'
  | 'notebook'
  | 'sparkles'
  | 'lock'
  | 'unlock'
  | 'megaphone'
  | 'x'
  | 'book-open'
  | 'monitor'
  | 'flame'
  | 'send'
  | 'trophy'
  | 'brain'
  | 'bar-chart'
  | 'radio-tower'
  | 'wifi'
  | 'wifi-off'
  | 'clock'
  | 'volume-2'
  | 'stop-circle'
  | 'check-circle'
  | 'hourglass'
  | 'file-text'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'trash'
  | 'arrow-left'
  | 'arrow-right'
  | 'plus'
  | 'check'
  | 'info'
  | 'alert-circle'
  | 'users'
  | 'user'
  | 'message-circle'
  | 'message-square'
  | 'download'
  | 'zap'
  | 'tv'
  | 'play'
  | 'pause'
  | 'sparkle-dot'
  | 'rocket'
  | 'party-popper'
  | 'copy'
  | 'pen-tool'
  | 'trash-2'
  | 'refresh-cw'
  | 'image'

const wrap = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

export const icons: Record<IconName, string> = {
  // 三元课堂自有 logo（蓝底白「三」字圆角方标，与四端 favicon 一致）
  logo:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="5.5" fill="#2563eb"/><text x="12" y="17.4" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="bold" fill="#ffffff">三</text></svg>',

  'graduation-cap': wrap(
    '<path d="M22 10v6"/><path d="M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5"/>',
  ),

  // 举手
  hand: wrap(
    '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 11V4a2 2 0 0 0-4 0v7"/><path d="M10 11V6a2 2 0 1 0-4 0v9"/><path d="M18 8a2 2 0 1 1 4 0v5a8 8 0 0 1-8 8h-2c-2.8 0-4-1-5-2l-3-5c-.4-.7-.2-1.7.5-2.1l.4-.2c.8-.5 1.8-.2 2.3.6l1.8 3"/>',
  ),

  'help-circle': wrap(
    '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  ),

  notebook: wrap(
    '<path d="M4 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z"/><path d="M2 6h2"/><path d="M2 10h2"/><path d="M2 14h2"/><path d="M2 18h2"/><line x1="9" y1="6" x2="15" y2="6"/><line x1="9" y1="10" x2="15" y2="10"/>',
  ),

  // AI / 生成式 — 四角闪光
  sparkles: wrap(
    '<path d="M9.94 14.06 12 20l2.06-5.94L20 12l-5.94-2.06L12 4 9.94 9.94 4 12z"/><path d="M19 3v4"/><path d="M21 5h-4"/><path d="M5 19v2"/><path d="M6 20H4"/>',
  ),

  lock: wrap(
    '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  ),

  unlock: wrap(
    '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  ),

  megaphone: wrap(
    '<path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  ),

  x: wrap('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),

  'book-open': wrap(
    '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  ),

  monitor: wrap(
    '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  ),

  flame: wrap(
    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  ),

  // 发送 / 出击
  send: wrap('<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>'),

  trophy: wrap(
    '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  ),

  brain: wrap(
    '<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z"/>',
  ),

  'bar-chart': wrap(
    '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
  ),

  'radio-tower': wrap(
    '<path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9"/><path d="M7.8 4.7a6.14 6.14 0 0 0-.8 7.5"/><circle cx="12" cy="9" r="2"/><path d="M16.2 4.8c2 2 2.26 5.11.8 7.47"/><path d="M19.1 1.9a9.96 9.96 0 0 1 0 14.1"/><path d="M9.5 18h5L13 22h-2z"/>',
  ),

  wifi: wrap(
    '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  ),

  'wifi-off': wrap(
    '<line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  ),

  clock: wrap('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),

  'volume-2': wrap(
    '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  ),

  'stop-circle': wrap('<circle cx="12" cy="12" r="10"/><rect x="9" y="9" width="6" height="6"/>'),

  'check-circle': wrap(
    '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  ),

  hourglass: wrap(
    '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
  ),

  'file-text': wrap(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
  ),

  'chevron-left': wrap('<polyline points="15 18 9 12 15 6"/>'),
  'chevron-right': wrap('<polyline points="9 18 15 12 9 6"/>'),
  'chevron-down': wrap('<polyline points="6 9 12 15 18 9"/>'),
  trash: wrap(
    '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
  ),
  'arrow-left': wrap(
    '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  ),
  'arrow-right': wrap(
    '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  ),

  plus: wrap('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),

  check: wrap('<polyline points="20 6 9 17 4 12"/>'),

  info: wrap(
    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  ),

  'alert-circle': wrap(
    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  ),

  users: wrap(
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  ),

  user: wrap(
    '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  ),

  'message-circle': wrap(
    '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  ),

  'message-square': wrap('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),

  download: wrap(
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  ),

  zap: wrap('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),

  tv: wrap(
    '<rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/>',
  ),

  play: wrap('<polygon points="5 3 19 12 5 21 5 3"/>'),
  pause: wrap('<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'),

  // 火花一点（AI 输入中）
  'sparkle-dot': wrap(
    '<path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="M5.6 5.6l2.1 2.1"/><path d="M16.3 16.3l2.1 2.1"/><path d="M5.6 18.4l2.1-2.1"/><path d="M16.3 7.7l2.1-2.1"/>',
  ),

  rocket: wrap(
    '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  ),

  // 庆祝（课后页）
  'party-popper': wrap(
    '<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-1.5-.75c-.87-.45-1.94-.08-2.31.79l-.27.65c-.36.85-1.45 1.06-2.07.4l-.74-.79c-.62-.66-1.71-.45-2.06.41l-.36.86c-.4.95-1.72 1.06-2.27.18l-1.6-2.55"/><path d="M16.4 16.4 21 21"/>',
  ),

  copy: wrap(
    '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  ),

  'pen-tool': wrap(
    '<path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
  ),

  'trash-2': wrap(
    '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  ),

  'refresh-cw': wrap(
    '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/>',
  ),

  image: wrap(
    '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  ),
}
