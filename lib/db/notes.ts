// Notes and Scope Enforcement
// ENFORCES: Server-side scope classification, editor overrides

import { prisma } from '@/lib/prisma';
import { RequestType, ScopeStatus } from '@prisma/client';
import { ProjectRuleViolation } from './projects';

/**
 * SERVER-SIDE SCOPE ENFORCEMENT
 * If request_type ∈ allowed_request_types AND client_marked_new_idea = false
 *   → scope_status = in_scope
 * Else
 *   → scope_status = additional_request
 */
export function calculateScopeStatus(
  requestType: RequestType,
  clientMarkedNewIdea: boolean,
  allowedRequestTypes: RequestType[]
): ScopeStatus {
  if (!clientMarkedNewIdea && allowedRequestTypes.includes(requestType)) {
    return 'in_scope';
  }
  return 'additional_request';
}

/**
 * Add note to open revision round
 */
export async function addNote(
  revisionRoundId: string,
  data: {
    timestamp: number;
    requestType: RequestType;
    noteText: string;
    clientMarkedNewIdea: boolean;
  }
) {
  return await prisma.$transaction(async (tx) => {
    // Get round and project info
    const round = await tx.revisionRound.findUnique({
      where: { id: revisionRoundId },
      include: {
        project: {
          select: {
            id: true,
            allowedRequestTypes: true,
            state: true,
          },
        },
      },
    });

    if (!round) {
      throw new ProjectRuleViolation('Revision round not found');
    }

    if (round.status !== 'open') {
      throw new ProjectRuleViolation('Cannot add notes to submitted round');
    }

    if (round.project.state === 'approved') {
      throw new ProjectRuleViolation('Project is approved and locked');
    }

    // CALCULATE SCOPE (server-side only)
    const scopeStatus = calculateScopeStatus(
      data.requestType,
      data.clientMarkedNewIdea,
      round.project.allowedRequestTypes
    );

    const note = await tx.note.create({
      data: {
        revisionRoundId,
        timestamp: data.timestamp,
        requestType: data.requestType,
        noteText: data.noteText,
        clientMarkedNewIdea: data.clientMarkedNewIdea,
        scopeStatus,
      },
    });

    await tx.activityEvent.create({
      data: {
        projectId: round.project.id,
        eventType: 'note_added',
        metadata: {
          noteId: note.id,
          scopeStatus,
        },
      },
    });

    return note;
  });
}

/**
 * EDITOR OVERRIDE
 * Override scope classification with required reason
 */
export async function overrideScopeStatus(
  noteId: string,
  editorId: string,
  overrideTo: ScopeStatus,
  overrideReason: string
) {
  if (!overrideReason.trim()) {
    throw new ProjectRuleViolation('Override reason is required');
  }

  return await prisma.$transaction(async (tx) => {
    const note = await tx.note.findUnique({
      where: { id: noteId },
      include: {
        revisionRound: {
          include: {
            project: {
              select: { id: true, state: true },
            },
          },
        },
      },
    });

    if (!note) {
      throw new ProjectRuleViolation('Note not found');
    }

    if (note.revisionRound.project.state === 'approved') {
      throw new ProjectRuleViolation('Cannot override scope on approved project');
    }

    const updated = await tx.note.update({
      where: { id: noteId },
      data: {
        overrideTo,
        overrideReason,
        overrideEditorId: editorId,
        overrideAt: new Date(),
      },
    });

    await tx.activityEvent.create({
      data: {
        projectId: note.revisionRound.project.id,
        editorId,
        eventType: 'scope_overridden',
        metadata: {
          noteId,
          from: note.scopeStatus,
          to: overrideTo,
          reason: overrideReason,
        },
      },
    });

    return updated;
  });
}

/**
 * Get effective scope status (override if present, else original)
 */
export function getEffectiveScopeStatus(note: {
  scopeStatus: ScopeStatus;
  overrideTo: ScopeStatus | null;
}): ScopeStatus {
  return note.overrideTo ?? note.scopeStatus;
}
