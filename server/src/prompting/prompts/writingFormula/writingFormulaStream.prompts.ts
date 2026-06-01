import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { PromptAsset } from "../../core/promptTypes";

export interface WritingFormulaExtractStreamInput {
  extractLevel: "basic" | "standard" | "deep";
  focusAreas: string[];
  sourceText: string;
}

export interface WritingFormulaApplyRewriteStreamInput {
  formulaContent: string;
  sourceText: string;
}

export interface WritingFormulaApplyGenerateStreamInput {
  formulaContent: string;
  topic: string;
  targetLength: number;
}

/** 从样例文本流式提取可复现写作公式（Markdown 结构）。 */
export const writingFormulaExtractStreamPrompt: PromptAsset<WritingFormulaExtractStreamInput, string, string> = {
  id: "writingFormula.extract.stream",
  version: "v1",
  taskType: "planner",
  mode: "text",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  render: (input) => [
    new SystemMessage(
      `你是一个专业的写作风格分析专家，能够深度解析文学作品的创作技巧。
请对文本进行 ${input.extractLevel} 级别分析，重点关注：${input.focusAreas.join(", ")}。
输出格式（Markdown）：
## 整体风格定位
## 核心写作技巧（含原文例句）
## 可复现的写作公式
## 应用指南（如何用这个公式写新文本）`,
    ),
    new HumanMessage(input.sourceText),
  ],
};

/** 按给定公式改写原文。 */
export const writingFormulaApplyRewriteStreamPrompt: PromptAsset<
  WritingFormulaApplyRewriteStreamInput,
  string,
  string
> = {
  id: "writingFormula.apply.rewrite.stream",
  version: "v1",
  taskType: "writer",
  mode: "text",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  render: (input) => [
    new SystemMessage(
      "你是一位专业的写作助手。请严格按照以下写作公式，对给定文本进行改写。要求：保持原文核心意思不变，但文风、节奏、句式按照公式重塑。",
    ),
    new HumanMessage(`写作公式：\n${input.formulaContent}\n\n原文：\n${input.sourceText}`),
  ],
};

/** 按给定公式围绕主题创作新内容。 */
export const writingFormulaApplyGenerateStreamPrompt: PromptAsset<
  WritingFormulaApplyGenerateStreamInput,
  string,
  string
> = {
  id: "writingFormula.apply.generate.stream",
  version: "v1",
  taskType: "writer",
  mode: "text",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 0,
  },
  render: (input) => [
    new SystemMessage(
      `你是一位专业的写作助手。请严格按照以下写作公式，围绕给定主题创作新内容。
要求：字数控制在 ${input.targetLength} 字左右，每个段落都体现公式核心特征。`,
    ),
    new HumanMessage(`写作公式：\n${input.formulaContent}\n\n创作主题：\n${input.topic}`),
  ],
};
