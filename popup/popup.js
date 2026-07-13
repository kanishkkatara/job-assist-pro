// popup/popup.js

// ─────────────────────────────────────────────
// Storage helpers (inline — no module imports in popup)
// ─────────────────────────────────────────────
const Storage = {
  async get(keys) { return new Promise(r => chrome.storage.local.get(keys, r)); },
  async set(data) { return new Promise(r => chrome.storage.local.set(data, r)); },
  async getProfiles() { const { profiles } = await this.get({ profiles: [] }); return profiles; },
  async getSettings() { const { settings } = await this.get({ settings: { apiKey: '', model: 'gpt-4o-mini' } }); return settings; },
  async getActiveProfileId() { const { activeProfileId } = await this.get({ activeProfileId: null }); return activeProfileId; },
  async setActiveProfileId(id) { await this.set({ activeProfileId: id }); },
  async getSessionJD() {
    return new Promise(r => chrome.storage.session.get({ currentJD: null }, d => r(d.currentJD)));
  },
  async setSessionJD(jd) {
    return new Promise(r => chrome.storage.session.set({ currentJD: jd }, r));
  },
  async clearSessionJD() {
    return new Promise(r => chrome.storage.session.remove('currentJD', r));
  },
};

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────
let state = {
  profiles: [],
  settings: {},
  activeProfile: null,
  jd: null,
  analysisCache: null, // cached analyst output keyed by jd url
};

// ─────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────
function getInitials(name) {
  return name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
}

function setLoading(btnId, loading, customMessage = null) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (loading) {
    btn.dataset.originalContent = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> ${customMessage || 'Working...'}`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.originalContent || '';
    btn.disabled = false;
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy');
    ta.remove();
  });
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showFillBanner(message) {
  const banner = document.getElementById('fill-banner');
  document.getElementById('fill-banner-text').textContent = message;
  banner.classList.add('open');
  setTimeout(() => banner.classList.remove('open'), 4000);
}

// ─────────────────────────────────────────────
// Message to content script via background
// ─────────────────────────────────────────────
async function sendToContent(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'RELAY_TO_CONTENT', payload }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ error: chrome.runtime.lastError.message });
      } else {
        resolve(response || {});
      }
    });
  });
}

// ─────────────────────────────────────────────
// Profile UI
// ─────────────────────────────────────────────
function renderProfileSelect() {
  const select = document.getElementById('profile-select');
  const profileCount = document.getElementById('footer-profile-count');
  select.innerHTML = '<option value="">— Select a profile —</option>';

  for (const p of state.profiles) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name}${p.targetRole ? ' — ' + p.targetRole : ''}`;
    select.appendChild(opt);
  }

  if (state.activeProfile) {
    select.value = state.activeProfile.id;
    document.getElementById('profile-avatar').textContent = getInitials(state.activeProfile.name);
  }

  profileCount.textContent = `${state.profiles.length} profile${state.profiles.length !== 1 ? 's' : ''}`;
}

function updateMainUI() {
  const noProfileState = document.getElementById('no-profile-state');
  const mainActions = document.getElementById('main-actions');
  const headerSub = document.getElementById('header-sub');

  if (state.profiles.length === 0) {
    noProfileState.style.display = 'block';
    mainActions.style.display = 'none';
    headerSub.textContent = 'No profiles — open dashboard';
    return;
  }

  noProfileState.style.display = 'none';

  if (state.activeProfile) {
    mainActions.style.display = 'block';
    headerSub.textContent = `Active: ${state.activeProfile.name}`;
    
    // Draggable resume logic
    const draggableEl = document.getElementById('draggable-resume');
    const resumeNameEl = document.getElementById('drag-resume-name');
    if (state.activeProfile.resumeBase64 && state.activeProfile.resumeFileName) {
      draggableEl.style.display = 'block';
      resumeNameEl.textContent = state.activeProfile.resumeFileName;
    } else {
      draggableEl.style.display = 'none';
    }
  } else {
    mainActions.style.display = 'none';
    headerSub.textContent = 'Select a profile below';
    document.getElementById('draggable-resume').style.display = 'none';
  }
}

