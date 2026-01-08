// Review Token Operations
// Magic link authentication for clients

import { prisma } from '@/lib/prisma';
import { ProjectRuleViolation } from './projects';

/**
 * Generate new review token (magic link)
 */
export async function generateReviewToken(projectId: string, editorId: string) {
  return await prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { editorId: true },
    });

    if (!project) {
      throw new ProjectRuleViolation('Project not found');
    }

    if (project.editorId !== editorId) {
      throw new ProjectRuleViolation('Not authorized');
    }

    const token = await tx.reviewToken.create({
      data: {
        projectId,
      },
    });

    await tx.activityEvent.create({
      data: {
        projectId,
        editorId,
        eventType: 'review_link_generated',
      },
    });

    return token;
  });
}

/**
 * Revoke review token
 */
export async function revokeReviewToken(tokenId: string, editorId: string) {
  return await prisma.$transaction(async (tx) => {
    const token = await tx.reviewToken.findUnique({
      where: { id: tokenId },
      include: {
        project: {
          select: { id: true, editorId: true },
        },
      },
    });

    if (!token) {
      throw new ProjectRuleViolation('Token not found');
    }

    if (token.project.editorId !== editorId) {
      throw new ProjectRuleViolation('Not authorized');
    }

    const updated = await tx.reviewToken.update({
      where: { id: tokenId },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    await tx.activityEvent.create({
      data: {
        projectId: token.project.id,
        editorId,
        eventType: 'review_link_revoked',
      },
    });

    return updated;
  });
}

/**
 * Regenerate review token (revoke old, create new)
 */
export async function regenerateReviewToken(projectId: string, editorId: string) {
  return await prisma.$transaction(async (tx) => {
    // Revoke all existing tokens
    await tx.reviewToken.updateMany({
      where: {
        projectId,
        isActive: true,
      },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    // Create new token
    const token = await tx.reviewToken.create({
      data: {
        projectId,
      },
    });

    await tx.activityEvent.create({
      data: {
        projectId,
        editorId,
        eventType: 'review_link_generated',
        metadata: { regenerated: true },
      },
    });

    return token;
  });
}

/**
 * Validate and retrieve project by token
 */
export async function getProjectByToken(tokenString: string) {
  const token = await prisma.reviewToken.findUnique({
    where: { token: tokenString },
    include: {
      project: {
        include: {
          videoVersions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
          },
          revisionRounds: {
            where: { status: 'open' },
            include: {
              notes: {
                orderBy: { timestamp: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  if (!token || !token.isActive) {
    return null;
  }

  // Update last used timestamp
  await prisma.reviewToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() },
  });

  return token.project;
}
