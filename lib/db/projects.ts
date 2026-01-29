// Project Database Operations
// ENFORCES: State machine, revision caps, approval rules

import { prisma } from '@/lib/prisma';
import { ProjectState, Prisma } from '@prisma/client';

export class ProjectRuleViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectRuleViolation';
  }
}

/**
 * HARD INVARIANT: Cannot approve project with open revision round
 */
export async function approveProject(projectId: string) {
  return await prisma.$transaction(async (tx) => {
    // Check for open rounds
    const openRound = await tx.revisionRound.findFirst({
      where: {
        projectId,
        status: 'open',
      },
    });

    if (openRound) {
      throw new ProjectRuleViolation('Cannot approve project with open revision round');
    }

    // Check current state
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { state: true, id: true },
    });

    if (!project) {
      throw new ProjectRuleViolation('Project not found');
    }

    if (project.state === 'approved') {
      throw new ProjectRuleViolation('Project already approved');
    }

    // Approve and revoke all tokens
    const updated = await tx.project.update({
      where: { id: projectId },
      data: {
        state: 'approved',
        approvedAt: new Date(),
      },
    });

    await tx.reviewToken.updateMany({
      where: { projectId },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    await tx.activityEvent.create({
      data: {
        projectId,
        eventType: 'project_approved',
      },
    });

    return updated;
  });
}

/**
 * HARD INVARIANT: Cannot perform writes after approval
 */
export async function assertProjectNotApproved(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { state: true },
  });

  if (!project) {
    throw new ProjectRuleViolation('Project not found');
  }

  if (project.state === 'approved') {
    throw new ProjectRuleViolation('Project is approved and locked');
  }
}

/**
 * Get current open revision round (at most one)
 */
export async function getOpenRevisionRound(projectId: string) {
  return await prisma.revisionRound.findFirst({
    where: {
      projectId,
      status: 'open',
    },
    include: {
      notes: true,
    },
  });
}

/**
 * HARD INVARIANT: Only one open revision round per project
 */
export async function openRevisionRound(projectId: string, videoVersionNumber?: number) {
  await assertProjectNotApproved(projectId);

  return await prisma.$transaction(async (tx) => {
    // Check for existing open round
    const existingOpen = await tx.revisionRound.findFirst({
      where: {
        projectId,
        status: 'open',
      },
    });

    if (existingOpen) {
      throw new ProjectRuleViolation('A revision round is already open');
    }

    // Get next round number
    const lastRound = await tx.revisionRound.findFirst({
      where: { projectId },
      orderBy: { roundNumber: 'desc' },
    });

    const roundNumber = (lastRound?.roundNumber ?? 0) + 1;

    const round = await tx.revisionRound.create({
      data: {
        projectId,
        roundNumber,
        videoVersionNumber,
      },
    });

    await tx.activityEvent.create({
      data: {
        projectId,
        eventType: 'revision_round_opened',
        metadata: { roundNumber },
      },
    });

    return round;
  });
}

/**
 * HARD INVARIANT: Cannot submit beyond revision cap
 * ONLY submission consumes a revision
 */
export async function submitRevisionRound(roundId: string) {
  return await prisma.$transaction(async (tx) => {
    const round = await tx.revisionRound.findUnique({
      where: { id: roundId },
      include: {
        project: {
          select: {
            id: true,
            revisionCap: true,
            revisionUsed: true,
            state: true,
          },
        },
      },
    });

    if (!round) {
      throw new ProjectRuleViolation('Revision round not found');
    }

    if (round.status !== 'open') {
      throw new ProjectRuleViolation('Revision round already submitted');
    }

    if (round.project.state === 'approved') {
      throw new ProjectRuleViolation('Project is approved and locked');
    }

    // CHECK REVISION CAP
    if (round.project.revisionUsed >= round.project.revisionCap) {
      throw new ProjectRuleViolation('Included Revisions Complete');
    }

    // Submit round and increment counter
    const updated = await tx.revisionRound.update({
      where: { id: roundId },
      data: {
        status: 'submitted',
        submittedAt: new Date(),
      },
    });

    await tx.project.update({
      where: { id: round.project.id },
      data: {
        revisionUsed: {
          increment: 1,
        },
      },
    });

    await tx.activityEvent.create({
      data: {
        projectId: round.project.id,
        eventType: 'revision_round_submitted',
        metadata: {
          roundNumber: round.roundNumber,
          revisionUsed: round.project.revisionUsed + 1,
          revisionCap: round.project.revisionCap,
        },
      },
    });

    return updated;
  });
}

/**
 * Upload new video version (closes open revision round)
 */
export async function uploadVideoVersion(
  projectId: string,
  videoUrl: string,
  duration?: number,
  notes?: string
) {
  await assertProjectNotApproved(projectId);

  return await prisma.$transaction(async (tx) => {
    // Get next version number
    const lastVersion = await tx.videoVersion.findFirst({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
    });

    const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    const version = await tx.videoVersion.create({
      data: {
        projectId,
        versionNumber,
        videoUrl,
        duration,
        notes,
      },
    });

    // Close any open revision round
    await tx.revisionRound.updateMany({
      where: {
        projectId,
        status: 'open',
      },
      data: {
        status: 'submitted',
        submittedAt: new Date(),
      },
    });

    await tx.activityEvent.create({
      data: {
        projectId,
        eventType: 'video_uploaded',
        metadata: { versionNumber },
      },
    });

    return version;
  });
}
