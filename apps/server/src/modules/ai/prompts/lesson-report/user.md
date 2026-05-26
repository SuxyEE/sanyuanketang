请基于以下「师渊课堂」一节实时课堂的全量原始数据，按系统提示词约定的 6 个章节格式，生成完整的课堂分析报告。

## 1. 课堂元信息

- **课程名称**：{{courseName}}
- **本节课题**：{{lessonTitle}}
- **课堂码**：{{roomCode}}
- **开课时间**：{{startedAt}}
- **本节时长**：{{durationMinutes}} 分钟

## 2. 学生与出勤

- **应到学生总数**：{{totalStudents}}
- **在线学生数（实时）**：{{onlineCount}}
- **签到学生（{{attendanceCount}} / {{totalStudents}}）**：
  ```
  {{attendanceList}}
  ```
- **未签到学生**（如有）：
  ```
  {{unsignedList}}
  ```

## 3. 学生互动行为

- **本节累计举手次数**：{{handRaiseCount}}
- **学生 AI 提问次数**：{{aiChatCount}}
- **学生提问列表**（最近 20 条）：
  ```
  {{questionsList}}
  ```

## 4. 抢答互动

- **抢答轮次**：{{competeRounds}}
- **抢答题目与优胜者**：
  ```
  {{competeList}}
  ```

## 5. 测验数据

- **测验场次**：{{quizCount}}
- **测验汇总**：
  ```
  {{quizSummary}}
  ```
- **知识点掌握度（按掌握度从低到高）**：
  ```
  {{knowledgeMastery}}
  ```
- **错误率最高的 5 道题**：
  ```
  {{topErrorQuestions}}
  ```

## 6. 分组讨论

- **分组次数**：{{discussionCount}}
- **分组讨论列表**：
  ```
  {{discussionList}}
  ```

## 7. AI 教学辅助使用

- **AI 板书生成次数**：{{whiteboardCount}}（主题：{{whiteboardTopics}}）
- **AI 实践推送次数**：{{practiceCount}}（主题：{{practiceTopics}}）
- **AI 课件生成次数**：{{coursewareCount}}

## 8. 课件覆盖

- **课件页数**：{{slideTotalPages}}
- **教师当前推进到第 {{slideCurrentPage}} 页**

## 9. 屏幕管控

- **锁屏次数**：{{lockCount}}
- **学生注意力溜走（切走应用）次数**：{{focusLostCount}}

---

请严格按系统提示词规定的 6 个章节、每节的写作要求，生成完整 Markdown 报告。**不要省略任何章节**，即使某项数据为 0 也要说明现状并给改进建议。
