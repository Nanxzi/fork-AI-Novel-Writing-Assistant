const path = require("node:path");

function loadDistModule(modulePath) {
  try {
    return require(modulePath);
  } catch (error) {
    if (error && error.code === "MODULE_NOT_FOUND") {
      throw new Error("Build the server first: pnpm --filter @ai-novel/server build");
    }
    throw error;
  }
}

function parseTake(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function dateOrNull(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isUniqueConstraintError(error) {
  return Boolean(error && typeof error === "object" && error.code === "P2002");
}

async function main() {
  const serverRoot = path.resolve(__dirname, "..");
  const repoRoot = path.resolve(serverRoot, "..");
  const { prisma } = loadDistModule(path.join(repoRoot, "server", "dist", "db", "prisma.js"));
  const {
    DIRECTOR_CHAPTER_DRAFT_BASELINE_SCHEMA_VERSION,
    buildDirectorChapterDraftBaselineBackfillPlan,
  } = loadDistModule(path.join(
    repoRoot,
    "server",
    "dist",
    "services",
    "novel",
    "director",
    "directorChapterDraftBaselineBackfill.js",
  ));

  const write = process.env.DIRECTOR_BASELINE_WRITE === "1";
  const novelId = process.env.DIRECTOR_BASELINE_NOVEL_ID?.trim() || null;
  const take = parseTake(process.env.DIRECTOR_BASELINE_TAKE, 200);
  const where = {
    content: { not: null },
    ...(novelId ? { novelId } : {}),
  };
  const chapters = await prisma.chapter.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    take,
    select: {
      id: true,
      novelId: true,
      order: true,
      title: true,
      content: true,
      updatedAt: true,
    },
  });
  const novelIds = [...new Set(chapters.map((chapter) => chapter.novelId))];
  const artifacts = novelIds.length > 0
    ? await prisma.directorArtifact.findMany({
      where: {
        novelId: { in: novelIds },
        artifactType: "chapter_draft",
        contentTable: "Chapter",
      },
      select: {
        id: true,
        novelId: true,
        artifactType: true,
        targetType: true,
        targetId: true,
        contentTable: true,
        contentId: true,
        contentHash: true,
      },
    })
    : [];

  const plan = buildDirectorChapterDraftBaselineBackfillPlan({ chapters, artifacts });
  const written = [];
  const skippedExistingDuringWrite = [];

  if (write) {
    for (const candidate of plan.candidates) {
      try {
        await prisma.directorArtifact.create({
          data: {
            id: candidate.id,
            novelId: candidate.novelId,
            artifactType: "chapter_draft",
            targetType: "chapter",
            targetId: candidate.chapterId,
            version: 1,
            status: "active",
            source: "user_edited",
            contentTable: "Chapter",
            contentId: candidate.chapterId,
            contentHash: candidate.contentHash,
            schemaVersion: DIRECTOR_CHAPTER_DRAFT_BASELINE_SCHEMA_VERSION,
            protectedUserContent: true,
            artifactUpdatedAt: dateOrNull(candidate.artifactUpdatedAt),
          },
        });
        written.push(candidate);
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
        skippedExistingDuringWrite.push(candidate);
      }
    }
  }

  console.log(JSON.stringify({
    dryRun: !write,
    filter: {
      novelId,
      take,
    },
    scannedChapters: chapters.length,
    existingDraftBaselines: artifacts.length,
    candidates: plan.candidates.length,
    skipped: plan.skipped,
    written: written.length,
    skippedExistingDuringWrite: skippedExistingDuringWrite.length,
    sampleCandidates: plan.candidates.slice(0, 12),
  }, null, 2));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
