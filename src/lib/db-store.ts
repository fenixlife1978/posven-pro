"use client";

const STORE_PREFIX = 'new_project_';

export const Store = {
  get<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') return defaultValue;
    const saved = localStorage.getItem(STORE_PREFIX + key);
    if (!saved) return defaultValue;
    try {
      return JSON.parse(saved);
    } catch {
      return defaultValue;
    }
  },

  set<T>(key: string, value: T) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value));
  },

  init() {
    // Inicialización para el nuevo proyecto
    console.log("Nuevo proyecto inicializado");
  }
};
