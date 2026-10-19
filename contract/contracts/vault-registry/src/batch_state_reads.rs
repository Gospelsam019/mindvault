//! Bounded batch read of resource lifecycle state (`get_resource_states`).

use soroban_sdk::{Env, String, Vec};

use crate::{DataKey, Error, Resource, ResourceState};

/// Maximum ids accepted by one `get_resource_states` call.
pub const MAX_STATE_BATCH: u32 = 20;

/// Lifecycle state for each id, in input order. Unknown ids and ids that fail
/// format validation yield `None` (matching `exists_many`). Rejects batches
/// larger than [`MAX_STATE_BATCH`] with `BatchTooLarge` before reading
/// anything. Does not touch storage TTLs.
pub(crate) fn read(env: &Env, ids: &Vec<String>) -> Result<Vec<Option<ResourceState>>, Error> {
    if ids.len() > MAX_STATE_BATCH {
        return Err(Error::BatchTooLarge);
    }
    let mut out: Vec<Option<ResourceState>> = Vec::new(env);
    for id in ids.iter() {
        let resource: Option<Resource> = if crate::VaultRegistry::validate_resource_id(&id).is_ok()
        {
            env.storage().persistent().get(&DataKey::Resource(id))
        } else {
            None
        };
        out.push_back(resource.map(|r| r.state));
    }
    Ok(out)
}
