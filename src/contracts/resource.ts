export interface ResourceMetadata {
  name: string;
  description?: string;
  [key: string]: unknown;
}

export interface ResourcePrice {
  amount: string;
  currency: string;
}

export interface Resource {
  id: string;
  owner: string;
  metadata: ResourceMetadata;
  price: ResourcePrice;
  /**
   * Monotonic revision counter for changes affecting the public listing
   * (metadata and price). Increments exactly once per successful mutation
   * and stays unchanged on rejected calls. Clients can compare this value
   * against cached data to detect staleness.
   */
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceReadResponse {
  resource: Resource;
  /** Revision of the resource at the time of the read. */
  revision: number;
}

export type ResourceEventType =
  | 'resource.created'
  | 'resource.metadata.updated'
  | 'resource.price.updated';

export interface ResourceEvent {
  type: ResourceEventType;
  resourceId: string;
  /** Revision of the resource after the mutation that produced this event. */
  revision: number;
  timestamp: string;
}

export interface UpdateResourceMetadataInput {
  metadata: ResourceMetadata;
}

export interface UpdateResourcePriceInput {
  price: ResourcePrice;
}

export interface ResourceMutationResult {
  ok: boolean;
  resource?: Resource;
  error?: string;
}

/**
 * Returns the next revision for a successful mutation. Rejected calls must
 * not invoke this helper so the revision stays unchanged.
 */
export function nextRevision(current: number): number {
  return current + 1;
}