// ─────────────────────────────────────────────
// JD UI
// ─────────────────────────────────────────────
function updateJdUI() {
  const dot = document.getElementById('jd-dot');
  const title = document.getElementById('jd-title');
  const sub = document.getElementById('jd-sub');
  const actionText = document.getElementById('jd-action-text');
  const previewWrap = document.getElementById('jd-preview-wrap');
  const previewText = document.getElementById('jd-preview-text');

  if (state.jd) {
    dot.classList.add('active');
    title.textContent = state.jd.title || 'Job Description Captured';
    sub.textContent = state.jd.company ? `at ${state.jd.company}` : new URL(state.jd.url).hostname;
    actionText.textContent = 'Recapture ›';
    previewWrap.style.display = 'block';
    previewText.textContent = state.jd.text?.substring(0, 250) + '...';
  } else {
    dot.classList.remove('active');
    title.textContent = 'No job description captured';
    sub.textContent = 'Navigate to a job listing, then click here';
    actionText.textContent = 'Capture ›';
    previewWrap.style.display = 'none';
  }
}

// ─────────────────────────────────────────────
// JD Capture
// ─────────────────────────────────────────────
async function captureJD() {
  setLoading('capture-jd-btn', true);
  try {
    const result = await sendToContent({ type: 'EXTRACT_JD' });
    if (result.error) throw new Error(result.error);
    if (result.jd) {
      await Storage.setSessionJD(result.jd);
      state.jd = result.jd;
      updateJdUI();
      showFillBanner(`✅ JD captured: "${result.jd.title || 'Job Description'}"`);
    }
  } catch (e) {
    showFillBanner('❌ Could not capture JD. Make sure you\'re on a job listing page.');
    console.error('[JobAssist] JD capture error:', e);
  } finally {
    setLoading('capture-jd-btn', false);
  }
}

// ─────────────────────────────────────────────
// Auto-fill Form
// ─────────────────────────────────────────────
async function autoFillForm() {
  if (!state.activeProfile) return;
  setLoading('autofill-btn', true);
  try {
    const result = await sendToContent({ type: 'FILL_FORM', profile: state.activeProfile, jd: state.jd });
    if (result.error) {
      showFillBanner('❌ Could not access page. Try refreshing the page.');
    } else if (result.filled === 0) {
      showFillBanner('⚠ No matching fields found on this page.');
    } else {
      showFillBanner(`✅ Filled ${result.filled} field${result.filled !== 1 ? 's' : ''}!`);
    }
  } catch (e) {
    showFillBanner('❌ Error filling form. Refresh the page and try again.');
  } finally {
    setLoading('autofill-btn', false);
  }
}

