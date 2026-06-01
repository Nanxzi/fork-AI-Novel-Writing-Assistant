import type {
  DirectorBookAutomationArtifactSummary,
  DirectorBookAutomationArtifactTypeSummary,
  DirectorBookAutomationRecentArtifact,
} from "@ai-novel/shared/types/directorRuntime";
import { prisma } from "../../../../db/prisma";

export interface DirectorArtifactLedgerQueryRow {
  id: string;
  artifactType: string;
  targetType: string;
  targetId: string | null;
  version: number;
  status: string;
  source: string;
  protectedUserContent: boolean | null;
  contentHash: string | null;
  updatedAt: Date | string;
  dependencies: Array<{ id: string }>;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function timestampOf(value: Date | string | null | undefined): number {
  const iso = toIso(value);
  if (!iso) {
    return 0;
  }
  const timestamp = Date.parse(iso);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareUpdatedDesc(left: DirectorArtifactLedgerQueryRow, right: DirectorArtifactLedgerQueryRow): number {
  return timestampOf(right.updatedAt) - timestampOf(left.updatedAt);
}

function summarizeTypeRows(rows: DirectorArtifactLedgerQueryRow[]): DirectorBookAutomationArtifactTypeSummary[] {
  const byType = new Map<string, DirectorBookAutomationArtifactTypeSummary>();
  for (const row of rows) {
    const existing = byType.get(row.artifactType) ?? {
      artifactType: row.artifactType,
      totalCount: 0,
      activeCount: 0,
      staleCount: 0,
      protectedUserContentCount: 0,
      dependencyCount: 0,
      latestUpdatedAt: null,
    };
    const updatedAt = toIso(row.updatedAt);
    byType.set(row.artifactType, {
      ...existing,
      totalCount: existing.totalCount + 1,
      activeCount: existing.activeCount + (row.status === "active" ? 1 : 0),
      staleCount: existing.staleCount + (row.status === "stale" ? 1 : 0),
      protectedUserContentCount: existing.protectedUserContentCount + (row.protectedUserContent ? 1 : 0),
      dependencyCount: existing.dependencyCount + row.dependencies.length,
      latestUpdatedAt: timestampOf(updatedAt) > timestampOf(existing.latestUpdatedAt)
        ? updatedAt
        : existing.latestUpdatedAt,
    });
  }
  return [...byType.values()].sort((left, right) => {
    const riskDelta = (right.staleCount + right.protectedUserContentCount) - (left.staleCount + left.protectedUserContentCount);
    if (riskDelta !== 0) {
      return riskDelta;
    }
    return right.totalCount - left.totalCount;
  });
}

function mapRecentArtifact(row: DirectorArtifactLedgerQueryRow): DirectorBookAutomationRecentArtifact {
  return {
    id: row.id,
    artifactType: row.artifactType,
    targetType: row.targetType,
    targetId: row.targetId,
    status: row.status,
    source: row.source,
    version: row.version,
    protectedUserContent: row.protectedUserContent,
    dependencyCount: row.dependencies.length,
    contentHash: row.contentHash,
    updatedAt: toIso(row.updatedAt),
  };
}

export function buildDirectorArtifactBookSummary(
  rows: DirectorArtifactLedgerQueryRow[],
): DirectorBookAutomationArtifactSummary {
  const activeCount = rows.filter((row) => row.status === "active").length;
  const staleCount = rows.filter((row) => row.status === "stale").length;
  const protectedUserContentCount = rows.filter((row) => row.protectedUserContent === true).length;
  const repairTicketCount = rows.filter((row) => row.artifactType === "repair_ticket" && row.status !== "rejected").length;
  const dependencyCount = rows.reduce((sum, row) => sum + row.dependencies.length, 0);
  const affectedChapterIds = Array.from(new Set(
    rows
      .filter((row) => row.targetType === "chapter" && row.targetId)
      .map((row) => row.targetId as string),
  ));
  const recentRows = rows.slice().sort(compareUpdatedDesc);
  return {
    activeCount,
    staleCount,
    protectedUserContentCount,
    repairTicketCount,
    dependencyCount,
    affectedChapterCount: affectedChapterIds.length,
    affectedChapterIds: affectedChapterIds.slice(0, 12),
    byType: summarizeTypeRows(rows),
    recentArtifacts: recentRows
      .slice(0, 8)
      .map(mapRecentArtifact),
    recentStaleArtifacts: recentRows
      .filter((row) => row.status === "stale")
      .slice(0, 6)
      .map(mapRecentArtifact),
    recentRepairArtifacts: recentRows
      .filter((row) => row.source === "auto_repaired" || row.artifactType === "repair_ticket")
      .slice(0, 6)
      .map(mapRecentArtifact),
    recentVersionedArtifacts: recentRows
      .filter((row) => row.version > 1)
      .slice(0, 6)
      .map(mapRecentArtifact),
  };
}

export class DirectorArtifactLedgerQueryService {
  async getBookSummary(novelId: string): Promise<DirectorBookAutomationArtifactSummary> {
    const rows = await prisma.directorArtifact.findMany({
      where: { novelId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        artifactType: true,
        targetType: true,
        targetId: true,
        version: true,
        status: true,
        source: true,
        protectedUserContent: true,
        contentHash: true,
        updatedAt: true,
        dependencies: {
          select: { id: true },
        },
      },
    });
    return buildDirectorArtifactBookSummary(rows);
  }
}

export const directorArtifactLedgerQueryService = new DirectorArtifactLedgerQueryService();
