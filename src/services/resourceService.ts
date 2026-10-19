import { Resource, ResourceEvent, ResourceRevision } from '../types/resource';

interface ResourceStore {
  resources: Map<string, Resource>;
  revisions: Map<string, number>;
  events: ResourceEvent[];
}

const store: ResourceStore = {
  resources: new Map(),
  revisions: new Map(),
  events: [],
};

function getRevision(resourceId: string): number {
  return store.revisions.get(resourceId) ?? 0;
}

function bumpRevision(resourceId: string): number {
  const next = getRevision(resourceId) + 1;
  store.revisions.set(resourceId, next);
  return next;
}

function emitEvent(event: ResourceEvent): void {
  store.events.push(event);
}

function withRevision(resource: Resource): Resource & { revision: number } {
  return { ...resource, revision: getRevision(resource.id) };
}

export function getResource(resourceId: string): (Resource & { revision: number }) | null {
  const resource = store.resources.get(resourceId);
  if (!resource) {
    return null;
  }
  return withRevision(resource);
}

export function listResources(): Array<Resource & { revision: number }> {
  return Array.from(store.resources.values()).map(withRevision);
}

export function getResourceEvents(resourceId?: string): ResourceEvent[] {
  if (!resourceId) {
    return [...store.events];
  }
  return store.events.filter((event) => event.resourceId === resourceId);
}

export function createResource(input: Resource): Resource & { revision: number } {
  store.resources.set(input.id, { ...input });
  store.revisions.set(input.id, 0);
  const revision = getRevision(input.id);
  emitEvent({
    type: 'resource.created',
    resourceId: input.id,
    revision,
    timestamp: Date.now(),
  });
  return withRevision(input);
}

export function updateResourceMetadata(
  resourceId: string,
  metadata: Record<string, unknown>,
): (Resource & { revision: number }) | null {
  const resource = store.resources.get(resourceId);
  if (!resource) {
    return null;
  }

  const updated: Resource = { ...resource, metadata: { ...metadata } };
  store.resources.set(resourceId, updated);
  const revision = bumpRevision(resourceId);

  emitEvent({
    type: 'resource.metadata.updated',
    resourceId,
    revision,
    timestamp: Date.now(),
  });

  return withRevision(updated);
}

export function updateResourcePrice(
  resourceId: string,
  price: number,
): (Resource & { revision: number }) | null {
  const resource = store.resources.get(resourceId);
  if (!resource) {
    return null;
  }

  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
    return null;
  }

  const updated: Resource = { ...resource, price };
  store.resources.set(resourceId, updated);
  const revision = bumpRevision(resourceId);

  emitEvent({
    type: 'resource.price.updated',
    resourceId,
    revision,
    timestamp: Date.now(),
  });

  return withRevision(updated);
}

export function getResourceRevision(resourceId: string): ResourceRevision | null {
  if (!store.resources.has(resourceId)) {
    return null;
  }
  return { resourceId, revision: getRevision(resourceId) };
}
