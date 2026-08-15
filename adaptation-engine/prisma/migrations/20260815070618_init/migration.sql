-- CreateTable
CREATE TABLE "Reviewer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "sourceOrganisation" TEXT NOT NULL,
    "intendedAudience" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceFilename" TEXT,
    "notes" TEXT,
    "ingestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TargetProfile" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "translate" BOOLEAN NOT NULL,
    "readingLevelTarget" TEXT NOT NULL,
    "readingLevelCeiling" TEXT NOT NULL,
    "addresseeMode" TEXT NOT NULL,
    "community" TEXT,
    "messenger" TEXT,
    "notes" TEXT,
    "fromMethodVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MethodSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "methodVersion" TEXT NOT NULL,
    "methodSha256" TEXT NOT NULL,
    "filesJson" TEXT NOT NULL,
    "fileCount" INTEGER NOT NULL,
    "ruleCount" INTEGER NOT NULL,
    "ruleStatusCountsJson" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AdaptationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceDocumentId" TEXT NOT NULL,
    "targetProfileKey" TEXT NOT NULL,
    "methodSnapshotId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "blockedReason" TEXT,
    "adaptedText" TEXT,
    "finalText" TEXT,
    "finalSha256" TEXT,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "parentRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "AdaptationRun_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdaptationRun_targetProfileKey_fkey" FOREIGN KEY ("targetProfileKey") REFERENCES "TargetProfile" ("key") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdaptationRun_methodSnapshotId_fkey" FOREIGN KEY ("methodSnapshotId") REFERENCES "MethodSnapshot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdaptationRun_parentRunId_fkey" FOREIGN KEY ("parentRunId") REFERENCES "AdaptationRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StageRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "promptTemplateId" TEXT NOT NULL,
    "promptTemplateVersion" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "promptSha256" TEXT NOT NULL,
    "systemPromptText" TEXT,
    "model" TEXT NOT NULL,
    "temperature" REAL,
    "maxTokens" INTEGER,
    "inputJson" TEXT NOT NULL,
    "outputJson" TEXT,
    "rawResponse" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "errorText" TEXT,
    CONSTRAINT "StageRun_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AdaptationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClinicalAssertion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "stableId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "verbatimQuote" TEXT NOT NULL,
    "charStart" INTEGER,
    "charEnd" INTEGER,
    "strength" TEXT NOT NULL,
    "numbersJson" TEXT NOT NULL DEFAULT '[]',
    "conditionsJson" TEXT NOT NULL DEFAULT '[]',
    "isProtected" BOOLEAN NOT NULL DEFAULT false,
    "protectedRuleIds" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClinicalAssertion_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AdaptationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssertionCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "sourceAssertionId" TEXT,
    "matchedAssertionId" TEXT,
    "verdict" TEXT NOT NULL,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT NOT NULL,
    "evidenceQuote" TEXT,
    "ruleIds" TEXT NOT NULL DEFAULT '[]',
    "resolutionStatus" TEXT NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssertionCheck_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AdaptationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssertionCheck_sourceAssertionId_fkey" FOREIGN KEY ("sourceAssertionId") REFERENCES "ClinicalAssertion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AssertionCheck_matchedAssertionId_fkey" FOREIGN KEY ("matchedAssertionId") REFERENCES "ClinicalAssertion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AssertionCheck_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "Reviewer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChangePlanItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleDimension" TEXT NOT NULL,
    "ruleStatus" TEXT NOT NULL,
    "targetQuote" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "touchesAssertionIds" TEXT NOT NULL DEFAULT '[]',
    "touchesProtected" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "authorEditNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChangePlanItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AdaptationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Change" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "planItemId" TEXT,
    "ordinal" INTEGER NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleDimension" TEXT NOT NULL,
    "ruleStatus" TEXT NOT NULL,
    "beforeText" TEXT NOT NULL,
    "afterText" TEXT NOT NULL,
    "rationalePlain" TEXT NOT NULL,
    "anchorStart" INTEGER,
    "anchorEnd" INTEGER,
    "flagType" TEXT,
    "citesDataEntryId" TEXT,
    "touchesAssertionIds" TEXT NOT NULL DEFAULT '[]',
    "decision" TEXT NOT NULL DEFAULT 'PENDING',
    "decisionReasonCode" TEXT,
    "decisionReasonText" TEXT,
    "editedText" TEXT,
    "decidedById" TEXT,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Change_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AdaptationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Change_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "ChangePlanItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Change_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "Reviewer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MethodRefinementCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "changeId" TEXT,
    "ruleId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "reasonText" TEXT NOT NULL,
    "proposedRuleChange" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "resolvedInMethodVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MethodRefinementCandidate_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "Change" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Signoff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "note" TEXT,
    "signedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Signoff_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AdaptationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Signoff_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "Reviewer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GovernanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "methodVersion" TEXT NOT NULL,
    "methodSha256" TEXT NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "adaptedSha256" TEXT NOT NULL,
    "modelsJson" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "payloadSha256" TEXT NOT NULL,
    "generatedById" TEXT,
    "renderedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GovernanceRecord_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AdaptationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GovernanceRecord_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "Reviewer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SourceIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "raisedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SourceIssue_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AdaptationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SourceIssue_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "Reviewer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SourceDocument_sourceSha256_idx" ON "SourceDocument"("sourceSha256");

-- CreateIndex
CREATE UNIQUE INDEX "MethodSnapshot_methodSha256_key" ON "MethodSnapshot"("methodSha256");

-- CreateIndex
CREATE INDEX "AdaptationRun_sourceDocumentId_idx" ON "AdaptationRun"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "AdaptationRun_status_idx" ON "AdaptationRun"("status");

-- CreateIndex
CREATE INDEX "StageRun_runId_idx" ON "StageRun"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "StageRun_runId_stage_attempt_key" ON "StageRun"("runId", "stage", "attempt");

-- CreateIndex
CREATE INDEX "ClinicalAssertion_runId_origin_idx" ON "ClinicalAssertion"("runId", "origin");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalAssertion_runId_origin_stableId_key" ON "ClinicalAssertion"("runId", "origin", "stableId");

-- CreateIndex
CREATE INDEX "AssertionCheck_runId_resolutionStatus_idx" ON "AssertionCheck"("runId", "resolutionStatus");

-- CreateIndex
CREATE INDEX "AssertionCheck_runId_verdict_idx" ON "AssertionCheck"("runId", "verdict");

-- CreateIndex
CREATE INDEX "ChangePlanItem_runId_idx" ON "ChangePlanItem"("runId");

-- CreateIndex
CREATE INDEX "Change_runId_decision_idx" ON "Change"("runId", "decision");

-- CreateIndex
CREATE INDEX "Change_runId_ruleId_idx" ON "Change"("runId", "ruleId");

-- CreateIndex
CREATE INDEX "MethodRefinementCandidate_status_idx" ON "MethodRefinementCandidate"("status");

-- CreateIndex
CREATE INDEX "MethodRefinementCandidate_ruleId_idx" ON "MethodRefinementCandidate"("ruleId");

-- CreateIndex
CREATE INDEX "Signoff_runId_idx" ON "Signoff"("runId");

-- CreateIndex
CREATE INDEX "GovernanceRecord_runId_idx" ON "GovernanceRecord"("runId");

-- CreateIndex
CREATE INDEX "SourceIssue_runId_idx" ON "SourceIssue"("runId");
