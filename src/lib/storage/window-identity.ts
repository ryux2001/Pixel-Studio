/** Keep a writer identity across reload, while detecting copied sessionStorage in duplicated tabs. */
export async function acquireWindowIdentity(): Promise<{ id: string; release: () => void }> {
  const key = "pixel-studio-window-owner-v1";
  let candidate: string;
  try { candidate = sessionStorage.getItem(key) || crypto.randomUUID(); }
  catch { candidate = crypto.randomUUID(); }
  if (!navigator.locks) return { id: crypto.randomUUID(), release: () => {} };
  const claim = (id: string): Promise<{ id: string; release: () => void }> => new Promise((resolve, reject) => {
    void navigator.locks.request(`pixel-studio-owner:${id}`, { ifAvailable: true }, async lock => {
      if (!lock) { resolve(await claim(crypto.randomUUID())); return; }
      try { sessionStorage.setItem(key, id); } catch { /* Identity remains safe for this mount. */ }
      await new Promise<void>(release => resolve({ id, release }));
    }).catch(reject);
  });
  return claim(candidate);
}
