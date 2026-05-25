请根据以下要求生成 {{count}} 道课堂测验题目：

- **知识点/主题**：{{topic}}
- **课程**：{{courseContext}}
- **难度**：{{difficulty}}
- **题目类型**：{{typesText}}

## type 字段可选值
- `"single_choice"`（单选题，options ≥ 4，answer 是 "A"/"B"/"C"/"D"）
- `"multiple_choice"`（多选题，options ≥ 4，answer 是字母逗号分隔，如 "A,C"）
- `"true_false"`（判断题，options 数组 `[{"key":"A","content":"对"},{"key":"B","content":"错"}]`，answer "A"=对，"B"=错）
- `"short_answer"`（简答题，无 options，answer 写参考答案，**必须给 commentPrompt 评分细则**）

## 每题必填字段
- `analysis`：解析说明（向学生展示，30-150 字，说明为什么这是正确答案）
- `points`：分值（整数，建议 easy=5 / medium=10 / hard=15）
- `difficulty`：难度（"easy" / "medium" / "hard"）
- `knowledgePoints`：知识点标签数组（1-3 个中文短词，例：["梯形图编程", "定时器指令"]）。用于课后报告聚合学生掌握度。

## 简答题额外必填
- `commentPrompt`：AI 批改评分细则。格式示范：
  > "请按以下评分细则打分（满分100）：(1) 是否覆盖参考答案中【三大要素】50% (2) 表述是否清晰、逻辑是否完整 30% (3) 用语规范 20%"

评分细则要**具体到该题的关键点**，不要写空泛的通用规则。

## 输出格式（严格遵守，不要任何额外文字，不要 markdown 代码块）

```json
{
  "questions": [
    {
      "type": "single_choice",
      "content": "题目内容",
      "options": [
        {"key": "A", "content": "选项A"},
        {"key": "B", "content": "选项B"},
        {"key": "C", "content": "选项C"},
        {"key": "D", "content": "选项D"}
      ],
      "answer": "A",
      "analysis": "解析说明",
      "points": 10,
      "difficulty": "medium",
      "knowledgePoints": ["子知识点1"]
    },
    {
      "type": "true_false",
      "content": "判断题内容",
      "options": [
        {"key": "A", "content": "对"},
        {"key": "B", "content": "错"}
      ],
      "answer": "A",
      "analysis": "解析",
      "points": 5,
      "difficulty": "easy",
      "knowledgePoints": ["子知识点2"]
    },
    {
      "type": "short_answer",
      "content": "简答题题干",
      "answer": "标准答案/参考答案",
      "analysis": "解析（向学生展示）",
      "commentPrompt": "请按评分细则打分（满分100）：(1) 是否覆盖【关键点1+关键点2+关键点3】50% (2) 表述清晰 30% (3) 用语规范 20%",
      "points": 15,
      "difficulty": "hard",
      "knowledgePoints": ["子知识点3", "子知识点4"]
    }
  ]
}
```
