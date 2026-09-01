export function createPreviewArtifactCache() {
  const entries = new Map();

  return {
    getOrCreate(key, factory) {
      const existing = entries.get(key);

      if (existing !== undefined) {
        return existing;
      }

      const pending = Promise.resolve().then(factory);
      entries.set(key, pending);
      void pending.catch(() => {
        if (entries.get(key) === pending) {
          entries.delete(key);
        }
      });

      return pending;
    },
    clear() {
      entries.clear();
    },
    get size() {
      return entries.size;
    },
  };
}
