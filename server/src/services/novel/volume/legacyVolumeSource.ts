import { prisma } from "../../../db/prisma";
import type { LegacyVolumeSource } from "./volumePlanUtils";

export async function getLegacyVolumeSource(novelId: string): Promise<LegacyVolumeSource> {
  const [novel, arcPlans] = await Promise.all([
    prisma.novel.findUnique({
      where: { id: novelId },
      select: {
        id: true,
        outline: true,
        structuredOutline: true,
        estimatedChapterCount: true,
        chapters: {
          orderBy: { order: "asc" },
          select: {
            order: true,
            title: true,
            expectation: true,
            targetWordCount: true,
            conflictLevel: true,
            revealLevel: true,
            mustAvoid: true,
            taskSheet: true,
            sceneCards: true,
          },
        },
      },
    }),
    prisma.storyPlan.findMany({
      where: { novelId, level: "arc" },
      orderBy: [{ createdAt: "asc" }],
      select: {
        externalRef: true,
        title: true,
        objective: true,
        phaseLabel: true,
        hookTarget: true,
        rawPlanJson: true,
      },
    }),
  ]);
  if (!novel) {
    throw new Error("小说不存在。");
  }
  return {
    outline: novel.outline,
    structuredOutline: novel.structuredOutline,
    estimatedChapterCount: novel.estimatedChapterCount,
    chapters: novel.chapters,
    arcPlans,
  };
}
