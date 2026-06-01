CREATE TABLE "DirectorRunCommand" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "novelId" TEXT,
    "commandType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadJson" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectorRunCommand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DirectorRunCommand_taskId_commandType_idempotencyKey_key" ON "DirectorRunCommand"("taskId", "commandType", "idempotencyKey");
CREATE INDEX "DirectorRunCommand_status_runAfter_updatedAt_idx" ON "DirectorRunCommand"("status", "runAfter", "updatedAt");
CREATE INDEX "DirectorRunCommand_taskId_status_updatedAt_idx" ON "DirectorRunCommand"("taskId", "status", "updatedAt");
CREATE INDEX "DirectorRunCommand_novelId_updatedAt_idx" ON "DirectorRunCommand"("novelId", "updatedAt");
CREATE INDEX "DirectorRunCommand_leaseOwner_leaseExpiresAt_idx" ON "DirectorRunCommand"("leaseOwner", "leaseExpiresAt");

ALTER TABLE "DirectorRunCommand" ADD CONSTRAINT "DirectorRunCommand_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "NovelWorkflowTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectorRunCommand" ADD CONSTRAINT "DirectorRunCommand_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
