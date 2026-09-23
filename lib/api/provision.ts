export async function provisionProfile(signal?: AbortSignal): Promise<boolean> {
  try {
    return (await fetch('/api/me', { signal })).ok;
  } catch {
    // Aborted or unreachable — either way, not provisioned.
    return false;
  }
}
