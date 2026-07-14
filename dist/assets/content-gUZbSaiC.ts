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

  function detectOpenQuestions() {
    const textareas = Array.from(document.querySelectorAll('textarea, div[contenteditable="true"]')).filter(
      el => el.offsetParent !== null && !el.disabled
    );

    const questions = [];
    for (const ta of textareas) {
      let questionText = '';
      
      // 1. Try to find an explicit <label> via the `id` attribute
      if (ta.id) {
        const labelEl = document.querySelector(`label[for="${CSS.escape(ta.id)}"]`);
        if (labelEl) questionText = labelEl.innerText.trim();
      }

      // 2. Try looking at previous siblings up the DOM tree (handles obfuscated classes like Ashby)
      if (!questionText) {
        let node = ta;
        for (let i = 0; i < 4 && node; i++) {
          if (node.previousElementSibling) {
            const prev = node.previousElementSibling;
            // Check if it's a typical label/heading element, or a generic div with text
            const text = prev.innerText?.trim();
            if (text && text.length > 5) {
              questionText = text;
              break;
            }
          }
          node = node.parentElement;
        }
      }

      // 3. Fallbacks
      if (!questionText) questionText = ta.getAttribute('aria-label') || '';
      if (!questionText) questionText = ta.getAttribute('placeholder') || '';

      // Clean up common asterisks
      questionText = questionText.replace(/\*/g, '').trim();

      // Only accept if it looks like a real question (ignores generic placeholders like "Type here")
      if (questionText && questionText.length > 8 && !questionText.match(/^(type here|enter text|optional)/i)) {
        questions.push({
          id: ta.id || ta.name || `textarea_${questions.length}`,
          question: questionText.substring(0, 300),
          element: ta,
        });
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

    return { filled, total: fields.length };
  }

  // Track right-clicks for the context menu
  let lastActiveElement = null;
  document.addEventListener('contextmenu', (e) => {
    lastActiveElement = e.target;
  }, true);

  function fillAnswer(questionId, answer) {
    const questions = detectOpenQuestions();
    const q = questions.find(q => q.id === questionId);
    if (q) {
      setNativeValue(q.element, answer);
      q.element.style.transition = 'box-shadow 0.3s ease';
      q.element.style.boxShadow = '0 0 0 2px #6C63FF';
      setTimeout(() => { q.element.style.boxShadow = ''; }, 2000);
      return true;
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
  });

  console.log('[JobAssist Pro] Content script ready');
})();
