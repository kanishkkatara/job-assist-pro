// utils/storage.js — Chrome Storage Utilities

export const Storage = {
  async get(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  },

  async set(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, resolve);
    });
  },

  async remove(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(keys, resolve);
    });
  },

  async getProfiles() {
    const { profiles } = await this.get({ profiles: [] });
    return profiles;
  },

  async saveProfiles(profiles) {
    await this.set({ profiles });
  },

  async getActiveProfileId() {
    const { activeProfileId } = await this.get({ activeProfileId: null });
    return activeProfileId;
  },

  async setActiveProfileId(id) {
    await this.set({ activeProfileId: id });
  },

  async getSettings() {
    const { settings } = await this.get({
      settings: { apiKey: '', aiProvider: 'openai', model: 'gpt-4o-mini' },
    });
    return settings;
  },

  async saveSettings(settings) {
    await this.set({ settings });
  },

  async getSessionJD() {
    return new Promise((resolve) => {
      chrome.storage.session.get({ currentJD: null }, (data) => {
        resolve(data.currentJD);
      });
    });
  },

  async setSessionJD(jd) {
    return new Promise((resolve) => {
      chrome.storage.session.set({ currentJD: jd }, resolve);
    });
  },

  async clearSessionJD() {
    return new Promise((resolve) => {
      chrome.storage.session.remove('currentJD', resolve);
    });
  },
};

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
