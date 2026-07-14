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
            target: { tabId: tab.id, allFrames: true },
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
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (tab?.id) {
        try {
          const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
          let successResponse = null;
          let lastError = null;

          for (const frame of frames) {
            try {
              const res = await chrome.tabs.sendMessage(tab.id, message.payload, { frameId: frame.frameId });
              if (res && !res.error) {
                successResponse = res;
                // If it's a fill form or attach resume and it succeeded in this frame, we can consider it a success
                // We'll keep sending to others just in case, but usually we just want at least one success
              }
            } catch (err) {
              lastError = err;
            }
          }
          
          if (successResponse) {
            sendResponse(successResponse);
          } else {
            sendResponse({ error: lastError?.message || 'No frames responded successfully' });
          }
        } catch (err) {
          // Fallback if webNavigation is not permitted
          chrome.tabs.sendMessage(tab.id, message.payload, (response) => {
            if (chrome.runtime.lastError) {
              sendResponse({ error: chrome.runtime.lastError.message });
            } else {
              sendResponse(response || {});
            }
          });
        }
      } else {
        sendResponse({ error: 'No active tab' });
      }
    });
    return true;
  }
  if (message.type === 'AUTO_APPLY') {
    (async () => {
      try {
        const { job, profile } = message.payload;
        
        // 1. Create hidden background tab
        const tab = await chrome.tabs.create({ url: job.url, active: false });
        if (!tab.id) throw new Error("Could not create tab");

        // We mark this tab as an autonomous tab in local storage so onCompleted knows to close it
        const { autonomousTabs } = await chrome.storage.local.get({ autonomousTabs: [] });
        await chrome.storage.local.set({ autonomousTabs: [...autonomousTabs, tab.id] });

        // 2. Wait for it to load
        await new Promise<void>((resolve) => {
          chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          });
        });

        // Add a slight delay for SPA frameworks to hydrate
        await new Promise(r => setTimeout(r, 2000));

        // 3. Inject content script
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: [contentUrl]
        });

        // 4. Send FILL_FORM (give it time to fill)
        await chrome.tabs.sendMessage(tab.id, { type: 'FILL_FORM', payload: { profile } }).catch(() => {});
        await new Promise(r => setTimeout(r, 3000));

        // 5. Send SUBMIT_FORM
        await chrome.tabs.sendMessage(tab.id, { type: 'SUBMIT_FORM' }).catch(() => {});

        sendResponse({ success: true });
      } catch (e: any) {
        console.error("Auto Apply Error:", e);
        sendResponse({ success: false, error: e.message });
      }
    })();
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

let creating;
async function setupOffscreenDocument(path) {
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) return;

  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: 'Capture and transcribe interview audio'
    });
    await creating;
    creating = null;
  }
}

