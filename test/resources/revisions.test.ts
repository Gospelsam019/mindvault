import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceService } from '../../src/services/resourceService.js';
import { MAX_RESOURCE_REVISION } from '../../src/contracts/resource.js';

describe('resource revision overflow guard', () => {
  let service: ResourceService;

  beforeEach(() => {
    service = new ResourceService();
  });

  it('exposes the integer maximum revision constant', () => {
    expect(MAX_RESOURCE_REVISION).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('rejects a mutation when the revision is already at the maximum', async () => {
    const resource = await service.createResource({
      name: 'boundary-resource',
      revision: MAX_RESOURCE_REVISION,
    });

    await expect(
      service.updateResource(resource.id, { name: 'mutated' }),
    ).rejects.toThrow(/revision/i);
  });

  it('leaves resource state unchanged after a failed boundary mutation', async () => {
    const resource = await service.createResource({
      name: 'boundary-resource',
      revision: MAX_RESOURCE_REVISION,
    });

    await expect(
      service.updateResource(resource.id, { name: 'mutated' }),
    ).rejects.toThrow(/revision/i);

    const reloaded = await service.getResource(resource.id);
    expect(reloaded.name).toBe('boundary-resource');
    expect(reloaded.revision).toBe(MAX_RESOURCE_REVISION);
  });

  it('still increments revisions below the maximum', async () => {
    const resource = await service.createResource({
      name: 'normal-resource',
      revision: MAX_RESOURCE_REVISION - 1,
    });

    const updated = await service.updateResource(resource.id, { name: 'mutated' });
    expect(updated.revision).toBe(MAX_RESOURCE_REVISION);
  });
});
