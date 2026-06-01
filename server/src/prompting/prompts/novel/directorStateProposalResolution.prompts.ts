import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { DirectorStateProposalResolution } from "@ai-novel/shared/types/stateProposalResolution";
import { directorStateProposalResolutionSchema } from "@ai-novel/shared/types/stateProposalResolution";
import type { PromptAsset } from "../../core/promptTypes";

export interface DirectorStateProposalResolutionPromptInput {
  runMode: string;
  novelId: string;
  taskId?: string | null;
  chapterId?: string | null;
  chapterOrder?: number | null;
  proposalsJson: string;
  canonicalStateJson: string;
  protectedContentJson: string;
}

export const directorStateProposalResolutionPrompt: PromptAsset<
  DirectorStateProposalResolutionPromptInput,
  DirectorStateProposalResolution
> = {
  id: "director.state_proposal_resolution",
  version: "v1",
  taskType: "planner",
  mode: "structured",
  language: "zh",
  contextPolicy: {
    maxTokensBudget: 2600,
    preferredGroups: ["canonical_state", "state_proposals", "protected_content"],
    dropOrder: ["protected_content"],
  },
  outputSchema: directorStateProposalResolutionSchema,
  repairPolicy: { maxAttempts: 1 },
  render: (input) => [
    new SystemMessage([
      "你是长篇小说自动导演的状态提案解析器。",
      "你的任务是判断 pending state proposal 在全书自动成书模式下应该自动应用、暂存归档、触发当前窗口重规划，还是必须交给人工恢复。",
      "只输出严格 JSON，不要 Markdown、解释或额外文本。",
      "",
      "【决策边界】",
      "1. information_disclosure：可信且不冲突时 decision=apply；只影响远期可先归档时 decision=defer。",
      "2. relation_state_update：与 canonical state 明显冲突或会改变后续章节承诺时 decision=auto_replan_window。",
      "3. character_resource_update：资源事实可信且不冲突时 decision=apply；证据不足时 decision=defer。",
      "4. 涉及用户手写保护内容、数据安全、无法判断真伪或会覆盖受保护正文时 decision=manual_required。",
      "5. confidence 低于 0.65 时必须 decision=manual_required。",
      "6. affectedChapterWindow 用最小受影响范围；无法判断时用当前章。",
      "7. proposalIds 只能列输入里存在的 proposal id。",
      "8. reason 要让新手用户能看懂系统为什么这样处理。",
    ].join("\n")),
    new HumanMessage([
      `运行模式：${input.runMode}`,
      `小说 ID：${input.novelId}`,
      `任务 ID：${input.taskId ?? "无"}`,
      `当前章节 ID：${input.chapterId ?? "无"}`,
      `当前章节序号：${input.chapterOrder ?? "未知"}`,
      "",
      "【待解析状态提案】",
      input.proposalsJson,
      "",
      "【canonical state 摘要】",
      input.canonicalStateJson,
      "",
      "【受保护内容边界】",
      input.protectedContentJson,
      "",
      "请输出状态提案解析 JSON。",
    ].join("\n")),
  ],
};

