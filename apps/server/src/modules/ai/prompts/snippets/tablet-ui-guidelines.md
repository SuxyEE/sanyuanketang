## 平板 UI 通用规范

- **触摸目标**：所有可交互元素（按钮 / 滑块 thumb / 复选框 / 选项卡）**最小尺寸 44×44px**
- **滑块手感**：`input[type=range]` 必须自定义 `::-webkit-slider-thumb` 把圆点放大到 24×24px，否则平板上几乎按不到
- **字号**：正文 ≥ 14px，标题 ≥ 18px，标签 ≥ 12px；不允许 10px 以下
- **配色对比度**：正文文字与背景的明度差 ≥ 4.5:1（WCAG AA），不要白底浅灰字
- **字体栈**：`system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif` —— 兼容 iPad / Android 平板 / Win 平板
- **响应式**：根容器 `width:100%; max-width:none`，所有内部用 flex/grid，不允许写死 `width:1280px`
- **过渡动画**：状态切换用 `transition: 0.2s ease`，避免突然跳变
- **不要弹** `alert / confirm / prompt`（在 iframe 里看起来很糟）
- **不要做** 跳出 iframe 的操作（`window.open` / `location.href = ...`）
