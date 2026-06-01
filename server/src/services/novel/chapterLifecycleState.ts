/**
 * 章节存在两套并行字段：`generationState`（流水线语义）与 `chapterStatus`（运营/编辑器语义）。
 * 本模块集中表达「在同一写路径下宜同时提交的成对取值」，避免出现「已通过审校但未标完成」之类漂移。
 */

export type PipelineGenerationState = "planned" | "drafted" | "reviewed" | "repaired" | "approved" | "published";

export type OperationalChapterStatus =
  | "unplanned"
  | "pending_generation"
  | "generating"
  | "pending_review"
  | "needs_repair"
  | "completed";

export interface ChapterStatePairPatch {
  generationState?: PipelineGenerationState;
  chapterStatus?: OperationalChapterStatus;
}

/**
 * 审校结束时与 `novelCoreReviewService` 对齐：已通过则收尾为完成，否则待修复。
 */
export function chapterStatePairAfterManualQualityReview(pass: boolean): ChapterStatePairPatch {
  return {
    generationState: "reviewed",
    chapterStatus: pass ? "completed" : "needs_repair",
  };
}

/**
 * 流水线在某次循环内将章节标为已通过（自动审校跳过或达标）时的推荐成对取值。
 */
export function chapterStatePairAfterPipelineApproval(): ChapterStatePairPatch {
  return {
    generationState: "approved",
    chapterStatus: "completed",
  };
}

/**
 * 将 `generationState` 升为 `approved` 时，顺带保证 `chapterStatus` 与用户可见「已完成」一致。
 * 对已处于 `generationState === "approved"` 的更新可安全重复调用。
 */
export function mergeChapterPatchForGenerationStateBump(
  current: ChapterStatePairPatch | undefined,
  nextGenerationState: PipelineGenerationState,
): ChapterStatePairPatch {
  const base: ChapterStatePairPatch = { ...(current ?? {}) };

  base.generationState = nextGenerationState;

  if (nextGenerationState === "approved") {
    base.chapterStatus = "completed";
  }

  return base;
}
