import type {
  DirectorArtifactRef,
  DirectorPolicyDecision,
  DirectorPolicyMode,
  DirectorRuntimePolicySnapshot,
  DirectorQualityGateResult,
} from "@ai-novel/shared/types/directorRuntime";
import { buildDefaultDirectorPolicy } from "./directorRuntimeDefaults";

type DirectorPolicyRiskTag = DirectorPolicyDecision["riskTags"][number];

export interface DirectorPolicyRequest {
  mode?: DirectorPolicyMode;
  policy?: DirectorRuntimePolicySnapshot | null;
  action: "analyze" | "run_node" | "repair" | "overwrite" | "auto_continue";
  reads?: string[];
  writes?: string[];
  targetType?: DirectorArtifactRef["targetType"] | null;
  targetId?: string | null;
  affectedArtifacts?: DirectorArtifactRef[];
  mayOverwriteUserContent?: boolean;
  requiresApprovalByDefault?: boolean;
  isExpensiveReview?: boolean;
  mayRecomputeDownstream?: boolean;
  isLargeScopeAutoRun?: boolean;
  qualityGateResult?: DirectorQualityGateResult | null;
}

const DOWNSTREAM_RECOMPUTE_WRITE_TYPES = new Set([
  "story_macro",
  "book_contract",
  "character_cast",
  "volume_strategy",
  "chapter_task_sheet",
]);

const EXPENSIVE_REVIEW_WRITE_TYPES = new Set([
  "audit_report",
  "rolling_window_review",
]);

function hasProtectedUserContent(artifacts: DirectorArtifactRef[] | undefined): boolean {
  return (artifacts ?? []).some((artifact) => (
    artifact.status === "active"
    && (artifact.source === "user_edited" || artifact.protectedUserContent === true)
  ));
}

function hasMatchingWrite(writes: string[] | undefined, targets: Set<string>): boolean {
  return (writes ?? []).some((write) => targets.has(write));
}

function affectsExistingArtifacts(artifacts: DirectorArtifactRef[] | undefined): boolean {
  return (artifacts ?? []).some((artifact) => artifact.status === "active" || artifact.status === "stale");
}

function uniqueTags(tags: DirectorPolicyRiskTag[]): DirectorPolicyRiskTag[] {
  return [...new Set(tags)];
}

function buildDecision(input: {
  canRun: boolean;
  requiresApproval: boolean;
  gateType: DirectorPolicyDecision["gateType"];
  reason: string;
  mayOverwriteUserContent: boolean;
  affectedArtifacts: string[];
  riskTags?: DirectorPolicyRiskTag[];
  autoRetryBudget?: number;
  onQualityFailure: DirectorPolicyDecision["onQualityFailure"];
}): DirectorPolicyDecision {
  return {
    canRun: input.canRun,
    requiresApproval: input.requiresApproval,
    gateType: input.gateType,
    reason: input.reason,
    mayOverwriteUserContent: input.mayOverwriteUserContent,
    affectedArtifacts: input.affectedArtifacts,
    riskTags: uniqueTags(input.riskTags ?? []),
    autoRetryBudget: input.autoRetryBudget ?? 0,
    onQualityFailure: input.onQualityFailure,
  };
}

