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
    const linkedinJobTitle = document.querySelector('.job-details-jobs-unified-top-card__job-title, h1.t-24');
    const linkedinCompany = document.querySelector('.job-details-jobs-unified-top-card__company-name, .topcard__org-name-link');
    const linkedinDesc = document.querySelector('.jobs-description__content, .job-view-layout');

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

  function classifyField(el) {
    const attrs = [
      el.getAttribute('name') || '',
      el.getAttribute('id') || '',
      el.getAttribute('placeholder') || '',
      el.getAttribute('aria-label') || '',
      el.getAttribute('autocomplete') || '',
    ].join(' ').toLowerCase();

    // Find nearby label text
    let labelText = '';
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label) labelText = label.innerText;
    }
    // Check parent for label
    const parent = el.closest('div, li, section, fieldset');
    if (parent) {
      const label = parent.querySelector('label');
      if (label) labelText = label.innerText;
    }
    const searchText = attrs + ' ' + labelText.toLowerCase();

    for (const [fieldType, pattern] of Object.entries(FIELD_PATTERNS)) {
      if (pattern.test(searchText)) return fieldType;
    }
    return null;
  }

  function detectFormFields() {
    const inputs = Array.from(document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, select'
    )).filter(el => el.offsetParent !== null); // only visible

    const fields = [];
    for (const el of inputs) {
      const fieldType = classifyField(el);
      if (fieldType) {
        fields.push({ element: el, fieldType });
      }
    }
    return fields;
  }

  function detectOpenQuestions() {
    const textareas = Array.from(document.querySelectorAll('textarea')).filter(
      el => el.offsetParent !== null
    );

    const questions = [];
    for (const ta of textareas) {
      // Find the question text near this textarea
      let questionText = ta.getAttribute('placeholder') || ta.getAttribute('aria-label') || '';
      if (!questionText) {
        const parent = ta.closest('div, li, section');
        if (parent) {
          const label = parent.querySelector('label, p, h3, h4, strong, legend');
          if (label) questionText = label.innerText.trim();
        }
      }
      if (questionText && questionText.length > 10) {
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
  // Form Filling
  // ─────────────────────────────────────────────
  function setNativeValue(el, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, value);
    } else {
      el.value = value;
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function fillForm(profile) {
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
      salary: profile.personalInfo?.expectedSalary || '',
      startDate: profile.personalInfo?.availability || '',
    };

    for (const { element, fieldType } of fields) {
      const value = valueMap[fieldType];
      if (value) {
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

    return { filled, total: fields.length };
  }

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
      const result = fillForm(message.profile);
      sendResponse(result);
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
  });

  console.log('[JobAssist Pro] Content script ready');
})();