// ─────────────────────────────────────────────
// Answer Questions
// ─────────────────────────────────────────────
async function answerQuestions() {
  if (!state.activeProfile) return;
  setLoading('answer-questions-btn', true, '🔍 Analysing fit...');

  try {
    const result = await sendToContent({ type: 'GET_QUESTIONS' });
    const questions = result?.questions || [];

    const qaPanel = document.getElementById('qa-panel');
    const qaList = document.getElementById('qa-list');
    const qaEmpty = document.getElementById('qa-empty');
    qaList.innerHTML = '';

    if (questions.length === 0) {
      qaEmpty.style.display = 'block';
      qaList.style.display = 'none';
    } else {
      qaEmpty.style.display = 'none';
      qaList.style.display = 'flex';

      // Run ONE shared analyst call for ALL questions on this page
      const analysis = await runAnalysis(state.activeProfile, state.jd);
      // Update label mid-flight WITHOUT overwriting originalContent
      const ansBtn = document.getElementById('answer-questions-btn');
      if (ansBtn) ansBtn.innerHTML = `<span class="spinner"></span> ✍️ Writing answers...`;

      for (const q of questions) {
        const answer = await generateAnswer(q.question, analysis);
        const item = document.createElement('div');
        item.className = 'qa-item';
        const escapedQ = escapeHTML(q.question.substring(0, 120)) + (q.question.length > 120 ? '...' : '');
        const escapedA = escapeHTML(answer);
        
        item.innerHTML = `
          <div class="qa-question">❓ ${escapedQ}</div>
          <div class="qa-answer">${escapedA}</div>
          <div class="qa-actions">
            <input type="text" class="feedback-input qa-feedback-input" placeholder="Feedback...">
            <button class="btn btn-secondary qa-regen-btn" title="Regenerate">↻</button>
            <button class="qa-fill-btn" data-id="${escapeHTML(q.id)}" data-answer="${escapeHTML(encodeURIComponent(answer))}" style="margin-left:auto; width:auto; border-top:none;">
              Fill ↗
            </button>
          </div>`;
          
        const fillBtn = item.querySelector('.qa-fill-btn');
        fillBtn.addEventListener('click', async (e) => {
          const qId = e.currentTarget.dataset.id;
          const ans = decodeURIComponent(e.currentTarget.dataset.answer);
          await sendToContent({ type: 'FILL_ANSWER', questionId: qId, answer: ans });
          showFillBanner('✅ Answer filled!');
        });

        const regenBtn = item.querySelector('.qa-regen-btn');
        const feedbackInput = item.querySelector('.qa-feedback-input');
        
        regenBtn.addEventListener('click', async (e) => {
          regenBtn.textContent = '⏳';
          regenBtn.disabled = true;
          try {
            const feedback = feedbackInput.value.trim() || null;
            // Reuse cached analysis; pass feedback for revision
            const cachedAnalysis = state.analysisCache?.data || null;
            const newAnswer = await generateAnswer(q.question, cachedAnalysis, feedback);
            item.querySelector('.qa-answer').textContent = newAnswer;
            fillBtn.dataset.answer = encodeURIComponent(newAnswer);
            feedbackInput.value = '';
          } catch (err) {
            showFillBanner('❌ Error regenerating answer.');
          } finally {
            regenBtn.textContent = '↻';
            regenBtn.disabled = false;
          }
        });
        
        qaList.appendChild(item);
      }
    }

    // Close cover letter if open
    document.getElementById('cover-letter-panel').classList.remove('open');
    qaPanel.classList.add('open');
  } catch (e) {
    showFillBanner('❌ Error detecting questions.');
    console.error('[JobAssist] Answer questions error:', e);
  } finally {
    setLoading('answer-questions-btn', false);
  }
}

// ─────────────────────────────────────────────
// Cover Letter Generation
// ─────────────────────────────────────────────
async function generateCoverLetter() {
  if (!state.activeProfile) return;
  
  const regenBtn = document.getElementById('regen-cover-letter');
  const feedbackInput = document.getElementById('cl-feedback-input');
  let feedback = null;
  if (feedbackInput?.value) {
    feedback = feedbackInput.value.trim();
    regenBtn.textContent = '⏳';
    regenBtn.disabled = true;
  }

  setLoading('gen-cover-letter-btn', true, '🔍 Analysing fit...');

  try {
    // generateCoverLetterText internally calls runAnalysis then writes
    // Update the button text mid-flight to show the writing stage
    setTimeout(() => {
      const btn = document.getElementById('gen-cover-letter-btn');
      if (btn && btn.disabled) {
        btn.innerHTML = `<span class="spinner"></span> ✍️ Writing...`;
      }
    }, 2500);

    const coverLetter = await generateCoverLetterText(feedback);

    const panel = document.getElementById('cover-letter-panel');
    document.getElementById('cover-letter-text').textContent = coverLetter;
    if (feedbackInput) feedbackInput.value = '';

    document.getElementById('qa-panel').classList.remove('open');
    panel.classList.add('open');
  } catch (e) {
    showFillBanner('❌ Error generating cover letter.');
    console.error('[JobAssist] Cover letter error:', e);
  } finally {
    setLoading('gen-cover-letter-btn', false);
    regenBtn.textContent = '↻ Regenerate';
    regenBtn.disabled = false;
  }
}

// ─────────────────────────────────────────────
// AI / Template Generation
// ─────────────────────────────────────────────

