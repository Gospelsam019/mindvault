export const MAX_RESOURCE_REVISION = Number.MAX_SAFE_INTEGER;

export class ResourceRevisionOverflowError extends Error {
  readonly resourceId: string;
  readonly currentRevision: number;

  constructor(resourceId: string, currentRevision: number) {
    super(
      `Resource "${resourceId}" revision counter is at the maximum (${currentRevision}); mutation rejected to avoid overflow.`,
    );
    this.name = "ResourceRevisionOverflowError";
    this.resourceId = resourceId;
    this.currentRevision = currentRevision;
  }
}

export function isRevisionAtMax(revision: number): boolean {
  return revision >= MAX_RESOURCE_REVISION;
}

/**
 * Compute the next revision for a resource mutation.
 *
 * Throws {@link ResourceRevisionOverflowError} when the current revision is at
 * the integer maximum, so callers fail before mutating any resource state
 * instead of silently wrapping the counter.
 */
export function nextRevision(resourceId: string, currentRevision: number): number {
  if (isRevisionAtMax(currentRevision)) {
    throw new ResourceRevisionOverflowError(resourceId, currentRevision);
  }
  return currentRevision + 1;
}
