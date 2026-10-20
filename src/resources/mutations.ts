import { Resource, ResourceRevision } from "../contracts/resource";

export const MAX_RESOURCE_REVISION = Number.MAX_SAFE_INTEGER;

export class ResourceRevisionOverflowError extends Error {
  constructor(resourceId: string, revision: number) {
    super(
      `Resource ${resourceId} revision ${revision} is at the maximum safe integer; mutation rejected to avoid overflow.`
    );
    this.name = "ResourceRevisionOverflowError";
  }
}

export function canIncrementRevision(revision: number): boolean {
  return Number.isSafeInteger(revision) && revision < MAX_RESOURCE_REVISION;
}

/**
 * Applies a mutation to a resource, incrementing its revision counter.
 *
 * If the current revision is at MAX_RESOURCE_REVISION, the mutation is
 * rejected with a ResourceRevisionOverflowError and the original resource
 * is returned unchanged (no partial writes).
 */
export function applyResourceMutation(
  resource: Resource,
  mutate: (draft: Resource) => Resource
): Resource {
  const currentRevision = resource.revision ?? 0;

  if (!canIncrementRevision(currentRevision)) {
    throw new ResourceRevisionOverflowError(resource.id, currentRevision);
  }

  const draft: Resource = { ...resource };
  const mutated = mutate(draft);

  return {
    ...mutated,
    revision: currentRevision + 1,
  };
}

export function recordRevision(
  resource: Resource,
  revisions: ResourceRevision[]
): ResourceRevision[] {
  const currentRevision = resource.revision ?? 0;

  if (!canIncrementRevision(currentRevision)) {
    throw new ResourceRevisionOverflowError(resource.id, currentRevision);
  }

  return [
    ...revisions,
    {
      resourceId: resource.id,
      revision: currentRevision + 1,
      createdAt: new Date().toISOString(),
    },
  ];
}
