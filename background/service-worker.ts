// @ts-nocheck

// background/service-worker.ts
import contentUrl from '../content/content.ts?url';

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

  // Register context menu for inline generation
  chrome.contextMenus.create({
    id: "jobassist-generate-answer",
    title: "Generate Answer with JobAssist",
    contexts: ["editable"]
  });
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
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: [contentUrl],
          });
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No active tab' });
        }
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
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

// ─────────────────────────────────────────────
// Context Menu: Inline Generation
// ─────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "jobassist-generate-answer" && tab.id) {
    try {
      // 1. Tell content script to show loading state
      await chrome.tabs.sendMessage(tab.id, { type: "INLINE_GENERATION_START" });

      // 2. Fetch profile, settings, and JD
      const { activeProfileId, profiles, settings } = await chrome.storage.local.get({
        activeProfileId: null,
        profiles: [],
        settings: { apiKey: '', model: 'gpt-4o-mini' }
      });
      const profile = profiles.find(p => p.id === activeProfileId);
      if (!profile || !settings.apiKey) {
        throw new Error("No active profile or missing API key.");
      }
      
      const { currentJD } = await chrome.storage.session.get({ currentJD: null });

      // 3. Get the question text from the content script
      const { questionText } = await chrome.tabs.sendMessage(tab.id, { type: "GET_ACTIVE_QUESTION" });
      if (!questionText) throw new Error("Could not detect question text.");

      // 4. Generate Answer
      const prompt = buildAnswerPrompt(questionText, profile, currentJD);
      const answer = await callOpenAI(prompt, profile.systemPrompt, settings);

      // 5. Inject answer back into the page
      await chrome.tabs.sendMessage(tab.id, { type: "INLINE_GENERATION_SUCCESS", answer });
    } catch (e) {
      console.error("[JobAssist] Context Menu Error:", e);
      chrome.tabs.sendMessage(tab.id, { type: "INLINE_GENERATION_ERROR", error: e.message }).catch(()=>{});
    }
  }
});

// AI Helpers (duplicated for context menu independence)
async function callOpenAI(userPrompt, systemPrompt, settings, maxTokens = 800, retries = 3) {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });

  for (let i = 0; i < retries; i++) {
    const response = await fetch('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model || 'gpt-4o-mini',
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices[0].message.content.trim();
    }
    
    if (response.status === 429 || response.status >= 500) {
      if (i === retries - 1) throw new Error(`Status ${response.status}`);
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1500));
    } else {
      throw new Error(`Status ${response.status}`);
    }
  }
}

function buildAnswerPrompt(question, profile, jd) {
  const p = profile;
  const info = p.personalInfo || {};
  return `You are helping a job applicant answer an application question inline. Write a concise, direct answer (2-4 sentences max unless more is specifically needed).

Applicant: ${info.fullName || p.name}
Target Role: ${jd?.title || p.targetRole}
Applying to: ${jd?.company || 'the company'}
Skills: ${(p.skills || []).join(', ')}
Experience: ${(p.experience || []).map(e => `${e.title} at ${e.company}`).join(', ')}
Summary: ${p.summary || ''}
Additional Context: ${p.additionalContext || ''}

Question: "${question}"

CRITICAL INSTRUCTIONS:
1. DIRECTLY answer the question asked. Do NOT just summarize the resume.
2. Adopt the applicant's Custom Persona if provided.

Answer (first-person, direct, tailored to the specific question):`;
}
