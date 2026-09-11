// @ts-nocheck

// content/content.ts — Injected into every page

(function () {
  if (window.__jobAssistInjected) return;
  window.__jobAssistInjected = true;

  // ─────────────────────────────────────────────
  // JD Extraction — Multi-strategy with LinkedIn support
  // ─────────────────────────────────────────────
  function extractJobDescription() {
    const url = window.location.href;
    const isLinkedIn = window.location.hostname.includes('linkedin.com');

    // ── Strategy 1: JSON-LD structured data (most stable across LinkedIn updates)
    let jobTitle = '', company = '', descriptionText = '';
    try {
      const ldScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const s of ldScripts) {
        try {
          const data = JSON.parse(s.textContent || '');
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item['@type'] === 'JobPosting') {
              jobTitle = jobTitle || item.title || '';
              company = company || item.hiringOrganization?.name || '';
              descriptionText = descriptionText || (item.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            }
          }
        } catch(e) {}
      }
    } catch(e) {}

    // ── Strategy 2: LinkedIn-specific ARIA + data attributes (stable)
    if (isLinkedIn) {
      // Job title: use the h1 inside the job detail top card
      if (!jobTitle) {
        const h1 = document.querySelector(
          '.job-details-jobs-unified-top-card__job-title h1, ' +
          'h1[class*="job-title"], ' +
          'h1[class*="topCard"], ' +
          '.t-24.t-bold.inline'
        );
        if (h1) jobTitle = h1.innerText.trim();
      }

      // Company: find the company link in the top card
      if (!company) {
        const companyEl = document.querySelector(
          '.job-details-jobs-unified-top-card__company-name a, ' +
          '[class*="job-details"][class*="company"] a, ' +
          '.topcard__org-name-link, ' +
          'a[class*="company-name"]'
        );
        if (companyEl) company = companyEl.innerText.trim();
      }

      // Description: #job-details is the most stable LinkedIn selector
      if (!descriptionText) {
        const descEl = document.querySelector(
          '#job-details, ' +
          '[class*="jobs-description__content"], ' +
          '[class*="description__text"], ' +
          '.show-more-less-html__markup, ' +
          '[class*="job-view-layout"] .jobs-description'
        );
        if (descEl) descriptionText = descEl.innerText.trim();
      }

      // Easy Apply modal: if user has it open, also grab content from modal
      const modal = document.querySelector(
        '.artdeco-modal[aria-labelledby*="jobs-easy-apply"], ' +
        '[class*="jobs-easy-apply-modal"], ' +
        'div[role="dialog"][aria-label*="Apply"]'
      );
      if (modal && !descriptionText) {
        descriptionText = modal.innerText.trim().substring(0, 5000);
      }
    }

    // ── Strategy 3: ATS platforms
    if (!jobTitle) jobTitle = (document.querySelector('#header h1, .app-title, .posting-header h2') || {}).innerText || '';
    if (!descriptionText) {
      const atsDesc = document.querySelector(
        '#content, .job-post, .posting-description, ' +
        '[data-automation-id="jobPostingDescription"], ' +
        '[class*="job-description"], [class*="jobDescription"], ' +
        '[itemprop="description"]'
      );
      if (atsDesc) descriptionText = atsDesc.innerText.trim();
    }

    // ── Strategy 4: Meta tags fallback
    if (!jobTitle) {
      jobTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                 document.querySelector('meta[name="title"]')?.getAttribute('content') ||
                 document.title || '';
    }
    if (!company) {
      company = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || '';
    }

    // ── Strategy 5: Full page text as last resort
    if (!descriptionText) {
      descriptionText = document.body.innerText.substring(0, 8000);
    }

    descriptionText = descriptionText
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
      .substring(0, 10000);

    return {
      url,
      title: jobTitle.replace(/\*/g, '').trim(),
      company: company.replace(/\*/g, '').trim(),
      text: descriptionText,
      capturedAt: new Date().toISOString(),
    };
  }

  // ─────────────────────────────────────────────
  // Label Detection — 6-tier heuristic
  // ─────────────────────────────────────────────
  function getLabel(el) {
    if (!el) return '';

    // 1. Explicit label[for="id"]
    if (el.id) {
      try {
        const lbl = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (lbl) return lbl.innerText.replace(/\*/g, '').trim();
      } catch(e) {}
    }

    // 2. aria-labelledby
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const text = labelledBy.split(' ').map(function(id) { return (document.getElementById(id) || {}).innerText || ''; }).join(' ').trim();
      if (text) return text.replace(/\*/g, '').trim();
    }

    // 3. aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.replace(/\*/g, '').trim();

    // 4. Ancestor <label> wrapper
    const parentLabel = el.closest('label');
    if (parentLabel) {
      const text = parentLabel.innerText.replace(/\*/g, '').trim();
      if (text) return text;
    }

    // 5. Walk DOM upward
    let node = el.parentElement;
    for (let i = 0; i < 6 && node && node.tagName !== 'BODY'; i++) {
      const lbl = node.querySelector(':scope > label, :scope > .label, :scope > .field-label, :scope > legend, :scope > .question-label, :scope > .form-label');
      if (lbl && lbl.innerText.trim()) return lbl.innerText.replace(/\*/g, '').trim();
      const prev = node.previousElementSibling;
      if (prev) {
        const prevText = (prev.innerText || '').trim();
        if (prevText && prevText.length > 2 && prevText.length < 100) return prevText.replace(/\*/g, '').trim();
      }
      node = node.parentElement;
    }

    // 6. Attribute fallback
    return ((el.getAttribute('placeholder') || el.getAttribute('name') || el.getAttribute('id') || '').replace(/[_-]/g, ' ').trim());
  }

  // ─────────────────────────────────────────────
  // setNativeValue — with _valueTracker reset
  // ─────────────────────────────────────────────
  function setNativeValue(el, value) {
    if (!el || value === undefined || value === null) return;
    if (el.focus) el.focus();
    el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));

    if (el.isContentEditable) {
      el.innerHTML = '';
      document.execCommand('insertText', false, String(value));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dataset.jobassistFilled = 'true';
      return;
    }

    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value') && Object.getOwnPropertyDescriptor(proto, 'value').set;

    // Critical for React 16+: reset internal value tracker to force state update
    if (el._valueTracker) el._valueTracker.setValue('');

    if (nativeSetter) nativeSetter.call(el, String(value));
    else el.value = String(value);

    el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: String(value) }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dataset.jobassistFilled = 'true';
  }

  // ─────────────────────────────────────────────
  // fillNativeSelect — fuzzy match + _valueTracker reset
  // ─────────────────────────────────────────────
  function fillNativeSelect(sel, answerText) {
    if (!answerText) return false;
    const lower = answerText.toLowerCase().trim();
    let bestOpt = null;
    let bestScore = 0;

    for (let i = 0; i < sel.options.length; i++) {
      const opt = sel.options[i];
      if (opt.disabled && opt.value === '') continue;
      const optText = (opt.text || '').toLowerCase().trim();
      if (!optText) continue;
      let score = 0;
      if (optText === lower) { score = 100; }
      else if (optText.includes(lower) || lower.includes(optText)) {
        score = (Math.min(optText.length, lower.length) / Math.max(optText.length, lower.length)) * 90;
      }
      if (score > bestScore) { bestScore = score; bestOpt = opt; }
    }

    if (bestOpt && bestScore > 25) {
      if (sel._valueTracker) sel._valueTracker.setValue('');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value') && Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      if (setter) setter.call(sel, bestOpt.value);
      else sel.value = bestOpt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dataset.jobassistFilled = 'true';
      return true;
    }
    return false;
  }

  // ─────────────────────────────────────────────
  // fillCustomCombobox — MutationObserver-based
  // ─────────────────────────────────────────────
  function fillCustomCombobox(container, inputEl, answerText) {
    return new Promise(function(resolve) {
      if (!answerText) { resolve(false); return; }

      var settled = false;
      var observer;

      function cleanup(success) {
        if (settled) return;
        settled = true;
        if (observer) observer.disconnect();
        resolve(success);
      }

      function findAndClickOption() {
        var selectors = '[role="option"],[role="listbox"] li,.react-select__option,[class*="__option"],.choices__item--choice,.select2-results__option,.dropdown-item,li[id*="option"],[data-value]';
        var options = Array.from(document.querySelectorAll(selectors)).filter(function(el) { return el.offsetParent !== null; });
        if (options.length === 0) return false;

        var lower = answerText.toLowerCase().trim();
        var best = null;
        var bestScore = 0;

        for (var i = 0; i < options.length; i++) {
          var opt = options[i];
          var text = ((opt.textContent || opt.getAttribute('data-value') || '').trim().toLowerCase());
          if (!text) continue;
          var score = 0;
          if (text === lower) { score = 100; }
          else if (text.includes(lower) || lower.includes(text)) {
            score = (Math.min(text.length, lower.length) / Math.max(text.length, lower.length)) * 90;
          }
          if (score > bestScore) { bestScore = score; best = opt; }
        }

        if (best && bestScore > 25) {
          best.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));
          best.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, view: window }));
          best.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, view: window }));
          best.click();
          if (container) container.dataset.jobassistFilled = 'true';
          cleanup(true);
          return true;
        }
        return false;
      }

      observer = new MutationObserver(function() {
        if (!settled) findAndClickOption();
      });
      observer.observe(document.body, { childList: true, subtree: true });

      // Open the dropdown
      var trigger = (container && (container.querySelector('[class*="-control"],[class*="__control"],.Select-control,.choices__inner,[aria-haspopup="listbox"]') || container)) || inputEl;
      trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, view: window }));
      trigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, view: window }));
      trigger.click();

      // Type into search input
      if (inputEl && inputEl !== trigger) {
        setTimeout(function() { if (!settled) setNativeValue(inputEl, answerText); }, 80);
      }

      // Try immediate match (for already-open dropdowns)
      setTimeout(function() { if (!settled) findAndClickOption(); }, 200);

      // Safety timeout
      setTimeout(function() { cleanup(false); }, 2500);
    });
  }

  // ─────────────────────────────────────────────
  // scanAllFields — returns serializable field list
  // stores DOM refs in _fieldRegistry
  // ─────────────────────────────────────────────
  var _fieldRegistry = [];

  function scanAllFields() {
    _fieldRegistry = [];
    var seen = new Set();
    var idx = 0;

    function addField(desc) {
      if (!desc.label || desc.label.length < 2) return;
      var key = (desc.type + ':' + desc.label.toLowerCase().substring(0, 40));
      if (seen.has(key)) return;
      seen.add(key);
      var id = 'field_' + (idx++);
      _fieldRegistry.push(Object.assign({ id: id }, desc));
    }

    // 1. Text/email/tel/url/number inputs
    document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"])').forEach(function(el) {
      if (!el.offsetParent || el.disabled || el.dataset.jobassistFilled === 'true') return;
      // Skip internal inputs of custom comboboxes
      if (el.getAttribute('role') !== 'combobox' && el.closest('.react-select,.choices,.select2,[class*="react-select"],[class*="-select__"],[class*="__select"]')) return;
      var label = getLabel(el);
      if (!label) return;
      var type = (el.type === 'date' || el.type === 'month') ? 'date' : 'text';
      addField({ type: type, label: label, element: el, elType: el.type });
    });

    // 2. Textareas
    document.querySelectorAll('textarea').forEach(function(el) {
      if (!el.offsetParent || el.disabled || el.dataset.jobassistFilled === 'true') return;
      var label = getLabel(el);
      if (!label) return;
      addField({ type: 'textarea', label: label, element: el });
    });

    // 3. Contenteditable
    document.querySelectorAll('[contenteditable="true"]').forEach(function(el) {
      if (!el.offsetParent || el.tagName === 'BODY') return;
      var label = getLabel(el);
      if (!label) return;
      addField({ type: 'richtext', label: label, element: el });
    });

    // 4. Native selects
    document.querySelectorAll('select').forEach(function(el) {
      if (!el.offsetParent || el.disabled || el.dataset.jobassistFilled === 'true') return;
      var label = getLabel(el);
      var options = Array.from(el.options).map(function(o) { return o.text.trim(); }).filter(function(t) {
        return t && !['please choose','select','choose one','select one','-','--','none',''].includes(t.toLowerCase());
      });
      if (!label || options.length === 0) return;
      addField({ type: 'select', label: label, options: options, element: el });
    });

    // 5. Radio groups
    var radioGroups = {};
    document.querySelectorAll('input[type="radio"]').forEach(function(el) {
      if (!el.offsetParent || el.disabled) return;
      var name = el.name || el.id || ('rg_' + idx);
      if (!radioGroups[name]) radioGroups[name] = [];
      radioGroups[name].push(el);
    });

    Object.keys(radioGroups).forEach(function(name) {
      var group = radioGroups[name];
      var label = '';
      var container = group[0].closest('fieldset,[role="radiogroup"],.form-group,.field,.question,[class*="question-"],[class*="-question"]');
      if (container) {
        var legend = container.querySelector('legend,.legend,.question-label,h3,h4,[class*="label"]');
        if (legend) label = legend.innerText.replace(/\*/g, '').trim();
      }
      if (!label) label = getLabel(group[0]);
      if (!label) return;

      var options = group.map(function(r) {
        var text = '';
        if (r.id) {
          try {
            var lbl = document.querySelector('label[for="' + CSS.escape(r.id) + '"]');
            if (lbl) text = lbl.innerText.trim();
          } catch(e) {}
        }
        if (!text) text = (r.closest('label') || {}).innerText || r.value || '';
        return text.replace(/\*/g, '').trim();
      }).filter(Boolean);

      if (options.length === 0) return;
      addField({ type: 'radio', label: label, options: options, element: group, groupName: name });
    });

    // 6. Checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach(function(el) {
      if (!el.offsetParent || el.disabled) return;
      var label = getLabel(el);
      if (!label || label.length > 150) return;
      addField({ type: 'checkbox', label: label, element: el });
    });

    // 7. Custom comboboxes
    var comboSelectors = '[role="combobox"],.react-select__control,[class*="react-select__control"],.choices__inner,.select2-selection,.Select-control';
    document.querySelectorAll(comboSelectors).forEach(function(container) {
      if (!container.offsetParent || container.tagName === 'SELECT') return;
      var inputEl = container.querySelector('input[type="text"],input[role="combobox"],input') || null;
      if (inputEl && inputEl.dataset.jobassistFilled === 'true') return;
      var label = getLabel(container) || (inputEl ? getLabel(inputEl) : '');
      if (!label) return;
      var key = 'select:' + label.toLowerCase().substring(0, 40);
      if (!seen.has(key)) {
        addField({ type: 'combobox', label: label, element: container, inputEl: inputEl });
      }
    });

    // Return serializable version
    return _fieldRegistry.map(function(f) {
      return { id: f.id, type: f.type, label: f.label, options: f.options || [], elType: f.elType || null, groupName: f.groupName || null };
    });
  }

  // ─────────────────────────────────────────────
  // applyAnswers — routes each answer to correct fill fn
  // ─────────────────────────────────────────────
  async function applyAnswers(answers) {
    var filled = 0;

    for (var i = 0; i < _fieldRegistry.length; i++) {
      var field = _fieldRegistry[i];
      var answer = answers[field.id];
      if (!answer || answer === '' || /^(skip|n\/a|na|none)$/i.test(answer.trim())) continue;

      var el = field.element;
      if (!el) continue;

      try {
        var success = false;

        if (field.type === 'select') {
          success = fillNativeSelect(el, answer);
        } else if (field.type === 'radio') {
          var group = Array.isArray(el) ? el : [el];
          var lower = answer.toLowerCase().trim();
          var target = null;
          for (var j = 0; j < group.length; j++) {
            var r = group[j];
            var text = '';
            if (r.id) {
              try {
                var lbl2 = document.querySelector('label[for="' + CSS.escape(r.id) + '"]');
                if (lbl2) text = lbl2.innerText.trim();
              } catch(e) {}
            }
            if (!text) text = (r.closest('label') || {}).innerText || r.value || '';
            text = text.toLowerCase();
            if (text === lower || text.includes(lower) || lower.includes(text)) { target = r; break; }
          }
          if (target) { target.click(); target.dataset.jobassistFilled = 'true'; success = true; }
        } else if (field.type === 'checkbox') {
          var shouldCheck = /yes|true|i agree|accept|consent|authorize/i.test(answer);
          if (el.checked !== shouldCheck) el.click();
          success = true;
        } else if (field.type === 'combobox') {
          var inputEl2 = field.inputEl || (el.querySelector ? el.querySelector('input') : null) || el;
          success = await fillCustomCombobox(el, inputEl2, answer);
        } else if (field.type === 'richtext') {
          el.focus();
          el.innerHTML = '';
          document.execCommand('insertText', false, answer);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dataset.jobassistFilled = 'true';
          success = true;
        } else {
          setNativeValue(el, answer);
          success = true;
        }

        if (success) {
          filled++;
          var highlightTarget = Array.isArray(el) ? el[0] : el;
          if (highlightTarget && highlightTarget.style) {
            highlightTarget.style.transition = 'box-shadow 0.4s ease';
            highlightTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.45)';
            (function(t) { setTimeout(function() { if (t && t.style) t.style.boxShadow = ''; }, 2500); })(highlightTarget);
          }
        }
      } catch(e) {
        console.warn('[JobAssist] Could not fill field:', field.label, e.message);
      }
    }

    return filled;
  }

  // ─────────────────────────────────────────────
  // Track right-clicks for inline generation
  // ─────────────────────────────────────────────
  var lastActiveElement = null;
  document.addEventListener('contextmenu', function(e) { lastActiveElement = e.target; }, true);

  // ─────────────────────────────────────────────
  // Message Listener
  // ─────────────────────────────────────────────
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.type === 'EXTRACT_JD') {
      sendResponse({ jd: extractJobDescription() });
      return true;
    }

    if (message.type === 'SCAN_FIELDS') {
      try { sendResponse({ fields: scanAllFields() }); } catch(e) { sendResponse({ error: e.message }); }
      return true;
    }

    if (message.type === 'APPLY_ANSWERS') {
      applyAnswers(message.answers).then(function(filled) {
        sendResponse({ success: true, filled: filled });
      }).catch(function(err) {
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }

    // Legacy FILL_FORM — now scans and returns fields for popup to AI-process
    if (message.type === 'FILL_FORM') {
      (async function() {
        // Auto-attach resume
        var resumeAttached = false;
        var profile = message.profile || {};
        if (profile.resumeBase64 && profile.resumeFileName) {
          var fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
          for (var fi = 0; fi < fileInputs.length; fi++) {
            try {
              var fetchRes = await fetch(profile.resumeBase64);
              var blob = await fetchRes.blob();
              var file = new File([blob], profile.resumeFileName, { type: 'application/pdf' });
              var dataTransfer = new DataTransfer();
              dataTransfer.items.add(file);
              fileInputs[fi].files = dataTransfer.files;
              fileInputs[fi].dispatchEvent(new Event('change', { bubbles: true }));
              fileInputs[fi].dataset.jobassistFilled = 'true';
              resumeAttached = true;
              break;
            } catch(e) { console.warn('[JobAssist] Resume attach failed:', e.message); }
          }
        }
        var fields = scanAllFields();
        sendResponse({ fields: fields, resumeAttached: resumeAttached });
      })();
      return true;
    }

    if (message.type === 'SUBMIT_FORM') {
      try {
        var submitSelectors = ['button[type="submit"]','input[type="submit"]','button.submit_app','#submit_app','.application-submit-button','[data-qa="submit-button"]'];
        var submitBtn = null;
        for (var si = 0; si < submitSelectors.length; si++) {
          submitBtn = document.querySelector(submitSelectors[si]);
          if (submitBtn) break;
        }
        if (!submitBtn) {
          var buttons = Array.from(document.querySelectorAll('button, a.button'));
          submitBtn = buttons.find(function(b) {
            var t = (b.textContent || '').toLowerCase();
            return t.includes('submit application') || t.includes('apply') || t.includes('submit');
          });
        }
        if (submitBtn) { submitBtn.click(); sendResponse({ success: true, message: 'Form submitted' }); }
        else { sendResponse({ success: false, error: 'Submit button not found' }); }
      } catch(err) { sendResponse({ success: false, error: err.message }); }
      return true;
    }

    if (message.type === 'ATTACH_RESUME') {
      (async function() {
        try {
          var fileInput = document.querySelector('input[type="file"]');
          if (!fileInput) { sendResponse({ success: false, error: 'No file input found' }); return; }
          var byteCharacters = atob(message.base64Pdf.split(',')[1] || message.base64Pdf);
          var byteArray = new Uint8Array(byteCharacters.length);
          for (var i = 0; i < byteCharacters.length; i++) byteArray[i] = byteCharacters.charCodeAt(i);
          var blob = new Blob([byteArray], { type: 'application/pdf' });
          var file = new File([blob], message.filename || 'Resume.pdf', { type: 'application/pdf', lastModified: Date.now() });
          var dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          fileInput.files = dataTransfer.files;
          fileInput.dispatchEvent(new Event('input', { bubbles: true }));
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
          sendResponse({ success: true });
        } catch(err) { sendResponse({ success: false, error: err.message }); }
      })();
      return true;
    }

    if (message.type === 'PING') { sendResponse({ alive: true }); return true; }

    if (message.type === 'INLINE_GENERATION_START') {
      if (lastActiveElement) {
        lastActiveElement.dataset.originalPlaceholder = lastActiveElement.getAttribute('placeholder') || '';
        lastActiveElement.setAttribute('placeholder', '✨ Generating answer...');
        lastActiveElement.style.opacity = '0.7';
      }
      sendResponse({ success: true }); return true;
    }

    if (message.type === 'GET_ACTIVE_QUESTION') {
      var questionText = '';
      if (lastActiveElement) {
        var node = lastActiveElement;
        if (node.id) {
          try {
            var labelEl = document.querySelector('label[for="' + CSS.escape(node.id) + '"]');
            if (labelEl) questionText = labelEl.innerText.trim();
          } catch(e) {}
        }
        if (!questionText) {
          for (var qi = 0; qi < 4 && node; qi++) {
            if (node.previousElementSibling) {
              var t2 = (node.previousElementSibling.innerText || '').trim();
              if (t2 && t2.length > 5) { questionText = t2; break; }
            }
            node = node.parentElement;
          }
        }
        if (!questionText) questionText = lastActiveElement.getAttribute('aria-label') || '';
        if (!questionText) questionText = lastActiveElement.getAttribute('placeholder') || '';
        questionText = questionText.replace(/\*/g, '').trim();
      }
      sendResponse({ questionText: questionText }); return true;
    }

    if (message.type === 'INLINE_GENERATION_SUCCESS') {
      if (lastActiveElement) {
        setNativeValue(lastActiveElement, message.answer);
        lastActiveElement.setAttribute('placeholder', lastActiveElement.dataset.originalPlaceholder || '');
        lastActiveElement.style.opacity = '1';
        lastActiveElement.style.transition = 'box-shadow 0.3s ease';
        lastActiveElement.style.boxShadow = '0 0 0 2px #6C63FF';
        setTimeout(function() { lastActiveElement.style.boxShadow = ''; }, 2000);
      }
      sendResponse({ success: true }); return true;
    }

    if (message.type === 'INLINE_GENERATION_ERROR') {
      if (lastActiveElement) {
        lastActiveElement.setAttribute('placeholder', lastActiveElement.dataset.originalPlaceholder || '');
        lastActiveElement.style.opacity = '1';
        alert('JobAssist Error: ' + message.error);
      }
      sendResponse({ success: true }); return true;
    }

    if (message.type === 'SHOW_COPILOT_TRANSCRIPT' || message.type === 'SHOW_COPILOT_HINT' || message.type === 'STREAM_COPILOT_HINT') {
      var container = document.getElementById('jobassist-copilot-overlay');
      var shadowRoot = null;
      if (!container) {
        container = document.createElement('div');
        container.id = 'jobassist-copilot-overlay';
        container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;width:380px;max-height:450px;font-family:system-ui,-apple-system,sans-serif;pointer-events:none;';
        shadowRoot = container.attachShadow({ mode: 'open' });
        var style = document.createElement('style');
        style.textContent = '.wrapper{background:rgba(15,23,42,.85);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.15);border-radius:16px;padding:20px;color:#fff;box-shadow:0 20px 25px -5px rgba(0,0,0,.4);pointer-events:auto}.header{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:700;color:#818cf8;margin-bottom:12px;text-transform:uppercase;letter-spacing:.5px}.pulse{width:10px;height:10px;background:#ef4444;border-radius:50%;animation:pulse 2s infinite}@keyframes pulse{0%{transform:scale(.95);box-shadow:0 0 0 0 rgba(239,68,68,.7)}70%{transform:scale(1);box-shadow:0 0 0 6px rgba(239,68,68,0)}100%{transform:scale(.95);box-shadow:0 0 0 0 rgba(239,68,68,0)}}.transcript{font-size:14px;color:#94a3b8;line-height:1.5;font-style:italic;margin-bottom:16px;max-height:120px;overflow-y:auto;border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:12px}.hint{font-size:15px;color:#f8fafc;background:rgba(99,102,241,.15);border-left:3px solid #6366f1;padding:12px 14px;border-radius:0 6px 6px 0;line-height:1.5}ul{margin:0;padding-left:18px}li{margin-bottom:6px}';
        shadowRoot.appendChild(style);
        var wrapper = document.createElement('div');
        wrapper.className = 'wrapper';
        wrapper.innerHTML = '<div class="header"><div class="pulse"></div>Copilot Active</div><div class="transcript" id="transcript-box">Listening...</div><div class="hint" id="hint-box" style="display:none;"></div>';
        shadowRoot.appendChild(wrapper);
        document.body.appendChild(container);
      } else { shadowRoot = container.shadowRoot; }

      if (message.type === 'SHOW_COPILOT_TRANSCRIPT') {
        var tBox = shadowRoot.getElementById('transcript-box');
        if (tBox) { tBox.textContent = '"' + message.text.trim() + '..."'; tBox.scrollTop = tBox.scrollHeight; }
      }
      if (message.type === 'SHOW_COPILOT_HINT' || message.type === 'STREAM_COPILOT_HINT') {
        var hBox = shadowRoot.getElementById('hint-box');
        if (hBox) {
          hBox.style.display = 'block';
          var html = message.hint.split('\n').map(function(line) {
            var trimmed = line.trim();
            if (trimmed.startsWith('-') || trimmed.startsWith('*')) return '<li>' + trimmed.substring(1).trim() + '</li>';
            return trimmed ? '<p style="margin:0 0 6px 0">' + trimmed + '</p>' : '';
          }).join('');
          hBox.innerHTML = html.includes('<li>') ? '<ul style="margin:0;padding-left:18px;">' + html + '</ul>' : html;
        }
      }
      sendResponse({ success: true }); return true;
    }
  });

  // ─────────────────────────────────────────────
  // LinkedIn Outreach Generator
  // ─────────────────────────────────────────────
  function injectLinkedInOutreachButton() {
    if (!window.location.hostname.includes('linkedin.com') || !window.location.pathname.includes('/in/')) {
      var existing = document.getElementById('jobassist-linkedin-outreach');
      if (existing) existing.remove();
      return;
    }
    if (document.getElementById('jobassist-linkedin-outreach')) return;
    var btn = document.createElement('button');
    btn.id = 'jobassist-linkedin-outreach';
    btn.innerHTML = '✨ Draft Referral DM';
    btn.style.cssText = 'position:fixed;bottom:24px;left:24px;z-index:2147483647;background:linear-gradient(135deg,#6366f1,#4f46e5);color:white;border:none;border-radius:9999px;padding:12px 24px;font-family:system-ui,-apple-system,sans-serif;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 10px 15px -3px rgba(99,102,241,.4);transition:transform .2s;';
    btn.addEventListener('mouseenter', function() { btn.style.transform = 'translateY(-2px)'; });
    btn.addEventListener('mouseleave', function() { btn.style.transform = 'translateY(0)'; });
    btn.addEventListener('click', function() {
      btn.innerHTML = '⏳ Drafting...';
      try {
        var profileName = (document.querySelector('h1') || {}).innerText || 'this person';
        var headline = (document.querySelector('.text-body-medium') || {}).innerText || '';
        chrome.runtime.sendMessage({ type: 'GENERATE_LINKEDIN_OUTREACH', targetName: profileName.trim(), targetHeadline: headline.trim() }, function(response) {
          if (response && response.draft) { showDraftOverlay(response.draft); btn.innerHTML = '✨ Draft Referral DM'; }
          else { alert('Error generating draft: ' + ((response || {}).error || 'Unknown')); btn.innerHTML = '✨ Draft Referral DM'; }
        });
      } catch(e) { alert('Error: ' + e.message); btn.innerHTML = '✨ Draft Referral DM'; }
    });
    document.body.appendChild(btn);
  }

  function showDraftOverlay(draftText) {
    var existing = document.getElementById('jobassist-draft-overlay');
    if (existing) existing.remove();
    var container = document.createElement('div');
    container.id = 'jobassist-draft-overlay';
    container.style.cssText = 'position:fixed;bottom:80px;left:24px;z-index:2147483647;background:white;border-radius:12px;padding:20px;width:350px;box-shadow:0 20px 25px -5px rgba(0,0,0,.2);border:1px solid #e2e8f0;font-family:system-ui,-apple-system,sans-serif;';
    container.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><h3 style="margin:0;font-size:16px;color:#1e293b;font-weight:700;">📝 Outreach Draft</h3><button id="close-draft-btn" style="background:none;border:none;cursor:pointer;font-size:18px;color:#94a3b8;">&times;</button></div><textarea id="draft-textarea" style="width:100%;height:150px;padding:12px;border-radius:8px;border:1px solid #cbd5e1;font-family:inherit;font-size:14px;color:#334155;resize:none;box-sizing:border-box;">' + draftText + '</textarea><button id="copy-draft-btn" style="margin-top:12px;width:100%;background:#0f172a;color:white;border:none;padding:10px;border-radius:8px;font-weight:600;cursor:pointer;">Copy to Clipboard</button>';
    document.body.appendChild(container);
    document.getElementById('close-draft-btn').addEventListener('click', function() { container.remove(); });
    document.getElementById('copy-draft-btn').addEventListener('click', function() {
      var ta = document.getElementById('draft-textarea');
      ta.select(); document.execCommand('copy');
      var cb = document.getElementById('copy-draft-btn');
      cb.innerText = '✅ Copied!';
      setTimeout(function() { cb.innerText = 'Copy to Clipboard'; }, 2000);
    });
  }

  setInterval(injectLinkedInOutreachButton, 2000);

  // ─────────────────────────────────────────────
  // LinkedIn Easy Apply — inject autofill button into modal
  // ─────────────────────────────────────────────
  function injectLinkedInEasyApplyHelper() {
    if (!window.location.hostname.includes('linkedin.com')) return;

    // Detect the Easy Apply modal
    var modal = document.querySelector(
      '.artdeco-modal .jobs-easy-apply-content, ' +
      '[class*="jobs-easy-apply-content"], ' +
      'div[role="dialog"] .jobs-easy-apply-content, ' +
      '.artdeco-modal__content'
    );

    // Remove button if modal closed
    if (!modal) {
      var btn = document.getElementById('jobassist-easyapply-btn');
      if (btn) btn.remove();
      return;
    }

    if (document.getElementById('jobassist-easyapply-btn')) return;

    var eaBtn = document.createElement('button');
    eaBtn.id = 'jobassist-easyapply-btn';
    eaBtn.innerHTML = '⚡ JobAssist Auto-fill';
    eaBtn.title = 'Auto-fill this Easy Apply form with your profile';
    eaBtn.style.cssText = [
      'display:inline-flex', 'align-items:center', 'gap:6px',
      'background:linear-gradient(135deg,#6366f1,#4f46e5)',
      'color:white', 'border:none', 'border-radius:8px',
      'padding:8px 16px', 'font-size:13px', 'font-weight:600',
      'cursor:pointer', 'margin:8px 0',
      'box-shadow:0 4px 12px rgba(99,102,241,.4)',
      'transition:all .2s', 'font-family:system-ui,-apple-system,sans-serif',
      'z-index:2147483647'
    ].join(';');

    eaBtn.addEventListener('mouseenter', function() { eaBtn.style.transform = 'translateY(-1px)'; eaBtn.style.boxShadow = '0 6px 16px rgba(99,102,241,.5)'; });
    eaBtn.addEventListener('mouseleave', function() { eaBtn.style.transform = ''; eaBtn.style.boxShadow = '0 4px 12px rgba(99,102,241,.4)'; });

    eaBtn.addEventListener('click', async function() {
      eaBtn.innerHTML = '⏳ Scanning...';
      eaBtn.disabled = true;
      try {
        // Scan fields within the modal only
        var fields = scanAllFields();
        if (fields.length === 0) {
          eaBtn.innerHTML = '⚠️ No fields found';
          setTimeout(function() { eaBtn.innerHTML = '⚡ JobAssist Auto-fill'; eaBtn.disabled = false; }, 2000);
          return;
        }

        eaBtn.innerHTML = '🤖 AI filling ' + fields.length + ' fields...';

        // Get profile from storage
        var profile = await new Promise(function(resolve) {
          chrome.storage.local.get(['profiles', 'activeProfileId'], function(result) {
            var profiles = result.profiles || [];
            var activeId = result.activeProfileId;
            resolve(profiles.find(function(p) { return p.id === activeId; }) || null);
          });
        });

        if (!profile) {
          eaBtn.innerHTML = '⚠️ No active profile';
          setTimeout(function() { eaBtn.innerHTML = '⚡ JobAssist Auto-fill'; eaBtn.disabled = false; }, 2500);
          return;
        }

        var settings = await new Promise(function(resolve) {
          chrome.storage.local.get(['settings'], function(result) { resolve(result.settings || {}); });
        });

        var jdData = extractJobDescription();
        var profileData = Object.assign({}, profile, { resumeBase64: undefined });

        var fieldList = fields.map(function(f) {
          var desc = '[' + f.id + '] ' + f.label + ' (type: ' + f.type + ')';
          if (f.options && f.options.length > 0) desc += ' — Options: ' + f.options.join(', ');
          return desc;
        }).join('\n');

        var prompt = 'You are a job application assistant. Fill these LinkedIn Easy Apply fields accurately.\n' +
          'Profile: ' + JSON.stringify(profileData, null, 2) + '\n' +
          'Job: ' + jdData.title + ' at ' + jdData.company + '\n' +
          'JD: ' + (jdData.text || '').substring(0, 2000) + '\n\n' +
          'Fields:\n' + fieldList + '\n\n' +
          'Rules:\n' +
          '- For select/radio/combobox: pick EXACTLY one of the listed options.\n' +
          '- For checkbox: yes or no.\n' +
          '- For text/textarea: concise relevant answer.\n' +
          '- Use "skip" for irrelevant fields.\n' +
          'Return ONLY raw JSON {"field_0": "answer", ...}. No markdown.';

        var provider = (settings.provider || 'openai');
        var key = provider === 'anthropic' ? settings.anthropicKey : provider === 'google' ? settings.geminiKey : (settings.openaiKey || settings.apiKey);

        var aiRes = await fetch('http://localhost:3000/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + key,
            'x-ai-provider': provider,
            'x-ai-model': settings.model || 'gpt-4o-mini'
          },
          body: JSON.stringify({ model: settings.model || 'gpt-4o-mini', prompt: prompt })
        });

        var data = await aiRes.json();
        var answers = {};
        try {
          var jsonStr = data.text.replace(/```json/gi, '').replace(/```/g, '').trim();
          answers = JSON.parse(jsonStr);
        } catch(e) {
          throw new Error('AI response could not be parsed');
        }

        var filled = await applyAnswers(answers);
        eaBtn.innerHTML = '✅ ' + filled + '/' + fields.length + ' filled!';
        eaBtn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
        setTimeout(function() {
          eaBtn.innerHTML = '⚡ JobAssist Auto-fill';
          eaBtn.style.background = 'linear-gradient(135deg,#6366f1,#4f46e5)';
          eaBtn.disabled = false;
        }, 3000);
      } catch(e) {
        eaBtn.innerHTML = '❌ ' + (e.message || 'Error');
        eaBtn.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)';
        setTimeout(function() {
          eaBtn.innerHTML = '⚡ JobAssist Auto-fill';
          eaBtn.style.background = 'linear-gradient(135deg,#6366f1,#4f46e5)';
          eaBtn.disabled = false;
        }, 3000);
      }
    });

    // Inject button at top of modal footer or form
    var footer = modal.querySelector('.jobs-easy-apply-footer, .artdeco-modal__actionbar, [class*="footer"]');
    var insertTarget = footer || modal;
    insertTarget.insertBefore(eaBtn, insertTarget.firstChild);
  }

  setInterval(injectLinkedInEasyApplyHelper, 1000);
  console.log('[JobAssist Pro] Content script v2 ready — AI Autofill Engine loaded');
})();
