// background/service-worker.js

// Configure the side panel to open when clicking the extension icon
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error(error));
  }
  // Explicitly clear the popup to ensure the side panel handles the click
  if (chrome.action) {
    chrome.action.setPopup({ popup: "" }).catch(() => {});
  }
});
// Message router between popup <-> content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] || null });
    });
    return true;
  }

  if (message.type === 'INJECT_CONTENT') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content/content.js'],
          });
          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
      }
    });
    return true;
  }

  if (message.type === 'RELAY_TO_CONTENT') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message.payload, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
          } else {
            sendResponse(response);
          }
        });
      } else {
        sendResponse({ error: 'No active tab' });
      }
    });
    return true;
  }

  if (message.type === 'OPEN_DASHBOARD') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'LEARN_FIELD') {
    (async () => {
      try {
        const { activeProfileId } = await chrome.storage.local.get({ activeProfileId: null });
        if (!activeProfileId) {
          sendResponse({ success: false, error: 'No active profile' });
          return;
        }

        const { profiles } = await chrome.storage.local.get({ profiles: [] });
        const profile = profiles.find(p => p.id === activeProfileId);
        if (!profile) {
          sendResponse({ success: false, error: 'Profile not found' });
          return;
        }

        if (!profile.customFields) profile.customFields = {};
        profile.customFields[message.payload.label] = message.payload.value;
        
        await chrome.storage.local.set({ profiles });
        sendResponse({ success: true, profileName: profile.name });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }
});

// Track when tabs are updated so popup can refresh state
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // Notify popup if open
    chrome.runtime.sendMessage({ type: 'TAB_UPDATED', tab }).catch(() => {});
  }
});
