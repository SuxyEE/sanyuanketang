## HTML 沙盘 4 大子类型（按知识点性质选择，不要混用）

### Type A · 物理/数学模拟器（参数化方程实时画）
- 适合：几何（勾股 / 余弦定理 / 抛物线）、运动学（弹簧 / 单摆 / 平抛）、信号（正弦波叠加）
- 控件：**滑块** ×2~4（每个绑一个公式参数）
- 可视化：**优先 SVG**（用 `<path>` 的 `d` 属性动态拼字符串）
- 数据流：`slider.input → 更新 state → setAttribute('d', newPath)`
- 例：`d = "M0,150 Q200," + (150 - amplitude) + " 400,150"` 拼出抛物线

### Type B · 离散逻辑/电路/状态机（点击改变 state）
- 适合：PLC 梯形图、数字电路（与或非门）、状态机演示、化学配平
- 控件：**按钮 / 开关** ×N（每个切换一个布尔）
- 可视化：**SVG `<rect>` / `<line>` + fill/stroke 切色**，灯亮就 `fill: #faad14`
- 数据流：`button.click → toggleState → setAttribute('fill', state ? on : off)`

### Type C · 数据采样/统计/图表
- 适合：传感器读数模拟、统计分布、信号采样定理演示
- 控件：**采样率 / 量程 滑块**
- 可视化：**SVG `<polyline>` 实时拼点**，超出窗口的旧点 shift 掉
- 数据流：`setInterval(20) → 推新点 → 重绘 polyline`

### Type D · 几何/CAD 操作（拖拽顶点）
- 适合：三角形 / 多边形性质演示、CAD 基础约束
- 控件：**可拖动的 SVG `<circle>` 顶点**（mousedown/touchstart 后 mousemove/touchmove 更新坐标）
- 可视化：**SVG `<polygon>`**，顶点是 `<circle r=8>` 半径稍大易点
- 数据流：`circle.pointerdown → captureMove → polygon.setAttribute('points', ...)`

## 通用模式：开局先写 3 行设计纲要

在写 HTML 之前，**先在脑子里**回答这 3 个问题（不必输出，但务必想清楚再开写）：

1. **要传达的知识点是什么？**（一句话）
2. **学生通过哪 1~3 个动作来体验它？**（"拖滑块 a / 拖滑块 b / 按重置"）
3. **画面里哪些元素会随动作变化？**（"三角形顶点位置 / 三边长度数字 / 公式右侧 c²的值"）

只有这 3 个想清楚，下面的代码才不会跑偏。
