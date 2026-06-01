import type { DirectorRuntimeSnapshot } from "@ai-novel/shared/types/directorRuntime";
import { normalizeDirectorArtifactRef } from "./DirectorArtifactLedger";

export function hasLegacyRuntimeArtifacts(snapshot: DirectorRuntimeSnapshot): boolean {
  return snapshot.artifacts.length > 0;
}

export function mergeLegacyRuntimeArtifacts(
  snapshot: DirectorRuntimeSnapshot,
  legacySnapshot: DirectorRuntimeSnapshot,
): DirectorRuntimeSnapshot {
  if (legacySnapshot.artifacts.length === 0) {
    return snapshot;
  }
  const byId = new Map(snapshot.artifacts.map((artifact) => [artifact.id, artifact]));
  let changed = false;
  for (const legacyArtifact of legacySnapshot.artifacts) {
    if (byId.has(legacyArtifact.id)) {
      continue;
    }
    const novelId = legacyArtifact.novelId ?? snapshot.novelId ?? legacySnapshot.novelId;
    if (!novelId) {
      continue;
    }
    byId.set(legacyArtifact.id, normalizeDirectorArtifactRef({
      ...legacyArtifact,
      runId: legacyArtifact.runId ?? snapshot.runId,
      novelId,
    }));
    changed = true;
  }
  if (!changed) {
    return snapshot;
  }
  return {
    ...snapshot,
    artifacts: [...byId.values()],
  };
}
