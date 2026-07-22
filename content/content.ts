// @ts-nocheck

// content/content.js — Injected into every page

(function () {
  if (window.__jobAssistInjected) return;
  window.__jobAssistInjected = true;

  // ─────────────────────────────────────────────
  // JD Extraction
  // ─────────────────────────────────────────────
  function extractJobDescription() {
    const bodyText = document.body.innerText;

    // Try to find job-specific sections
    const jdSections = [];
    const sectionKeywords = [
      'about the role', 'about this role', 'job description', 'responsibilities',
      'what you\'ll do', 'what you will do', 'requirements', 'qualifications',
      'what we\'re looking for', 'what we are looking for', 'about the team',
      'about the company', 'benefits', 'nice to have', 'preferred qualifications',
      'minimum qualifications', 'basic qualifications'
    ];

    // Extract page title and company
    const title = document.title;
    const url = window.location.href;

    // Try LinkedIn specific selectors
    const linkedinJobTitle = document.querySelector('.job-details-jobs-unified-top-card__job-title, h1.t-24, h3.base-search-card__title, .job-title, .t-24.t-bold');
    const linkedinCompany = document.querySelector('.job-details-jobs-unified-top-card__company-name, .topcard__org-name-link, h4.base-search-card__subtitle, .job-details-jobs-unified-top-card__primary-description a');
    const linkedinDesc = document.querySelector('#job-details, .jobs-description__content, .jobs-description-content__text, .show-more-less-html__markup, .job-view-layout');

    // Try Greenhouse selectors
    const greenhouseTitle = document.querySelector('#header h1, .app-title');
    const greenhouseDesc = document.querySelector('#content, .job-post');

    // Try Lever selectors
    const leverTitle = document.querySelector('.posting-header h2');
    const leverDesc = document.querySelector('.posting-description');

    // Try Workday selectors
    const workdayDesc = document.querySelector('[data-automation-id="jobPostingDescription"]');

    // Collect extracted content
    let jobTitle = linkedinJobTitle?.innerText?.trim() ||
      greenhouseTitle?.innerText?.trim() ||
      leverTitle?.innerText?.trim() ||
      document.querySelector('h1')?.innerText?.trim() ||
      title;

    let company = linkedinCompany?.innerText?.trim() || '';

    let descriptionText = linkedinDesc?.innerText?.trim() ||
      greenhouseDesc?.innerText?.trim() ||
      leverDesc?.innerText?.trim() ||
      workdayDesc?.innerText?.trim() ||
      bodyText.substring(0, 8000);

    // Clean up
    descriptionText = descriptionText
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
      .substring(0, 10000);

    return {
      url,
      title: jobTitle,
      company,
      text: descriptionText,
      capturedAt: new Date().toISOString(),
    };
  }

  // ─────────────────────────────────────────────
  // Form Field Detection
  // ─────────────────────────────────────────────
  const FIELD_PATTERNS = {
    fullName: /\b(full.?name|your.?name|name)\b/i,
    firstName: /\b(first.?name|given.?name|fname)\b/i,
    lastName: /\b(last.?name|surname|family.?name|lname)\b/i,
    email: /\b(email|e-mail|mail)\b/i,
    phone: /\b(phone|mobile|cell|telephone|contact.?number)\b/i,
    location: /\b(city|location|address|state|country|region|zip|postal)\b/i,
    linkedin: /\b(linkedin|linked.in)\b/i,
    github: /\b(github|git.?hub)\b/i,
    website: /\b(website|portfolio|personal.?site|url|web)\b/i,
    currentTitle: /\b(current.?title|job.?title|position|role)\b/i,
    currentCompany: /\b(current.?company|employer|company.?name)\b/i,
    yearsExperience: /\b(years?.?of?.?experience|experience.?years?)\b/i,
    salary: /\b(salary|compensation|pay|expected.?salary|desired.?salary)\b/i,
    coverLetter: /\b(cover.?letter|why.?do.?you|motivation|introduction|tell.?us.?about)\b/i,
    startDate: /\b(start.?date|available|availability|notice.?period)\b/i,
    referral: /\b(referral|referred|how.?did.?you.?hear|source)\b/i,
  };

  function extractLabel(el) {
    const attrs = [
      el.getAttribute('name') || '',
      el.getAttribute('id') || '',
      el.getAttribute('placeholder') || '',
      el.getAttribute('aria-label') || '',
      el.getAttribute('autocomplete') || '',
    ].join(' ').toLowerCase();

    let labelText = '';
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label) labelText = label.innerText;
    }
    
    if (!labelText) {
      let current = el.parentElement;
      let depth = 0;
      while (current && depth < 4) {
        const label = current.querySelector('label');
        if (label) {
          labelText = label.innerText;
          break;
        }
        
        const prev = current.previousElementSibling;
        if (prev && prev.innerText && prev.innerText.trim().length < 50) {
          labelText = prev.innerText.trim();
          break;
        }
        
        current = current.parentElement;
        depth++;
      }
    }
    return { labelText: labelText ? labelText.trim() : '', attrs };
  }

  function classifyField(el, labelText, attrs) {
    const searchText = attrs + ' ' + labelText.toLowerCase();

    for (const [fieldType, pattern] of Object.entries(FIELD_PATTERNS)) {
      if (pattern.test(searchText)) return fieldType;
    }
    return null;
  }

  function detectFormFields() {
    const inputs = Array.from(document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, select, [contenteditable="true"]'
    )).filter(el => el.offsetParent !== null); // only visible

    const fields = [];
    for (const el of inputs) {
      const { labelText, attrs } = extractLabel(el);
      const fieldType = classifyField(el, labelText, attrs);
      
      // We push all elements so we can check them against customFields
      fields.push({ element: el, fieldType, labelText });
    }
    return fields;
  }

  let openQuestionsMap = {};

  function detectOpenQuestions() {
    const questions = [];
    openQuestionsMap = {}; // Reset map

    // 1. Text Inputs and Textareas
    const textFields = Array.from(document.querySelectorAll('textarea, div[contenteditable="true"], input[type="text"]')).filter(
      el => el.offsetParent !== null && !el.disabled && el.dataset.jobassistFilled !== 'true'
    );

    for (const ta of textFields) {
      const { labelText } = extractLabel(ta);
      let questionText = labelText || ta.getAttribute('aria-label') || ta.getAttribute('placeholder') || '';
      
      if (!questionText) {
        let node = ta;
        for (let i = 0; i < 4 && node; i++) {
          if (node.previousElementSibling && node.previousElementSibling.innerText) {
            questionText = node.previousElementSibling.innerText;
            break;
          }
          node = node.parentElement;
        }
      }

      questionText = questionText.replace(/\*/g, '').trim();
      if (questionText && questionText.length > 10 && !questionText.match(/^(type here|enter text|optional|search)/i)) {
        const id = ta.id || ta.name || `field_${questions.length}`;
        const qObj = {
          id,
          type: 'text',
          question: questionText.substring(0, 300),
          element: ta,
        };
        questions.push(qObj);
        openQuestionsMap[id] = qObj;
      }
    }

    // 2. Radio Groups
    const radios = Array.from(document.querySelectorAll('input[type="radio"]')).filter(
      el => el.offsetParent !== null && !el.disabled && el.dataset.jobassistFilled !== 'true'
    );
    
    const radioGroups = {};
    for (const r of radios) {
      if (r.name) {
        if (!radioGroups[r.name]) radioGroups[r.name] = [];
        radioGroups[r.name].push(r);
      }
    }

    for (const [name, group] of Object.entries(radioGroups)) {
      let container = group[0].closest('fieldset, .field, .form-group, div.application-question, div[class*="question"]');
      let questionText = '';
      if (container) {
        const legend = container.querySelector('legend');
        if (legend) {
          questionText = legend.innerText;
        } else {
           const lines = container.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 10 && !['Yes', 'No', 'True', 'False'].includes(l));
           if (lines.length > 0) questionText = lines[0];
        }
      }
      
      const options = group.map(r => {
        let text = r.value;
        if (r.id) {
          try {
            const l = document.querySelector(`label[for="${CSS.escape(r.id)}"]`);
            if (l) text = l.innerText;
          } catch(e) {}
        }
        if (!text || text === 'on') {
          const parentLabel = r.closest('label');
          if (parentLabel) text = parentLabel.innerText;
        }
        return text.trim();
      }).filter(Boolean);

      questionText = questionText.replace(/\*/g, '').trim();

      if (questionText && questionText.length > 10 && options.length > 0) {
        const id = `radio_${name}`;
        const qObj = {
          id,
          type: 'radio',
          question: `${questionText} (Options: ${options.join(', ')})`,
          element: group,
        };
        questions.push(qObj);
        openQuestionsMap[id] = qObj;
      }
    }

    return questions;
  }

  // ─────────────────────────────────────────────
  // Form Filling & Learning
  // ─────────────────────────────────────────────
  function setNativeValue(el, value) {
    el.dataset.jobassistFilled = 'true';
    if (el.focus) el.focus();

    if (el.isContentEditable) {
      el.textContent = value;
    } else {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
        'value'
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, value);
      } else {
        el.value = value;
      }
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    // React synthetic events sometimes need standard key codes
    el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown', keyCode: 40 }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'ArrowDown', keyCode: 40 }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Do NOT blur. Blurring immediately closes autocomplete dropdowns (like Location).
  }

  function getSmartSalary(jdText, fallbackSalary) {
    if (!jdText) return fallbackSalary || '95,000 - 110,000 EUR';
    
    // First, try to extract an explicitly mentioned salary range from the JD
    const salaryRegex = /(?:[$£€₹]|INR|EUR|USD|GBP)?\s*(\d+(?:,\d+)+|\d+\.?\d*k|\d+\s*LPA|\d{2,3})\s*(?:-|to)\s*(?:[$£€₹]|INR|EUR|USD|GBP)?\s*(\d+(?:,\d+)+|\d+\.?\d*k|\d+\s*LPA|\d{2,3})\s*(?:INR|EUR|USD|GBP|LPA)?/gi;
    const matches = [...jdText.matchAll(salaryRegex)];
    for (const match of matches) {
      const full = match[0].trim();
      // Ensure it looks like a salary and not a year range like 2021-2022
      if (!full.includes('202') && !full.includes('201') && !full.includes('200')) {
        if (/[$£€₹k]|000|lpa|inr|eur|usd|gbp/i.test(full)) {
          return full; // Return the exact range mentioned in the JD!
        }
      }
    }
    
    // If no explicit range found, fallback to regional logic
    const text = jdText.toLowerCase();
    if (text.includes('₹') || text.includes('inr') || text.includes('lpa') || text.includes('india') || text.includes('bangalore') || text.includes('bengaluru')) {
      return '38,00,000 - 45,00,000 INR';
    }
    if (text.includes('€') || text.includes('eur') || text.includes('euro') || text.includes('berlin') || text.includes('germany') || text.includes('amsterdam') || text.includes('paris')) {
      return '95,000 - 110,000 EUR';
    }
    if (text.includes('£') || text.includes('gbp') || text.includes('uk ') || text.includes('london')) {
      return '85,000 - 100,000 GBP';
    }
    if (text.includes('$') || text.includes('usd') || text.includes('us ') || text.includes('united states') || text.includes('new york') || text.includes('san francisco')) {
      return '130,000 - 150,000 USD';
    }
    return fallbackSalary || '95,000 - 110,000 EUR';
  }

  async function fillForm(profile, jd) {
    const fields = detectFormFields();
    let filled = 0;

    const valueMap = {
      fullName: profile.personalInfo?.fullName || '',
      firstName: (profile.personalInfo?.fullName || '').split(' ')[0] || '',
      lastName: (profile.personalInfo?.fullName || '').split(' ').slice(1).join(' ') || '',
      email: profile.personalInfo?.email || '',
      phone: profile.personalInfo?.phone || '',
      location: profile.personalInfo?.location || '',
      linkedin: profile.personalInfo?.linkedin || '',
      github: profile.personalInfo?.github || '',
      website: profile.personalInfo?.website || '',
      currentTitle: profile.targetRole || '',
      currentCompany: profile.experience?.[0]?.company || '',
      yearsExperience: profile.personalInfo?.yearsExperience || '',
      salary: getSmartSalary(jd?.text, profile.personalInfo?.expectedSalary),
      startDate: profile.personalInfo?.availability || '',
    };

    for (const { element, fieldType, labelText } of fields) {
      let value = valueMap[fieldType];
      
      // Check custom fields if no standard match was found
      if (!value && profile.customFields && labelText) {
        for (const [customKey, customVal] of Object.entries(profile.customFields)) {
          // If the page's label contains the learned key (case insensitive)
          if (labelText.toLowerCase().includes(customKey.toLowerCase())) {
            value = customVal;
            break;
          }
        }
      }

      if (value) {
        if (fieldType === 'phone') {
          const match = value.match(/^\+?(\d{1,3})[\s-]+(.+)$/);
          if (match) {
            const countryCode = match[1];
            const localNumber = match[2];
            
            const container = element.closest('div, label, fieldset, li, section');
            if (container) {
              const select = container.querySelector('select');
              if (select) {
                for (const opt of select.options) {
                  if (opt.value.includes(countryCode) || opt.textContent.includes('+' + countryCode)) {
                    setNativeValue(select, opt.value);
                    break;
                  }
                }
              }
            }
            
            // Aggressively strip country code for ATS compatibility. 
            // Most modern ATS forms split this into a custom UI button or standardizing format.
            value = localNumber; 
          }
        }

        setNativeValue(element, value);
        filled++;
        // Highlight filled fields briefly
        element.style.transition = 'box-shadow 0.3s ease';
        element.style.boxShadow = '0 0 0 2px #6C63FF';
        setTimeout(() => {
          element.style.boxShadow = '';
        }, 2000);
      }
    }

    // Auto-Upload CV
    if (profile.resumeBase64 && profile.resumeFileName) {
      const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
      for (const input of fileInputs) {
        
        let isResume = false;
        const { labelText, attrs } = extractLabel(input);
        const searchText = attrs + ' ' + labelText.toLowerCase();
        
        if (/\b(resume|cv|curriculum vitae)\b/i.test(searchText)) {
          isResume = true;
        } else {
          // Fallback: Check up to 8 levels of parent innerText for 'resume' or 'cv'
          let current = input.parentElement;
          let depth = 0;
          while (current && current.tagName !== 'BODY' && depth < 8) {
            const text = (current.innerText || '').toLowerCase();
            if (/\b(resume|cv|curriculum vitae)\b/.test(text)) {
              isResume = true;
              break;
            }
            current = current.parentElement;
            depth++;
          }
        }
        
        // If it's the only file input on the page, we can safely assume it's the resume upload
        if (!isResume && fileInputs.length === 1) {
          isResume = true;
        }
        
        if (isResume) {
          try {
            const fetchRes = await fetch(profile.resumeBase64);
            const blob = await fetchRes.blob();
            const file = new File([blob], profile.resumeFileName, { type: 'application/pdf' });
            
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            input.files = dataTransfer.files;
            
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dataset.jobassistFilled = 'true';
            filled++;
          } catch (e) {
            console.error('[JobAssist] Failed to auto-attach resume', e);
          }
        }
      }
    }

    const openQuestions = detectOpenQuestions().map(q => ({
      id: q.id,
      question: q.question
    }));

    return { filled, total: fields.length, unansweredQuestions: openQuestions };
  }

  // Track right-clicks for the context menu
  let lastActiveElement = null;
  document.addEventListener('contextmenu', (e) => {
    lastActiveElement = e.target;
  }, true);

  function fillAnswer(questionId, answer) {
    const q = openQuestionsMap[questionId];
    if (q) {
      if (q.type === 'radio') {
        const targetRadio = q.element.find(r => {
          let text = r.value;
          if (r.id) {
            try {
              const l = document.querySelector(`label[for="${CSS.escape(r.id)}"]`);
              if (l) text = l.innerText;
            } catch(e) {}
          }
          if (!text || text === 'on') {
            const pl = r.closest('label');
            if (pl) text = pl.innerText;
          }
          return text.toLowerCase().includes(answer.toLowerCase()) || answer.toLowerCase().includes(text.toLowerCase());
        });
        
        if (targetRadio) {
          targetRadio.click();
          targetRadio.dataset.jobassistFilled = 'true';
          return true;
        }
      } else {
        setNativeValue(q.element, answer);
        q.element.style.transition = 'box-shadow 0.3s ease';
        q.element.style.boxShadow = '0 0 0 2px #6C63FF';
        setTimeout(() => { q.element.style.boxShadow = ''; }, 2000);
        return true;
      }
    }
    return false;
  }

  // ─────────────────────────────────────────────
  // Message Listener
  // ─────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXTRACT_JD') {
      sendResponse({ jd: extractJobDescription() });
      return true;
    }

    if (message.type === 'FILL_FORM') {
      fillForm(message.profile, message.jd).then(result => {
        sendResponse(result);
      }).catch(err => {
        console.error('[JobAssist] Form fill error:', err);
        sendResponse({ error: err.message });
      });
      return true;
    }

    if (message.type === 'FILL_CUSTOM_ANSWERS') {
      let filledCount = 0;
      for (const [id, answer] of Object.entries(message.answers)) {
        if (fillAnswer(id, answer)) {
          filledCount++;
        }
      }
      sendResponse({ success: true, filled: filledCount });
      return true;
    }

    if (message.type === 'SUBMIT_FORM') {
      try {
        // Try common submit button patterns
        const submitSelectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          'button.submit_app',
          '#submit_app',
          '.application-submit-button',
          '[data-qa="submit-button"]'
        ];
        
        let submitBtn = null;
        for (const selector of submitSelectors) {
          submitBtn = document.querySelector(selector);
          if (submitBtn) break;
        }

        // Fallback: search by text
        if (!submitBtn) {
          const buttons = Array.from(document.querySelectorAll('button, a.button'));
          submitBtn = buttons.find(b => {
            const text = b.textContent?.toLowerCase() || '';
            return text.includes('submit application') || text.includes('apply') || text.includes('submit');
          });
        }

        if (submitBtn) {
          submitBtn.click();
          sendResponse({ success: true, message: 'Form submitted' });
        } else {
          sendResponse({ success: false, error: 'Submit button not found' });
        }
      } catch (err: any) {
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }

    if (message.type === 'ATTACH_RESUME') {
      try {
        const fileInput = document.querySelector('input[type="file"]');
        if (!fileInput) {
          sendResponse({ success: false, error: 'No file input found' });
          return true;
        }

        // Convert base64 to Blob
        const byteCharacters = atob(message.base64Pdf.split(',')[1] || message.base64Pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });

        // Create File object
        const file = new File([blob], message.filename || 'Resume.pdf', {
          type: 'application/pdf',
          lastModified: new Date().getTime()
        });

        // Use DataTransfer to construct FileList
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        
        // Assign to input
        fileInput.files = dataTransfer.files;

        // Dispatch React/Angular synthetic events
        fileInput.dispatchEvent(new Event('input', { bubbles: true }));
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));

        sendResponse({ success: true });
      } catch (err) {
        console.error('[JobAssist] Attach file error:', err);
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }

    if (message.type === 'GET_QUESTIONS') {
      const questions = detectOpenQuestions().map(q => ({
        id: q.id,
        question: q.question,
      }));
      sendResponse({ questions });
      return true;
    }

    if (message.type === 'FILL_ANSWER') {
      const success = fillAnswer(message.questionId, message.answer);
      sendResponse({ success });
      return true;
    }

    if (message.type === 'PING') {
      sendResponse({ alive: true });
      return true;
    }

    if (message.type === 'INLINE_GENERATION_START') {
      if (lastActiveElement) {
        lastActiveElement.dataset.originalPlaceholder = lastActiveElement.getAttribute('placeholder') || '';
        lastActiveElement.setAttribute('placeholder', '✨ Generating answer...');
        lastActiveElement.style.opacity = '0.7';
      }
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'GET_ACTIVE_QUESTION') {
      let questionText = '';
      if (lastActiveElement) {
        let node = lastActiveElement;
        if (node.id) {
          const labelEl = document.querySelector(`label[for="${CSS.escape(node.id)}"]`);
          if (labelEl) questionText = labelEl.innerText.trim();
        }
        if (!questionText) {
          for (let i = 0; i < 4 && node; i++) {
            if (node.previousElementSibling) {
              const text = node.previousElementSibling.innerText?.trim();
              if (text && text.length > 5) {
                questionText = text;
                break;
              }
            }
            node = node.parentElement;
          }
        }
        if (!questionText) questionText = lastActiveElement.getAttribute('aria-label') || '';
        if (!questionText) questionText = lastActiveElement.getAttribute('placeholder') || '';
        questionText = questionText.replace(/\*/g, '').trim();
      }
      sendResponse({ questionText });
      return true;
    }

    if (message.type === 'INLINE_GENERATION_SUCCESS') {
      if (lastActiveElement) {
        setNativeValue(lastActiveElement, message.answer);
        lastActiveElement.setAttribute('placeholder', lastActiveElement.dataset.originalPlaceholder || '');
        lastActiveElement.style.opacity = '1';
        lastActiveElement.style.transition = 'box-shadow 0.3s ease';
        lastActiveElement.style.boxShadow = '0 0 0 2px #6C63FF';
        setTimeout(() => { lastActiveElement.style.boxShadow = ''; }, 2000);
      }
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'INLINE_GENERATION_ERROR') {
      if (lastActiveElement) {
        lastActiveElement.setAttribute('placeholder', lastActiveElement.dataset.originalPlaceholder || '');
        lastActiveElement.style.opacity = '1';
        alert(`JobAssist Error: ${message.error}`);
      }
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'SHOW_COPILOT_TRANSCRIPT' || message.type === 'SHOW_COPILOT_HINT' || message.type === 'STREAM_COPILOT_HINT') {
      let container = document.getElementById('jobassist-copilot-overlay');
      let shadowRoot = null;
      if (!container) {
        container = document.createElement('div');
        container.id = 'jobassist-copilot-overlay';
        container.style.position = 'fixed';
        container.style.bottom = '20px';
        container.style.right = '20px';
        container.style.zIndex = '2147483647';
        container.style.width = '380px';
        container.style.maxHeight = '450px';
        container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        container.style.pointerEvents = 'none'; // Don't block background clicks, but allow interaction on wrapper
        
        shadowRoot = container.attachShadow({ mode: 'open' });
        
        const style = document.createElement('style');
        style.textContent = `
          .wrapper {
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 16px;
            padding: 20px;
            color: white;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
            transition: all 0.3s ease;
            pointer-events: auto; /* Re-enable pointer events for the box itself */
          }
          .header {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 14px;
            font-weight: 700;
            color: #818cf8;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .pulse {
            width: 10px;
            height: 10px;
            background: #ef4444;
            border-radius: 50%;
            animation: pulse 2s infinite;
          }
          @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
          }
          .transcript {
            font-size: 14px;
            color: #94a3b8;
            line-height: 1.5;
            font-style: italic;
            margin-bottom: 16px;
            max-height: 120px;
            overflow-y: auto;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            padding-bottom: 12px;
          }
          .transcript::-webkit-scrollbar { width: 4px; }
          .transcript::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
          .hint {
            font-size: 15px;
            color: #f8fafc;
            background: rgba(99, 102, 241, 0.15);
            border-left: 3px solid #6366f1;
            padding: 12px 14px;
            border-radius: 0 6px 6px 0;
            line-height: 1.5;
          }
          ul { margin: 0; padding-left: 18px; }
          li { margin-bottom: 6px; }
          li:last-child { margin-bottom: 0; }
        `;
        shadowRoot.appendChild(style);
        
        const wrapper = document.createElement('div');
        wrapper.className = 'wrapper';
        wrapper.innerHTML = `
          <div class="header">
            <div class="pulse"></div>
            Copilot Active
          </div>
          <div class="transcript" id="transcript-box">Listening...</div>
          <div class="hint" id="hint-box" style="display:none;"></div>
        `;
        shadowRoot.appendChild(wrapper);
        document.body.appendChild(container);
      } else {
        shadowRoot = container.shadowRoot;
      }
      
      if (message.type === 'SHOW_COPILOT_TRANSCRIPT') {
        const tBox = shadowRoot.getElementById('transcript-box');
        if (tBox) {
          tBox.textContent = '"' + message.text.trim() + '..."';
          tBox.scrollTop = tBox.scrollHeight;
        }
      }
      
      if (message.type === 'SHOW_COPILOT_HINT' || message.type === 'STREAM_COPILOT_HINT') {
        const hBox = shadowRoot.getElementById('hint-box');
        if (hBox) {
          hBox.style.display = 'block';
          // Convert bullet points to HTML list
          const html = message.hint.split('\n').map(line => {
             const trimmed = line.trim();
             if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
               return `<li>${trimmed.substring(1).trim()}</li>`;
             }
             return trimmed ? `<p style="margin:0 0 6px 0">${trimmed}</p>` : '';
          }).join('');
          
          hBox.innerHTML = html.includes('<li>') ? `<ul style="margin:0;padding-left:18px;">${html}</ul>` : html;
        }
      }
      
      sendResponse({ success: true });
      return true;
    }
  });

  // ─────────────────────────────────────────────
  // V3: LinkedIn Outreach Generator
  // ─────────────────────────────────────────────
  function injectLinkedInOutreachButton() {
    if (!window.location.hostname.includes('linkedin.com') || !window.location.pathname.includes('/in/')) {
      const existing = document.getElementById('jobassist-linkedin-outreach');
      if (existing) existing.remove();
      return;
    }

    if (document.getElementById('jobassist-linkedin-outreach')) return;

    const btn = document.createElement('button');
    btn.id = 'jobassist-linkedin-outreach';
    btn.innerHTML = '✨ Draft Referral DM';
    btn.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 2147483647;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: white;
      border: none;
      border-radius: 9999px;
      padding: 12px 24px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.4);
      transition: transform 0.2s;
    `;

    btn.addEventListener('mouseenter', () => btn.style.transform = 'translateY(-2px)');
    btn.addEventListener('mouseleave', () => btn.style.transform = 'translateY(0)');
    
    btn.addEventListener('click', async () => {
      btn.innerHTML = '⏳ Drafting...';
      try {
        const profileName = document.querySelector('h1')?.innerText?.trim() || 'this person';
        const headline = document.querySelector('.text-body-medium')?.innerText?.trim() || '';
        
        chrome.runtime.sendMessage({
          type: 'GENERATE_LINKEDIN_OUTREACH',
          targetName: profileName,
          targetHeadline: headline
        }, (response) => {
          if (response && response.draft) {
            // Create a small overlay to show the draft
            showDraftOverlay(response.draft);
            btn.innerHTML = '✨ Draft Referral DM';
          } else {
            alert('Error generating draft: ' + (response?.error || 'Unknown'));
            btn.innerHTML = '✨ Draft Referral DM';
          }
        });
      } catch (e) {
        alert('Error: ' + e.message);
        btn.innerHTML = '✨ Draft Referral DM';
      }
    });

    document.body.appendChild(btn);
  }

  function showDraftOverlay(draftText) {
    let container = document.getElementById('jobassist-draft-overlay');
    if (container) container.remove();

    container = document.createElement('div');
    container.id = 'jobassist-draft-overlay';
    container.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 24px;
      z-index: 2147483647;
      background: white;
      border-radius: 12px;
      padding: 20px;
      width: 350px;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);
      border: 1px solid #e2e8f0;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="margin:0; font-size:16px; color:#1e293b; font-weight:700;">📝 Outreach Draft</h3>
        <button id="close-draft-btn" style="background:none;border:none;cursor:pointer;font-size:18px;color:#94a3b8;">&times;</button>
      </div>
      <textarea id="draft-textarea" style="width:100%; height:150px; padding:12px; border-radius:8px; border:1px solid #cbd5e1; font-family:inherit; font-size:14px; color:#334155; resize:none; box-sizing:border-box;">${draftText}</textarea>
      <button id="copy-draft-btn" style="margin-top:12px; width:100%; background:#0f172a; color:white; border:none; padding:10px; border-radius:8px; font-weight:600; cursor:pointer;">Copy to Clipboard</button>
    `;

    document.body.appendChild(container);

    document.getElementById('close-draft-btn').addEventListener('click', () => container.remove());
    document.getElementById('copy-draft-btn').addEventListener('click', () => {
      const ta = document.getElementById('draft-textarea');
      ta.select();
      document.execCommand('copy');
      const btn = document.getElementById('copy-draft-btn');
      btn.innerText = '✅ Copied!';
      setTimeout(() => btn.innerText = 'Copy to Clipboard', 2000);
    });
  }

  // Monitor URL changes for SPAs like LinkedIn
  setInterval(injectLinkedInOutreachButton, 2000);

  console.log('[JobAssist Pro] Content script ready');
})();
