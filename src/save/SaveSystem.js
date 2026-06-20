const SAVE_KEY = 'reality-exe-save';

export class SaveSystem {
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  save(data) {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      ...data,
      savedAt: Date.now()
    }));
  }

  clear() {
    localStorage.removeItem(SAVE_KEY);
  }

  hasSave() {
    return Boolean(this.load());
  }
}
