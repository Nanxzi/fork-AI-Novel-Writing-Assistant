import type {
  DirectorBookAutomationAction,
  DirectorBookAutomationDisplayState,
  DirectorBookAutomationProjection,
} from "@ai-novel/shared/types/directorRuntime";
import { getDirectorNodeDisplayLabel } from "@ai-novel/shared/types/directorRuntime";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  History,
  PauseCircle,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AICockpitProps {
  projection?: DirectorBookAutomationProjection | null;
  mode?: "focusedNovel" | "compact";
  fallbackSummary?: string | null;
  fallbackStatusLabel?: string | null;
  isActionPending?: boolean;
  showDetailsAction?: boolean;
  onAction?: (projection: DirectorBookAutomationProjection, action: DirectorBookAutomationAction) => void;
  onOpenDetails?: (projection: DirectorBookAutomationProjection) => void;
  onOpenNovel?: (projection: DirectorBookAutomationProjection) => void;
  onOpenFallbackDetails?: () => void;
}

function displayStateLabel(state: DirectorBookAutomationDisplayState): string {
  const labels: Record<DirectorBookAutomationDisplayState, string> = {
    processing: "AI 正在处理",
    needs_confirmation: "等你确认",
    paused: "已暂停",
    needs_attention: "出错需处理",
    completed: "已完成",
    idle: "未开启",
  };
  return labels[state];
}

function stateBadgeVariant(state: DirectorBookAutomationDisplayState): "default" | "secondary" | "outline" | "destructive" {
  if (state === "needs_attention") {
    return "destructive";
  }
  if (state === "processing") {
    return "default";
  }
  if (state === "needs_confirmation" || state === "paused") {
    return "outline";
  }
  return "secondary";
}

function stateClassName(state: DirectorBookAutomationDisplayState): string {
  if (state === "processing") {
    return "border-sky-200 bg-sky-50/70";
  }
  if (state === "needs_confirmation") {
    return "border-amber-200 bg-amber-50/70";
  }
  if (state === "paused") {
    return "border-indigo-200 bg-indigo-50/60";
  }
  if (state === "needs_attention") {
    return "border-destructive/30 bg-destructive/5";
  }
  if (state === "completed") {
    return "border-emerald-200 bg-emerald-50/60";
  }
  return "border-border/70 bg-muted/20";
}

function stateIcon(state: DirectorBookAutomationDisplayState) {
  if (state === "processing") {
    return <Activity className="h-4 w-4" />;
  }
  if (state === "needs_confirmation") {
    return <PauseCircle className="h-4 w-4" />;
  }
  if (state === "paused") {
    return <Clock3 className="h-4 w-4" />;
  }
  if (state === "needs_attention") {
    return <AlertTriangle className="h-4 w-4" />;
  }
  if (state === "completed") {
    return <CheckCircle2 className="h-4 w-4" />;
  }
  return <ShieldCheck className="h-4 w-4" />;
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "暂无";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "暂无";
  }
  return date.toLocaleString();
}

function formatTokenCount(value: number | null | undefined): string {
  const count = Math.max(0, Math.round(Number(value ?? 0)));
  return count.toLocaleString();
}