// Stage 1: Analyst — reasons about fit before any writing happens
function buildAnalystPrompt(profile, jd) {
  const p = profile;
  const info = p.personalInfo || {};
  return `You are an expert career strategist and talent analyst. Your job is to perform a deep strategic analysis of a candidate's profile against a specific job description.

Analyze the following and return ONLY a valid JSON object — no markdown, no prose, no code fences.

Candidate Profile:
- Name: ${info.fullName || p.name}
- Summary: ${p.summary || ''}
- Skills: ${(p.skills || []).join(', ')}
- Experience:\n${(p.experience || []).map(e => `  * ${e.title} at ${e.company} (${e.startDate}–${e.endDate}): ${e.description}`).join('\n')}
- Additional Context: ${p.additionalContext || ''}

${jd ? `Job Description:\n${jd.text?.substring(0, 3000)}\n\nCompany: ${jd.company || 'Unknown'}\nRole: ${jd.title || 'Unknown'}` : `Target Role: ${p.targetRole}`}

Return a JSON object with EXACTLY these keys:
{
  "topOverlap": ["array of strings — specific resume items that directly match JD requirements, be concrete not generic"],
  "bestExperiencesToLead": ["array of 1-2 company names from the profile that are most relevant to THIS role"],
  "narrativeArc": "1 sentence — how the candidate's career trajectory leads naturally to this role",
  "genuineMotivation": "1-2 sentences — a specific, honest reason why THIS company/role is a good fit based on their actual background, NOT generic passion statements",
  "hiddenStrengths": ["array — skills or experiences the candidate may be underselling that are highly relevant"],
  "redFlags": ["array — potential recruiter concerns to address proactively. Empty array if none."],
  "missingSkills": ["array — required JD skills absent from the profile. Empty array if none."],
  "writingPriorities": "2-3 sentences of specific instructions for the writer: what to lead with, what to explain, what to avoid, what angle creates the strongest case"
}`;
}

// Cache key based on jd url + profile id so we don't re-analyse on every regen
function getAnalysisCacheKey(profile, jd) {
  return `${profile.id || profile.name}::${jd?.url || jd?.company || 'nojd'}`;
}

async function runAnalysis(profile, jd) {
  if (!state.settings?.apiKey) return null; // offline mode — skip analysis

  const cacheKey = getAnalysisCacheKey(profile, jd);
  if (state.analysisCache?.key === cacheKey) {
    console.log('[JobAssist] Using cached analysis.');
    return state.analysisCache.data;
  }

  console.log('[JobAssist] Running analyst pass...');
  try {
    const raw = await callOpenAI(buildAnalystPrompt(profile, jd), null, 600);
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const analysis = JSON.parse(cleaned);
    state.analysisCache = { key: cacheKey, data: analysis };
    console.log('[JobAssist] Analysis result:', analysis);
    return analysis;
  } catch (err) {
    console.warn('[JobAssist] Analyst pass failed — falling back to single-pass generation.', err);
    return null;
  }
}

async function generateCoverLetterText(feedback = null) {
  const profile = state.activeProfile;
  const jd = state.jd;

  if (state.settings?.apiKey) {
    const analysis = await runAnalysis(profile, jd);
    return await callOpenAI(buildCoverLetterPrompt(profile, jd, analysis, feedback), profile.systemPrompt);
  }
  return templateCoverLetter(profile, jd);
}

async function generateAnswer(question, analysis = null, feedback = null) {
  const profile = state.activeProfile;
  const jd = state.jd;

  if (state.settings?.apiKey) {
    return await callOpenAI(buildAnswerPrompt(question, profile, jd, analysis, feedback), profile.systemPrompt);
  }
  return templateAnswer(question, profile);
}

async function callOpenAI(userPrompt, systemPrompt = null, maxTokens = 800, retries = 3) {
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: userPrompt });

  for (let i = 0; i < retries; i++) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.settings.apiKey}`,
      },
      body: JSON.stringify({
        model: state.settings.model || 'gpt-4o-mini',
        messages: messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices[0].message.content.trim();
    }

    let errorMsg = `Status ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.error?.message) errorMsg = errorData.error.message;
    } catch (e) {
      // ignore JSON parse error on non-ok responses
    }

    // Retry on 429 (Rate Limit) or 5xx (Server Error)
    if (response.status === 429 || response.status >= 500) {
      if (i === retries - 1) throw new Error(`OpenAI API error: ${errorMsg}`);
      const delayMs = Math.pow(2, i) * 1500; // 1.5s, 3s
      console.warn(`[JobAssist] OpenAI error (${response.status}). Retrying in ${delayMs}ms...`, errorMsg);
      await new Promise(r => setTimeout(r, delayMs));
    } else {
      // 400, 401, 403, etc — do not retry
      throw new Error(`OpenAI API error: ${errorMsg}`);
    }
  }
}

