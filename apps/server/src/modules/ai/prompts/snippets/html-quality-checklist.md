## HTML 沙盘交付前自检（每一条不通过就重写）

1. **是单文件 HTML？** —— `<!DOCTYPE html><html>…</html>` 完整结构
2. **零外网依赖？** —— 没有任何 `https://` / `http://` 开头的 `src` / `href`
3. **`<script>` 标签是否存在且含真实代码？** —— 不能只有 HTML+CSS。每个 `<button>` / `<input type="range">` / `<input type="checkbox">` / `<canvas>` 都必须在 JS 里被 `addEventListener` 绑了真实回调或被赋值，**否则学生点了纯摆设**
4. **JS 里的 `getContext(` 都对应 `<canvas>` 标签？** —— 不能是 `<svg>` 也不能是 `<div>`。SVG 容器必须叫 `scene` / `board` / `chart` / `plot`，绝对不允许给 `<svg>` 元素起 `id="canvas"`
5. **所有 CSS class selector 都带 `.` 前缀？** —— `.card-wrap { ... }` 而不是 `card-wrap { ... }`
6. **触摸目标 ≥ 44×44px？** —— 按钮 padding 充足，slider thumb 自定义到 24×24px 以上
7. **变量名不能误导自己** —— 拿 `<svg>` 用 `const scene = …`，不要用 `const canvas = document.getElementById('scene')`
8. **没有 `eval` / `new Function` / `document.write` / `fetch` / `XMLHttpRequest`** —— 都会被服务端清洗器警告
9. **没有 inline event 属性**（`onclick="…"` / `onload="…"`） —— 用 `addEventListener` 替代，否则会被清洗掉
10. **没有嵌套 `<iframe>`**（已经在 iframe 里了）
11. **响应参数变化 ≤ 60ms 给学生反馈** —— 用 `requestAnimationFrame` 或 CSS transition，不要 `setTimeout(500)`