function formatDuration(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  const seconds = Math.round(value / 1000);
  if (seconds <= 0) {
    return "<1 秒";
  }
  if (seconds < 60) {
    return `${seconds} 秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  return restSeconds > 0 ? `${minutes} 分 ${restSeconds} 秒` : `${minutes} 分`;
}

function formatUsageLine(usage: {
  llmCallCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs?: number | null;
}): string {
  const duration = formatDuration(usage.durationMs);
  return [
    `${formatTokenCount(usage.llmCallCount)} 次调用`,
    `输入 ${formatTokenCount(usage.promptTokens)}`,
    `输出 ${formatTokenCount(usage.completionTokens)}`,
    `总计 ${formatTokenCount(usage.totalTokens)} Tokens`,
    duration ? `累计调用耗时 ${duration}` : null,
  ].filter(Boolean).join(" · ");
}

function fallbackProjectionReason(props: Pick<AICockpitProps, "fallbackSummary">): string {
  return props.fallbackSummary?.trim() || "没有需要你处理的 AI 自动推进任务。";
}

function renderActionLabel(
  action: DirectorBookAutomationAction,
  displayState?: DirectorBookAutomationDisplayState,
): string {
  if (
    displayState === "needs_confirmation"
    && (action.type === "continue" || action.type === "auto_execute_range")
  ) {
    return "确认并继续";
  }
  return action.label || "继续处理";
}

function artifactTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    book_contract: "书级约定",
    story_macro: "故事规划",
    character_cast: "角色",
    volume_strategy: "分卷",
    chapter_task_sheet: "任务单",
    chapter_draft: "正文",
    audit_report: "审校",
    repair_ticket: "修复",
    reader_promise: "读者承诺",
    character_governance_state: "角色状态",
    world_skeleton: "世界框架",
    source_knowledge_pack: "资料包",
    chapter_retention_contract: "留存约定",
    continuity_state: "连续性",
    rolling_window_review: "近期复盘",
  };
  return labels[type] ?? type;
}

function recoveryActionLabel(
  action: NonNullable<DirectorBookAutomationProjection["circuitBreaker"]>["recoveryAction"],
): string | null {
  const labels: Record<string, string> = {
    retry: "重试当前步骤",
    resume_after_review: "查看原因后继续",
    switch_model: "切换模型后继续",
    confirm_protected_content: "确认保护内容边界",
    manual_repair: "先处理章节问题",
  };
  return action ? labels[action] ?? null : null;
}

function workerStateLabel(
  state: NonNullable<DirectorBookAutomationProjection["workerHealth"]>["derivedState"],
): string {
  const labels: Record<NonNullable<DirectorBookAutomationProjection["workerHealth"]>["derivedState"], string> = {
    idle: "未运行",
    queued_waiting_worker: "等待接手",
    leased_starting: "正在接手",
    running_step: "自动推进中",
    waiting_gate: "等待确认",
    auto_recovering: "恢复中",
    cancelled: "已停止",
    failed_recoverable: "等待恢复",
    failed_hard: "需要处理",
    succeeded: "已完成",
  };
  return labels[state] ?? state;
}

function workerStateDetail(health: NonNullable<DirectorBookAutomationProjection["workerHealth"]>): string {
  if (health.message?.trim()) {
    return health.message.trim();
  }
  if (health.queuedCommandCount > 0) {
    return "任务已排队，后台执行接手后会继续推进。";
  }
  if (health.runningCommandCount > 0 || health.leasedCommandCount > 0) {
    return "后台执行正在处理当前任务。";
  }
  if (health.staleCommandCount > 0) {
    return "后台执行中断后会从最近进度尝试恢复。";
  }
  return "当前没有正在排队或执行的后台动作。";
}

export default function AICockpit(props: AICockpitProps) {
  const {
    mode = "focusedNovel",
    fallbackStatusLabel,
    isActionPending = false,
    showDetailsAction = true,
    onAction,
    onOpenDetails,
    onOpenNovel,
    onOpenFallbackDetails,
  } = props;
  const focusProjection = props.projection ?? null;
  const isCompact = mode === "compact";

  if (!focusProjection) {
    return (
      <div className={cn("rounded-lg border p-3", stateClassName("idle"))}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-0.5 shrink-0 text-foreground">{stateIcon("idle")}</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">AI 驾驶舱</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">{fallbackProjectionReason(props)}</div>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0">{fallbackStatusLabel ?? "未开启"}</Badge>
        </div>
        {onOpenFallbackDetails ? (
          <Button type="button" size="sm" variant="outline" className="mt-3 w-full" onClick={onOpenFallbackDetails}>
            查看
          </Button>
        ) : null}
      </div>
    );
  }

  const primaryAction = focusProjection.primaryAction ?? null;
  const detailAction = focusProjection.secondaryActions?.find((item) => item.type === "open_details") ?? null;
  const canOpenDetails = showDetailsAction && Boolean(onOpenDetails || (detailAction && onAction));
  const recentItems = focusProjection.timeline.slice(0, isCompact ? 2 : 3);
  const artifactRows = focusProjection.artifactSummary.byType?.slice(0, 3) ?? [];
  const usageSummary = focusProjection.usageSummary ?? null;
  const stepUsage = focusProjection.stepUsage?.slice(0, 2) ?? [];
  const promptUsage = focusProjection.promptUsage?.slice(0, 6) ?? [];
  const circuitBreaker = focusProjection.circuitBreaker?.status === "open" ? focusProjection.circuitBreaker : null;
  const circuitRecovery = recoveryActionLabel(circuitBreaker?.recoveryAction ?? null);
  const workerHealth = focusProjection.workerHealth ?? null;
  const artifactInsightLines = [
    focusProjection.artifactSummary.affectedChapterCount
      ? `影响 ${focusProjection.artifactSummary.affectedChapterCount} 个章节`
      : null,
    focusProjection.artifactSummary.recentStaleArtifacts?.length
      ? `${focusProjection.artifactSummary.recentStaleArtifacts.length} 个产物需复核`
      : null,
    focusProjection.artifactSummary.recentRepairArtifacts?.length
      ? `${focusProjection.artifactSummary.recentRepairArtifacts.length} 条修复记录`
      : null,
    focusProjection.artifactSummary.recentVersionedArtifacts?.length
      ? `${focusProjection.artifactSummary.recentVersionedArtifacts.length} 个产物有新版本`
      : null,
  ].filter((line): line is string => Boolean(line));
  const reason = focusProjection.userReason?.trim()
    || focusProjection.blockedReason?.trim()
    || focusProjection.detail?.trim()
    || focusProjection.automationSummary?.trim()
    || fallbackProjectionReason(props);

  const handlePrimaryAction = () => {
    if (primaryAction && onAction) {
      onAction(focusProjection, primaryAction);
      return;
    }
    onOpenNovel?.(focusProjection);
  };

  const handleDetails = () => {
    if (detailAction && onAction) {
      onAction(focusProjection, detailAction);
      return;
    }
    onOpenDetails?.(focusProjection);
  };

  const handleCompactOpen = () => {
    if (onOpenNovel) {
      onOpenNovel(focusProjection);
      return;
    }
    handleDetails();
  };

  if (isCompact) {
    return (
      <div className={cn("rounded-lg border p-3", stateClassName(focusProjection.displayState))}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-0.5 shrink-0 text-foreground">{stateIcon(focusProjection.displayState)}</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">AI 驾驶舱</div>
              <div className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">
                {focusProjection.userHeadline || focusProjection.headline || reason}
              </div>
            </div>
          </div>
          <Badge variant={stateBadgeVariant(focusProjection.displayState)} className="shrink-0">
            {displayStateLabel(focusProjection.displayState)}
          </Badge>
        </div>
        <Button type="button" size="sm" variant="outline" className="mt-3 w-full" onClick={handleCompactOpen}>
          查看
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border p-3", stateClassName(focusProjection.displayState))}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 shrink-0 text-foreground">{stateIcon(focusProjection.displayState)}</span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">AI 驾驶舱</div>
            {!isCompact ? (
              <div className="mt-1 truncate text-xs font-medium text-foreground">{focusProjection.focusNovel.title}</div>
            ) : null}
            <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {focusProjection.userHeadline || focusProjection.headline}
            </div>
          </div>
        </div>
        <Badge variant={stateBadgeVariant(focusProjection.displayState)} className="shrink-0">
          {displayStateLabel(focusProjection.displayState)}
        </Badge>
      </div>

      <div className="mt-3 rounded-md border bg-background/70 px-3 py-2 text-xs leading-5 text-muted-foreground">
        {reason}
      </div>

      {!isCompact && focusProjection.progressSummary ? (
        <div className="mt-2 text-xs leading-5 text-muted-foreground">{focusProjection.progressSummary}</div>
      ) : null}

      {!isCompact && workerHealth ? (
        <div className="mt-3 rounded-md border bg-background/70 px-3 py-2 text-xs leading-5 text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Database className="h-3.5 w-3.5" />
              后台执行
            </div>
            <Badge variant="outline">{workerStateLabel(workerHealth.derivedState)}</Badge>
          </div>
          <div className="mt-1">{workerStateDetail(workerHealth)}</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            <div className="rounded-md bg-muted/40 px-2 py-1">
              <div className="text-[11px] text-muted-foreground">排队</div>
              <div className="font-medium text-foreground">{workerHealth.queuedCommandCount}</div>
            </div>
            <div className="rounded-md bg-muted/40 px-2 py-1">
              <div className="text-[11px] text-muted-foreground">接手</div>
              <div className="font-medium text-foreground">{workerHealth.leasedCommandCount}</div>
            </div>
            <div className="rounded-md bg-muted/40 px-2 py-1">
              <div className="text-[11px] text-muted-foreground">执行</div>
              <div className="font-medium text-foreground">{workerHealth.runningCommandCount}</div>
            </div>
            <div className="rounded-md bg-muted/40 px-2 py-1">
              <div className="text-[11px] text-muted-foreground">恢复</div>
              <div className="font-medium text-foreground">{workerHealth.staleCommandCount}</div>
            </div>
          </div>
          {workerHealth.oldestQueuedWaitMs ? (
            <div className="mt-2 text-[11px] text-muted-foreground">
              等待接手 {formatDuration(workerHealth.oldestQueuedWaitMs) ?? "<1 秒"}
            </div>
          ) : null}
        </div>
      ) : null}

      {circuitBreaker ? (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive">
          <div className="font-medium">自动推进已暂停</div>
          <div className="mt-1">{circuitBreaker.message || "系统检测到继续自动推进可能反复失败。"}</div>
          {circuitRecovery ? <div className="mt-1">建议：{circuitRecovery}。</div> : null}
        </div>
      ) : null}

      {usageSummary ? (
        <div className="mt-3 rounded-md border bg-background/70 px-3 py-2 text-xs leading-5 text-muted-foreground">
          <div className="font-medium text-foreground">AI 用量</div>
          <div className="mt-1">{formatUsageLine(usageSummary)}</div>
          {promptUsage.length > 0 ? (
            <div className="mt-2 space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground">阶段用量</div>
              {promptUsage.map((item) => (
                <div key={`${item.promptAssetKey}:${item.promptVersion ?? ""}:${item.nodeKey ?? ""}`} className="flex flex-wrap items-center justify-between gap-2 border-t pt-1">
                  <span className="min-w-0 truncate text-foreground">
                    {getDirectorNodeDisplayLabel({ label: item.label ?? item.promptAssetKey, nodeKey: item.nodeKey })}
                  </span>
                  <span className="shrink-0">{formatUsageLine(item)}</span>
                </div>
              ))}
            </div>
          ) : null}
          {stepUsage.length > 0 ? (
            <div className="mt-2 space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground">推进步骤</div>
              {stepUsage.map((item) => (
                <div key={item.stepIdempotencyKey} className="flex flex-wrap items-center justify-between gap-2 border-t pt-1">
                  <span className="min-w-0 truncate text-foreground">
                    {getDirectorNodeDisplayLabel({ label: item.label, nodeKey: item.nodeKey })}
                  </span>
                  <span className="shrink-0">{formatUsageLine(item)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {artifactRows.length > 0 ? (
        <div className="mt-3 rounded-md border bg-background/70 px-3 py-2">
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Database className="h-3.5 w-3.5" />
            产物记录
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {artifactRows.map((item) => (
              <Badge key={item.artifactType} variant={item.staleCount > 0 ? "outline" : "secondary"} className="text-[11px]">
                {artifactTypeLabel(String(item.artifactType))}
                <span className="ml-1 text-muted-foreground">{item.activeCount}/{item.totalCount}</span>
              </Badge>
            ))}
          </div>
          {artifactInsightLines.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
              {artifactInsightLines.map((line) => (
                <span key={line} className="rounded-full bg-muted/40 px-2 py-0.5">{line}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {focusProjection.nextActionLabel ? (
        <div className="mt-2 rounded-md border bg-background/70 px-3 py-2 text-xs leading-5 text-muted-foreground">
          下一步：{focusProjection.nextActionLabel}
        </div>
      ) : null}

      {recentItems.length > 0 ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <History className="h-3.5 w-3.5" />
            自动化记录
          </div>
          {recentItems.map((item) => (
            <div key={item.id} className="rounded-md border bg-background/70 px-3 py-2 text-xs leading-5">
              <div className="line-clamp-2 text-foreground">{item.title}</div>
              {item.usage ? (
                <div className="mt-1 text-muted-foreground">{formatUsageLine(item.usage)}</div>
              ) : item.durationMs ? (
                <div className="mt-1 text-muted-foreground">耗时 {formatDuration(item.durationMs)}</div>
              ) : null}
              <div className="mt-1 text-muted-foreground">{formatDate(item.occurredAt)}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className={cn("mt-3 flex gap-2", isCompact && canOpenDetails && "grid grid-cols-2")}>
        <Button type="button" size="sm" className="flex-1" onClick={handlePrimaryAction} disabled={isActionPending}>
          {isActionPending ? "处理中..." : renderActionLabel(primaryAction ?? {
            type: "open_novel",
            label: "打开小说",
            target: { novelId: focusProjection.novelId },
          }, focusProjection.displayState)}
        </Button>
        {canOpenDetails ? (
          <Button type="button" size="sm" variant="outline" onClick={handleDetails}>
            <ExternalLink className="h-4 w-4" />
            执行详情
          </Button>
        ) : null}
      </div>
    </div>
  );
}