function buildStrategicBrief(analysis) {
  if (!analysis) return '';
  const lines = [];
  if (analysis.topOverlap?.length) lines.push(`Key Overlaps: ${analysis.topOverlap.join(' | ')}`);
  if (analysis.bestExperiencesToLead?.length) lines.push(`Lead with these experiences: ${analysis.bestExperiencesToLead.join(', ')}`);
  if (analysis.narrativeArc) lines.push(`Career narrative: ${analysis.narrativeArc}`);
  if (analysis.genuineMotivation) lines.push(`Motivation angle: ${analysis.genuineMotivation}`);
  if (analysis.hiddenStrengths?.length) lines.push(`Hidden strengths to surface: ${analysis.hiddenStrengths.join(', ')}`);
  if (analysis.redFlags?.length) lines.push(`Address proactively: ${analysis.redFlags.join(', ')}`);
  if (analysis.missingSkills?.length) lines.push(`Skills not on profile (don't fabricate): ${analysis.missingSkills.join(', ')}`);
  if (analysis.writingPriorities) lines.push(`Writing strategy: ${analysis.writingPriorities}`);
  return lines.length ? `\n\nSTRATEGIC BRIEF (from pre-analysis — follow this exactly):\n${lines.join('\n')}` : '';
}

function buildCoverLetterPrompt(profile, jd, analysis = null, feedback = null) {
  const p = profile;
  const info = p.personalInfo || {};
  let basePrompt = `Write a cover letter for a job application.

Applicant Profile:
- Name: ${info.fullName || p.name}
- Target Role: ${p.targetRole || 'the position'}
- Skills: ${(p.skills || []).join(', ')}
- Summary: ${p.summary || ''}
- Experience: ${(p.experience || []).map(e => `${e.title} at ${e.company} (${e.startDate}–${e.endDate}): ${e.description}`).join('\n')}
- Additional Context: ${p.additionalContext || ''}
${p.resumeText ? `\nResume Summary (first 1000 chars):\n${p.resumeText.substring(0, 1000)}` : ''}

${jd ? `Job Description:\n${jd.text?.substring(0, 2000)}\n\nCompany: ${jd.company || 'the company'}\nRole: ${jd.title || p.targetRole}` : `Applying for: ${p.targetRole}`}
${buildStrategicBrief(analysis)}

Write a 2-3 paragraph cover letter following these strict rules:
1. Do NOT write a traditional corporate cover letter. Avoid standard openings (e.g., "I am writing to apply") and generic closings (e.g., "Thank you for considering").
2. Open with a strong, grounded technical hook connecting to the company's specific product or problem.
3. Lead with the experiences identified in the Strategic Brief. Do not list everything.
4. Close abruptly and confidently (e.g. "I'd love to chat about building this at [Company].").
5. Adopt the applicant's Custom Persona exactly. DO NOT use generic AI cover letter language.`;

  if (feedback) {
    basePrompt += `\n\nCRITICAL INSTRUCTION FOR REVISION:\nThe user rejected your previous cover letter and provided this feedback. You MUST rewrite completely incorporating this: "${feedback}"`;
  }
  return basePrompt;
}