export class DirectorPolicyEngine {
  decide(input: DirectorPolicyRequest): DirectorPolicyDecision {
    const policy = input.policy ?? buildDefaultDirectorPolicy(input.mode);
    const affectedArtifacts = (input.affectedArtifacts ?? []).map((artifact) => artifact.id);
    const affectsProtectedUserContent = hasProtectedUserContent(input.affectedArtifacts);
    const mayTouchUserContent = Boolean(input.mayOverwriteUserContent)
      || input.action === "overwrite"
      || affectsProtectedUserContent;
    const isExpensiveReview = Boolean(input.isExpensiveReview)
      || hasMatchingWrite(input.writes, EXPENSIVE_REVIEW_WRITE_TYPES);
    const mayRecomputeDownstream = Boolean(input.mayRecomputeDownstream)
      || (
        hasMatchingWrite(input.writes, DOWNSTREAM_RECOMPUTE_WRITE_TYPES)
        && affectsExistingArtifacts(input.affectedArtifacts)
      );
    const isLargeScopeAutoRun = Boolean(input.isLargeScopeAutoRun)
      || (
        (input.action === "auto_continue" || policy.mode === "run_until_gate" || policy.mode === "auto_safe_scope")
        && input.targetType !== "chapter"
        && hasMatchingWrite(input.writes, new Set(["chapter_draft"]))
      );

    if (input.action === "analyze") {
      return buildDecision({
        canRun: true,
        requiresApproval: false,
        gateType: "none",
        reason: "工作区分析不会写入小说内容，可以直接执行。",
        mayOverwriteUserContent: false,
        affectedArtifacts,
        onQualityFailure: "continue_with_risk",
      });
    }

    if (input.qualityGateResult?.status === "blocked_scope") {
      return buildDecision({
        canRun: false,
        requiresApproval: true,
        gateType: "blocked_scope",
        reason: input.qualityGateResult.reason,
        mayOverwriteUserContent: mayTouchUserContent,
        affectedArtifacts,
        riskTags: ["quality_blocked_scope"],
        onQualityFailure: "block_scope",
      });
    }

    if (affectsProtectedUserContent && !policy.mayOverwriteUserContent) {
      return buildDecision({
        canRun: false,
        requiresApproval: true,
        gateType: "approval",
        reason: "该动作会影响用户已经编辑或保护的内容，需要确认后才能继续。",
        mayOverwriteUserContent: true,
        affectedArtifacts,
        riskTags: ["protected_user_content"],
        onQualityFailure: "pause_for_manual",
      });
    }

    if (policy.mode === "suggest_only") {
      return buildDecision({
        canRun: false,
        requiresApproval: true,
        gateType: "approval",
        reason: "当前是只给建议模式，写入动作需要确认后才能执行。",
        mayOverwriteUserContent: mayTouchUserContent,
        affectedArtifacts,
        riskTags: ["suggest_only"],
        onQualityFailure: "pause_for_manual",
      });
    }

    if (isExpensiveReview && !policy.allowExpensiveReview) {
      return buildDecision({
        canRun: false,
        requiresApproval: true,
        gateType: "approval",
        reason: "该动作会触发较高成本的审校，需要确认后才能执行。",
        mayOverwriteUserContent: mayTouchUserContent,
        affectedArtifacts,
        riskTags: ["expensive_review"],
        onQualityFailure: "pause_for_manual",
      });
    }

    if (input.requiresApprovalByDefault && policy.mode !== "auto_safe_scope") {
      return buildDecision({
        canRun: false,
        requiresApproval: true,
        gateType: "approval",
        reason: "该步骤默认需要确认，当前策略不会自动执行。",
        mayOverwriteUserContent: mayTouchUserContent,
        affectedArtifacts,
        riskTags: ["default_approval"],
        onQualityFailure: "pause_for_manual",
      });
    }

    if (mayRecomputeDownstream && policy.mode !== "auto_safe_scope") {
      return buildDecision({
        canRun: false,
        requiresApproval: true,
        gateType: "approval",
        reason: "该动作会重算上游规划，并可能影响后续章节或产物，需要确认后继续。",
        mayOverwriteUserContent: mayTouchUserContent,
        affectedArtifacts,
        riskTags: ["downstream_recompute"],
        onQualityFailure: "pause_for_manual",
      });
    }

    if (isLargeScopeAutoRun && policy.mode !== "auto_safe_scope") {
      return buildDecision({
        canRun: false,
        requiresApproval: true,
        gateType: "approval",
        reason: "该动作会自动推进较大范围的章节生成，需要确认后才能继续。",
        mayOverwriteUserContent: mayTouchUserContent,
        affectedArtifacts,
        riskTags: ["large_scope_auto_run"],
        onQualityFailure: "pause_for_manual",
      });
    }

    if (input.qualityGateResult?.status === "repairable") {
      return buildDecision({
        canRun: true,
        requiresApproval: false,
        gateType: "none",
        reason: "质量问题可自动修复一次。",
        mayOverwriteUserContent: mayTouchUserContent,
        affectedArtifacts,
        riskTags: ["quality_repair"],
        autoRetryBudget: 1,
        onQualityFailure: "repair_once",
      });
    }

    if (input.qualityGateResult?.status === "needs_manual_repair") {
      return buildDecision({
        canRun: false,
        requiresApproval: true,
        gateType: "approval",
        reason: "质量问题需要人工修复或确认后继续。",
        mayOverwriteUserContent: mayTouchUserContent,
        affectedArtifacts,
        riskTags: ["quality_manual_repair"],
        onQualityFailure: "pause_for_manual",
      });
    }

    if (input.qualityGateResult?.status === "continue_with_risk") {
      return buildDecision({
        canRun: policy.mode === "auto_safe_scope",
        requiresApproval: policy.mode !== "auto_safe_scope",
        gateType: policy.mode === "auto_safe_scope" ? "none" : "approval",
        reason: "该问题不会破坏后续推进，但会记录风险供后续处理。",
        mayOverwriteUserContent: mayTouchUserContent,
        affectedArtifacts,
        riskTags: ["continue_with_risk"],
        onQualityFailure: "continue_with_risk",
      });
    }

    return buildDecision({
      canRun: true,
      requiresApproval: false,
      gateType: "none",
      reason: "当前策略允许执行该动作。",
      mayOverwriteUserContent: mayTouchUserContent,
      affectedArtifacts,
      autoRetryBudget: input.action === "repair" ? 1 : 0,
      onQualityFailure: input.action === "repair" ? "repair_once" : "continue_with_risk",
      riskTags: input.action === "repair" ? ["quality_repair"] : [],
    });
  }
}