let copilotTranscriptBuffer = "";
let copilotGenerateTimer = null;
let activeCopilotTabId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_COPILOT') {
    (async () => {
      try {
        await setupOffscreenDocument('src/offscreen/offscreen.html');
        // Send streamId to offscreen document
        chrome.runtime.sendMessage({
          action: "process_stream",
          streamId: message.streamId
        });
        
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) activeCopilotTabId = tabs[0].id;
        
        sendResponse({ success: true });
      } catch (e) {
        console.error("Failed to start copilot", e);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === 'COPILOT_TRANSCRIPT') {
    const text = message.text.trim();
    if (text.length < 5) return;
    
    copilotTranscriptBuffer += " " + text;
    
    if (activeCopilotTabId) {
      chrome.tabs.sendMessage(activeCopilotTabId, { type: 'SHOW_COPILOT_TRANSCRIPT', text: copilotTranscriptBuffer }).catch(()=>{});
    }

    if (copilotGenerateTimer) clearTimeout(copilotGenerateTimer);
    
    // Trigger generation dynamically as interviewer speaks
    if (copilotTranscriptBuffer.split(' ').length > 5) {
      // Small debounce to not overwhelm if firing rapidly
      copilotGenerateTimer = setTimeout(() => {
        generateLiveHintStream(copilotTranscriptBuffer);
      }, 500);
    }
  }
  if (message.type === 'GENERATE_LINKEDIN_OUTREACH') {
    (async () => {
      try {
        const { activeProfileId, profiles, settings } = await chrome.storage.local.get({
          activeProfileId: null,
          profiles: [],
          settings: { apiKey: '', model: 'gpt-4o-mini' }
        });
        
        const profile = profiles.find(p => p.id === activeProfileId);
        if (!profile || !settings.apiKey) {
          sendResponse({ error: 'No active profile or missing API key' });
          return;
        }

        const { currentJD } = await chrome.storage.session.get({ currentJD: null });
        
        const prompt = `You are an expert career coach helping a candidate write a cold outreach message on LinkedIn to a recruiter or hiring manager. 
        
Target Person: ${message.targetName} (${message.targetHeadline})
Target Job: ${currentJD ? currentJD.title + ' at ' + currentJD.company : profile.targetRole}
Candidate Name: ${profile.personalInfo?.fullName || profile.name}
Candidate Background: ${(profile.experience || []).map(e => e.title + ' at ' + e.company).join(', ')}

Write a highly personalized, non-cringe, concise LinkedIn DM (under 500 characters) asking for a brief chat or referral. Mention one specific detail about their background if relevant, and tie it to the candidate's fit for the role. Keep it extremely professional but conversational. Do NOT use placeholders like [Insert Name], use the actual names provided.`;

        const draft = await callOpenAI(prompt, "You are a world-class executive networker.", settings, 200);
        sendResponse({ draft });
      } catch (e: any) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }
});

let copilotAbortController = null;

// ─────────────────────────────────────────────
// V4: Auto-Status Updates
// ─────────────────────────────────────────────
import { getApplications, updateApplicationStatus } from '../src/utils/db';

chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId === 0) { // Top-level navigation
    const url = details.url.toLowerCase();
    
    // Check if it's a success/thanks page for common ATS platforms
    if (
      url.includes('greenhouse.io') && url.includes('/thanks') ||
      url.includes('jobs.lever.co') && url.includes('/thanks') ||
      url.includes('myworkdayjobs.com') && url.includes('application-submitted')
    ) {
      try {
        const jobs = await getApplications();
        // Since we don't know the exact job ID from the success page easily, 
        // we heuristically look for jobs in 'Discovered' status whose URL matches the current domain.
        // E.g., if we just applied to a Greenhouse job, the URL has greenhouse.io in it.
        const domain = new URL(url).hostname;
        
        const matchingJob = jobs.find(j => 
          j.status === 'Discovered' && 
          j.url && 
          new URL(j.url).hostname === domain
        );
        
        if (matchingJob) {
          await updateApplicationStatus(matchingJob.id, 'Applied');
          
          // Check if this was an autonomous tab
          const { autonomousTabs } = await chrome.storage.local.get({ autonomousTabs: [] });
          if (autonomousTabs.includes(details.tabId)) {
            // It was an autonomous apply, close the tab and clean up
            chrome.tabs.remove(details.tabId);
            const newAutonomousTabs = autonomousTabs.filter((id: number) => id !== details.tabId);
            await chrome.storage.local.set({ autonomousTabs: newAutonomousTabs });
            
            chrome.notifications.create({
              type: 'basic',
              iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
              title: 'Auto-Apply Successful! ✨',
              message: `Successfully applied to ${matchingJob.company} - ${matchingJob.title} in the background.`
            });
          } else {
            // Manual apply track notification
            chrome.notifications.create({
              type: 'basic',
              iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
              title: 'Application Tracked!',
              message: `Auto-moved ${matchingJob.company} - ${matchingJob.title} to 'Applied'.`
            });
          }
        }
      } catch (e) {
        console.error('Auto-status update failed', e);
      }
    }
  }
});

async function generateLiveHintStream(transcript) {
  if (!activeCopilotTabId) return;

  if (copilotAbortController) {
    copilotAbortController.abort();
  }
  copilotAbortController = new AbortController();
  const signal = copilotAbortController.signal;

  try {
    const { activeProfileId, profiles, settings } = await chrome.storage.local.get({
      activeProfileId: null,
      profiles: [],
      settings: { apiKey: '', model: 'gpt-4o-mini' }
    });
    
    const profile = profiles.find(p => p.id === activeProfileId);
    if (!profile || !settings.apiKey) return;

    const { currentJD } = await chrome.storage.session.get({ currentJD: null });

    const prompt = `You are a Live Interview Copilot. The interviewer is speaking: "${transcript}"
    
Provide a very short, bullet-point STAR story hint for the applicant to reply with. Stream it quickly. Max 3 bullet points, extreme brevity.

Applicant Experience: ${(profile.experience || []).map(e => `${e.title} at ${e.company}`).join(', ')}
Skills: ${(profile.skills || []).join(', ')}
Target Role: ${currentJD?.title || profile.targetRole}
`;
    
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a concise interview assistant.' },
          { role: 'user', content: prompt }
        ],
      }),
      signal
    });

    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullHint = "";
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullHint += chunk;
      
      chrome.tabs.sendMessage(activeCopilotTabId, { type: 'STREAM_COPILOT_HINT', hint: fullHint }).catch(()=>{});
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error("[Copilot Hint Stream Error]", e);
    }
  }
}

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