function buildAnswerPrompt(question, profile, jd, analysis = null, feedback = null) {
  const p = profile;
  const info = p.personalInfo || {};
  let basePrompt = `You are helping a job applicant answer an application question. Write a concise, direct answer (2-4 sentences max unless more is specifically needed).

Applicant: ${info.fullName || p.name}
Target Role: ${jd?.title || p.targetRole}
Applying to: ${jd?.company || 'the company'}
Skills: ${(p.skills || []).join(', ')}
Experience: ${(p.experience || []).map(e => `${e.title} at ${e.company}`).join(', ')}
Summary: ${p.summary || ''}
Additional Context: ${p.additionalContext || ''}
${p.systemPrompt ? `Custom Persona / Rules: ${p.systemPrompt}` : ''}
${buildStrategicBrief(analysis)}

Question: "${question}"

CRITICAL INSTRUCTIONS:
1. DIRECTLY answer the question asked. Do NOT just summarize the applicant's resume.
2. If asking "Why this role/company" or "What excites you", use the genuineMotivation and topOverlap from the Strategic Brief to give a specific, grounded answer.
3. If asking for salary expectations, mention a specific range based on location (e.g. 100,000 EUR or 40 LPA INR). NEVER say "open to discussion".
4. Lead with the bestExperiencesToLead from the Strategic Brief when relevant.
5. Adopt the applicant's Custom Persona if provided.

Answer (first-person, direct, tailored to the specific question):`;

  if (feedback) {
    basePrompt += `\n\nCRITICAL INSTRUCTION FOR REVISION:\nThe user rejected your previous answer. Rewrite completely following this feedback: "${feedback}"`;
  }
  return basePrompt;
}

function templateCoverLetter(profile, jd) {
  const info = profile.personalInfo || {};
  const name = info.fullName || profile.name || 'I';
  const role = jd?.title || profile.targetRole || 'the position';
  const company = jd?.company || 'your company';
  const skills = (profile.skills || []).slice(0, 5).join(', ');
  const latestExp = profile.experience?.[0];
  const expStr = latestExp ? `As ${latestExp.title} at ${latestExp.company}, I ${latestExp.description?.substring(0, 150) || 'delivered impactful results'}` : '';

  return `Dear Hiring Manager,

I am excited to apply for the ${role} position at ${company}. With my expertise in ${skills || 'the relevant technical domains'} and a proven track record of delivering results, I am confident I would be a strong addition to your team.

${expStr ? expStr + '.' : ''} ${profile.summary || `My background aligns closely with the requirements of this role, and I am passionate about the work ${company} does.`}

I am particularly drawn to this opportunity because it aligns with my career goals in ${profile.targetRole || role}. I thrive in collaborative environments and am excited about the prospect of contributing my skills to your team.

I would welcome the opportunity to discuss how my background and passion can contribute to ${company}'s success. Thank you for considering my application.

Best regards,
${name}
${info.email ? info.email : ''}
${info.phone ? info.phone : ''}`;
}

function templateAnswer(question, profile) {
  const q = question.toLowerCase();
  const info = profile.personalInfo || {};
  const name = info.fullName || profile.name;
  const skills = (profile.skills || []).slice(0, 3).join(', ');
  const latestExp = profile.experience?.[0];
  const company = latestExp?.company || 'my previous company';

  if (q.includes('why') && (q.includes('company') || q.includes('us') || q.includes('here') || q.includes('role'))) {
    return `I am drawn to this role because it aligns perfectly with my expertise in ${skills} and my passion for ${profile.targetRole || 'this domain'}. I have closely followed your company's work and I am excited about the opportunity to contribute to your mission while continuing to grow professionally.`;
  }
  if (q.includes('excite') || q.includes('interest')) {
    return `I am incredibly excited about the opportunity to bring my background in ${skills} to this role. Specifically, the chance to tackle complex challenges and drive execution aligns perfectly with my professional goals and past experience at ${company}.`;
  }
  if (q.includes('strength') || q.includes('best quality')) {
    return `My key strength is ${skills ? skills.split(',')[0].trim() : 'problem-solving'}. At ${company}, I consistently leveraged this to deliver impactful results, including ${profile.experience?.[0]?.description?.split('.')[0] || 'driving significant improvements in team performance and product quality'}.`;
  }
  if (q.includes('weakness') || q.includes('improve')) {
    return `I tend to be very detail-oriented, which occasionally means I spend extra time perfecting deliverables. I have learned to balance quality with deadlines by using structured time management techniques, which has made me more effective overall.`;
  }
  if (q.includes('salary') || q.includes('compensation')) {
    return info.expectedSalary || `I am flexible and open to discussing compensation based on the full scope of the role and benefits package.`;
  }
  if (q.includes('available') || q.includes('start')) {
    return info.availability || 'I am available to start within two weeks of receiving an offer.';
  }
  if (q.includes('experience') || q.includes('background')) {
    return `I have ${info.yearsExperience ? info.yearsExperience + ' years of' : 'extensive'} experience in ${skills}. ${latestExp ? `Most recently as ${latestExp.title} at ${latestExp.company}, I ${latestExp.description?.substring(0, 150) || 'delivered meaningful results'}.` : ''}`;
  }
  if (q.includes('team') || q.includes('collaborate')) {
    return `I strongly believe in collaborative work and open communication. I have experience working in cross-functional teams, contributing both technically and strategically while ensuring alignment with broader team goals.`;
  }

  // Generic fallback
  return `${profile.summary || `With my background in ${skills}, I am well-positioned to address this. I approach challenges methodically and have a track record of delivering results in ${profile.targetRole || 'this field'}.`}`;
}

// ─────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────
async function init() {
  // Load state
  state.profiles = await Storage.getProfiles();
  state.settings = await Storage.getSettings();
  state.jd = await Storage.getSessionJD();

  const savedId = await Storage.getActiveProfileId();
  if (savedId && state.profiles.length > 0) {
    state.activeProfile = state.profiles.find(p => p.id === savedId) || null;
  }

  renderProfileSelect();
  updateMainUI();
  updateJdUI();

  // Profile select change
  document.getElementById('profile-select').addEventListener('change', async (e) => {
    const id = e.target.value;
    state.activeProfile = state.profiles.find(p => p.id === id) || null;
    state.analysisCache = null; // invalidate cache on profile change
    await Storage.setActiveProfileId(id || null);
    document.getElementById('profile-avatar').textContent = state.activeProfile ? getInitials(state.activeProfile.name) : '?';
    updateMainUI();

    // Close any open result panels
    document.getElementById('cover-letter-panel').classList.remove('open');
    document.getElementById('qa-panel').classList.remove('open');
  });

  // JD status click → capture
  document.getElementById('jd-status').addEventListener('click', captureJD);
  document.getElementById('capture-jd-btn').addEventListener('click', captureJD);

  // Auto-fill
  document.getElementById('autofill-btn').addEventListener('click', autoFillForm);

  // Answer Questions
  document.getElementById('answer-questions-btn').addEventListener('click', answerQuestions);

  // Cover Letter
  document.getElementById('gen-cover-letter-btn').addEventListener('click', generateCoverLetter);

  // Regen cover letter
  document.getElementById('regen-cover-letter').addEventListener('click', generateCoverLetter);

  // Resume Drag & Drop
  const draggableResume = document.getElementById('draggable-resume');
  draggableResume.addEventListener('dragstart', (e) => {
    if (state.activeProfile && state.activeProfile.resumeBase64) {
      // Create a DataTransfer item for the file
      const fileName = state.activeProfile.resumeFileName || 'resume.pdf';
      e.dataTransfer.setData('DownloadURL', `application/pdf:${fileName}:${state.activeProfile.resumeBase64}`);
    }
  });

  // Copy cover letter
  document.getElementById('copy-cover-letter').addEventListener('click', () => {
    const text = document.getElementById('cover-letter-text').textContent;
    copyToClipboard(text);
    const btn = document.getElementById('copy-cover-letter');
    const orig = btn.textContent;
    btn.textContent = '✅ Copied!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  });

  // Close panels
  document.getElementById('close-cover-letter').addEventListener('click', () => {
    document.getElementById('cover-letter-panel').classList.remove('open');
  });
  document.getElementById('close-qa').addEventListener('click', () => {
    document.getElementById('qa-panel').classList.remove('open');
  });

  // Clear JD
  document.getElementById('clear-jd-btn').addEventListener('click', async () => {
    await Storage.clearSessionJD();
    state.jd = null;
    updateJdUI();
  });

  // Open dashboard
  document.getElementById('open-dashboard-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
  });
  document.getElementById('footer-dashboard-link').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
  });
  document.getElementById('create-profile-btn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
  });
}

document.addEventListener('DOMContentLoaded', init);
