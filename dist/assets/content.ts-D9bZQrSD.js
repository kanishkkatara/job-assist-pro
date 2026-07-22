import{t as e}from"./rolldown-runtime-BgaNhQyE.js";var t=e((()=>{(function(){if(window.__jobAssistInjected)return;window.__jobAssistInjected=!0;function e(){let e=document.body.innerText,t=document.title,n=window.location.href,r=document.querySelector(`.job-details-jobs-unified-top-card__job-title, h1.t-24, h3.base-search-card__title, .job-title, .t-24.t-bold`),i=document.querySelector(`.job-details-jobs-unified-top-card__company-name, .topcard__org-name-link, h4.base-search-card__subtitle, .job-details-jobs-unified-top-card__primary-description a`),a=document.querySelector(`#job-details, .jobs-description__content, .jobs-description-content__text, .show-more-less-html__markup, .job-view-layout`),o=document.querySelector(`#header h1, .app-title`),s=document.querySelector(`#content, .job-post`),c=document.querySelector(`.posting-header h2`),l=document.querySelector(`.posting-description`),u=document.querySelector(`[data-automation-id="jobPostingDescription"]`),d=r?.innerText?.trim()||o?.innerText?.trim()||c?.innerText?.trim()||document.querySelector(`h1`)?.innerText?.trim()||t,f=i?.innerText?.trim()||``,p=a?.innerText?.trim()||s?.innerText?.trim()||l?.innerText?.trim()||u?.innerText?.trim()||e.substring(0,8e3);return p=p.replace(/\n{3,}/g,`

`).replace(/[ \t]{2,}/g,` `).trim().substring(0,1e4),{url:n,title:d,company:f,text:p,capturedAt:new Date().toISOString()}}let t={fullName:/\b(full.?name|your.?name|name)\b/i,firstName:/\b(first.?name|given.?name|fname)\b/i,lastName:/\b(last.?name|surname|family.?name|lname)\b/i,email:/\b(email|e-mail|mail)\b/i,phone:/\b(phone|mobile|cell|telephone|contact.?number)\b/i,location:/\b(city|location|address|state|country|region|zip|postal)\b/i,linkedin:/\b(linkedin|linked.in)\b/i,github:/\b(github|git.?hub)\b/i,website:/\b(website|portfolio|personal.?site|url|web)\b/i,currentTitle:/\b(current.?title|job.?title|position|role)\b/i,currentCompany:/\b(current.?company|employer|company.?name)\b/i,yearsExperience:/\b(years?.?of?.?experience|experience.?years?)\b/i,salary:/\b(salary|compensation|pay|expected.?salary|desired.?salary)\b/i,coverLetter:/\b(cover.?letter|why.?do.?you|motivation|introduction|tell.?us.?about)\b/i,startDate:/\b(start.?date|available|availability|notice.?period)\b/i,referral:/\b(referral|referred|how.?did.?you.?hear|source)\b/i};function n(e){let t=[e.getAttribute(`name`)||``,e.getAttribute(`id`)||``,e.getAttribute(`placeholder`)||``,e.getAttribute(`aria-label`)||``,e.getAttribute(`autocomplete`)||``].join(` `).toLowerCase(),n=``;if(e.id){let t=document.querySelector(`label[for="${e.id}"]`);t&&(n=t.innerText)}if(!n){let t=e.parentElement,r=0;for(;t&&r<4;){let e=t.querySelector(`label`);if(e){n=e.innerText;break}let i=t.previousElementSibling;if(i&&i.innerText&&i.innerText.trim().length<50){n=i.innerText.trim();break}t=t.parentElement,r++}}return{labelText:n?n.trim():``,attrs:t}}function r(e,n,r){let i=r+` `+n.toLowerCase();for(let[e,n]of Object.entries(t))if(n.test(i))return e;return null}function i(){let e=Array.from(document.querySelectorAll(`input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, select, [contenteditable="true"]`)).filter(e=>e.offsetParent!==null),t=[];for(let i of e){let{labelText:e,attrs:a}=n(i),o=r(i,e,a);t.push({element:i,fieldType:o,labelText:e})}return t}let a={};function o(){let e=[];a={};let t=Array.from(document.querySelectorAll(`textarea, div[contenteditable="true"], input[type="text"]`)).filter(e=>e.offsetParent!==null&&!e.disabled&&e.dataset.jobassistFilled!==`true`);for(let r of t){let{labelText:t}=n(r),i=t||r.getAttribute(`aria-label`)||r.getAttribute(`placeholder`)||``;if(!i){let e=r;for(let t=0;t<4&&e;t++){if(e.previousElementSibling&&e.previousElementSibling.innerText){i=e.previousElementSibling.innerText;break}e=e.parentElement}}if(i=i.replace(/\*/g,``).trim(),i&&i.length>10&&!i.match(/^(type here|enter text|optional|search)/i)){let t=r.id||r.name||`field_${e.length}`,n={id:t,type:`text`,question:i.substring(0,300),element:r};e.push(n),a[t]=n}}let r=Array.from(document.querySelectorAll(`input[type="radio"]`)).filter(e=>e.offsetParent!==null&&!e.disabled&&e.dataset.jobassistFilled!==`true`),i={};for(let e of r)e.name&&(i[e.name]||(i[e.name]=[]),i[e.name].push(e));for(let[t,n]of Object.entries(i)){let r=n[0].closest(`fieldset, .field, .form-group, div.application-question, div[class*="question"]`),i=``;if(r){let e=r.querySelector(`legend`);if(e)i=e.innerText;else{let e=r.innerText.split(`
`).map(e=>e.trim()).filter(e=>e.length>10&&![`Yes`,`No`,`True`,`False`].includes(e));e.length>0&&(i=e[0])}}let o=n.map(e=>{let t=e.value;if(e.id)try{let n=document.querySelector(`label[for="${CSS.escape(e.id)}"]`);n&&(t=n.innerText)}catch{}if(!t||t===`on`){let n=e.closest(`label`);n&&(t=n.innerText)}return t.trim()}).filter(Boolean);if(i=i.replace(/\*/g,``).trim(),i&&i.length>10&&o.length>0){let r=`radio_${t}`,s={id:r,type:`radio`,question:`${i} (Options: ${o.join(`, `)})`,element:n};e.push(s),a[r]=s}}return e}function s(e,t){if(e.dataset.jobassistFilled=`true`,e.focus&&e.focus(),e.isContentEditable)e.textContent=t;else{let n=Object.getOwnPropertyDescriptor(e.tagName===`TEXTAREA`?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype,`value`)?.set;n?n.call(e,t):e.value=t}e.dispatchEvent(new Event(`input`,{bubbles:!0})),e.dispatchEvent(new KeyboardEvent(`keydown`,{bubbles:!0,key:`ArrowDown`,keyCode:40})),e.dispatchEvent(new KeyboardEvent(`keyup`,{bubbles:!0,key:`ArrowDown`,keyCode:40})),e.dispatchEvent(new Event(`change`,{bubbles:!0}))}function c(e,t){if(!e)return t||`95,000 - 110,000 EUR`;let n=[...e.matchAll(/(?:[$£€₹]|INR|EUR|USD|GBP)?\s*(\d+(?:,\d+)+|\d+\.?\d*k|\d+\s*LPA|\d{2,3})\s*(?:-|to)\s*(?:[$£€₹]|INR|EUR|USD|GBP)?\s*(\d+(?:,\d+)+|\d+\.?\d*k|\d+\s*LPA|\d{2,3})\s*(?:INR|EUR|USD|GBP|LPA)?/gi)];for(let e of n){let t=e[0].trim();if(!t.includes(`202`)&&!t.includes(`201`)&&!t.includes(`200`)&&/[$£€₹k]|000|lpa|inr|eur|usd|gbp/i.test(t))return t}let r=e.toLowerCase();return r.includes(`₹`)||r.includes(`inr`)||r.includes(`lpa`)||r.includes(`india`)||r.includes(`bangalore`)||r.includes(`bengaluru`)?`38,00,000 - 45,00,000 INR`:r.includes(`€`)||r.includes(`eur`)||r.includes(`euro`)||r.includes(`berlin`)||r.includes(`germany`)||r.includes(`amsterdam`)||r.includes(`paris`)?`95,000 - 110,000 EUR`:r.includes(`£`)||r.includes(`gbp`)||r.includes(`uk `)||r.includes(`london`)?`85,000 - 100,000 GBP`:r.includes(`$`)||r.includes(`usd`)||r.includes(`us `)||r.includes(`united states`)||r.includes(`new york`)||r.includes(`san francisco`)?`130,000 - 150,000 USD`:t||`95,000 - 110,000 EUR`}async function l(e,t){let r=i(),a=0,l={fullName:e.personalInfo?.fullName||``,firstName:(e.personalInfo?.fullName||``).split(` `)[0]||``,lastName:(e.personalInfo?.fullName||``).split(` `).slice(1).join(` `)||``,email:e.personalInfo?.email||``,phone:e.personalInfo?.phone||``,location:e.personalInfo?.location||``,linkedin:e.personalInfo?.linkedin||``,github:e.personalInfo?.github||``,website:e.personalInfo?.website||``,currentTitle:e.targetRole||``,currentCompany:e.experience?.[0]?.company||``,yearsExperience:e.personalInfo?.yearsExperience||``,salary:c(t?.text,e.personalInfo?.expectedSalary),startDate:e.personalInfo?.availability||``};for(let{element:t,fieldType:n,labelText:i}of r){let r=l[n];if(!r&&e.customFields&&i){for(let[t,n]of Object.entries(e.customFields))if(i.toLowerCase().includes(t.toLowerCase())){r=n;break}}if(r){if(n===`phone`){let e=r.match(/^\+?(\d{1,3})[\s-]+(.+)$/);if(e){let n=e[1],i=e[2],a=t.closest(`div, label, fieldset, li, section`);if(a){let e=a.querySelector(`select`);if(e){for(let t of e.options)if(t.value.includes(n)||t.textContent.includes(`+`+n)){s(e,t.value);break}}}r=i}}s(t,r),a++,t.style.transition=`box-shadow 0.3s ease`,t.style.boxShadow=`0 0 0 2px #6C63FF`,setTimeout(()=>{t.style.boxShadow=``},2e3)}}if(e.resumeBase64&&e.resumeFileName){let t=Array.from(document.querySelectorAll(`input[type="file"]`));for(let r of t){let i=!1,{labelText:o,attrs:s}=n(r),c=s+` `+o.toLowerCase();if(/\b(resume|cv|curriculum vitae)\b/i.test(c))i=!0;else{let e=r.parentElement,t=0;for(;e&&e.tagName!==`BODY`&&t<8;){let n=(e.innerText||``).toLowerCase();if(/\b(resume|cv|curriculum vitae)\b/.test(n)){i=!0;break}e=e.parentElement,t++}}if(!i&&t.length===1&&(i=!0),i)try{let t=await(await fetch(e.resumeBase64)).blob(),n=new File([t],e.resumeFileName,{type:`application/pdf`}),i=new DataTransfer;i.items.add(n),r.files=i.files,r.dispatchEvent(new Event(`change`,{bubbles:!0})),r.dataset.jobassistFilled=`true`,a++}catch(e){console.error(`[JobAssist] Failed to auto-attach resume`,e)}}}let u=o().map(e=>({id:e.id,question:e.question}));return{filled:a,total:r.length,unansweredQuestions:u}}let u=null;document.addEventListener(`contextmenu`,e=>{u=e.target},!0);function d(e,t){let n=a[e];if(n)if(n.type===`radio`){let e=n.element.find(e=>{let n=e.value;if(e.id)try{let t=document.querySelector(`label[for="${CSS.escape(e.id)}"]`);t&&(n=t.innerText)}catch{}if(!n||n===`on`){let t=e.closest(`label`);t&&(n=t.innerText)}return n.toLowerCase().includes(t.toLowerCase())||t.toLowerCase().includes(n.toLowerCase())});if(e)return e.click(),e.dataset.jobassistFilled=`true`,!0}else return s(n.element,t),n.element.style.transition=`box-shadow 0.3s ease`,n.element.style.boxShadow=`0 0 0 2px #6C63FF`,setTimeout(()=>{n.element.style.boxShadow=``},2e3),!0;return!1}chrome.runtime.onMessage.addListener((t,n,r)=>{if(t.type===`EXTRACT_JD`)return r({jd:e()}),!0;if(t.type===`FILL_FORM`)return l(t.profile,t.jd).then(e=>{r(e)}).catch(e=>{console.error(`[JobAssist] Form fill error:`,e),r({error:e.message})}),!0;if(t.type===`FILL_CUSTOM_ANSWERS`){let e=0;for(let[n,r]of Object.entries(t.answers))d(n,r)&&e++;return r({success:!0,filled:e}),!0}if(t.type===`SUBMIT_FORM`){try{let e=[`button[type="submit"]`,`input[type="submit"]`,`button.submit_app`,`#submit_app`,`.application-submit-button`,`[data-qa="submit-button"]`],t=null;for(let n of e)if(t=document.querySelector(n),t)break;t||=Array.from(document.querySelectorAll(`button, a.button`)).find(e=>{let t=e.textContent?.toLowerCase()||``;return t.includes(`submit application`)||t.includes(`apply`)||t.includes(`submit`)}),t?(t.click(),r({success:!0,message:`Form submitted`})):r({success:!1,error:`Submit button not found`})}catch(e){r({success:!1,error:e.message})}return!0}if(t.type===`ATTACH_RESUME`){try{let e=document.querySelector(`input[type="file"]`);if(!e)return r({success:!1,error:`No file input found`}),!0;let n=atob(t.base64Pdf.split(`,`)[1]||t.base64Pdf),i=Array(n.length);for(let e=0;e<n.length;e++)i[e]=n.charCodeAt(e);let a=new Uint8Array(i),o=new Blob([a],{type:`application/pdf`}),s=new File([o],t.filename||`Resume.pdf`,{type:`application/pdf`,lastModified:new Date().getTime()}),c=new DataTransfer;c.items.add(s),e.files=c.files,e.dispatchEvent(new Event(`input`,{bubbles:!0})),e.dispatchEvent(new Event(`change`,{bubbles:!0})),r({success:!0})}catch(e){console.error(`[JobAssist] Attach file error:`,e),r({success:!1,error:e.message})}return!0}if(t.type===`GET_QUESTIONS`)return r({questions:o().map(e=>({id:e.id,question:e.question}))}),!0;if(t.type===`FILL_ANSWER`)return r({success:d(t.questionId,t.answer)}),!0;if(t.type===`PING`)return r({alive:!0}),!0;if(t.type===`INLINE_GENERATION_START`)return u&&(u.dataset.originalPlaceholder=u.getAttribute(`placeholder`)||``,u.setAttribute(`placeholder`,`✨ Generating answer...`),u.style.opacity=`0.7`),r({success:!0}),!0;if(t.type===`GET_ACTIVE_QUESTION`){let e=``;if(u){let t=u;if(t.id){let n=document.querySelector(`label[for="${CSS.escape(t.id)}"]`);n&&(e=n.innerText.trim())}if(!e)for(let n=0;n<4&&t;n++){if(t.previousElementSibling){let n=t.previousElementSibling.innerText?.trim();if(n&&n.length>5){e=n;break}}t=t.parentElement}e||=u.getAttribute(`aria-label`)||``,e||=u.getAttribute(`placeholder`)||``,e=e.replace(/\*/g,``).trim()}return r({questionText:e}),!0}if(t.type===`INLINE_GENERATION_SUCCESS`)return u&&(s(u,t.answer),u.setAttribute(`placeholder`,u.dataset.originalPlaceholder||``),u.style.opacity=`1`,u.style.transition=`box-shadow 0.3s ease`,u.style.boxShadow=`0 0 0 2px #6C63FF`,setTimeout(()=>{u.style.boxShadow=``},2e3)),r({success:!0}),!0;if(t.type===`INLINE_GENERATION_ERROR`)return u&&(u.setAttribute(`placeholder`,u.dataset.originalPlaceholder||``),u.style.opacity=`1`,alert(`JobAssist Error: ${t.error}`)),r({success:!0}),!0;if(t.type===`SHOW_COPILOT_TRANSCRIPT`||t.type===`SHOW_COPILOT_HINT`||t.type===`STREAM_COPILOT_HINT`){let e=document.getElementById(`jobassist-copilot-overlay`),n=null;if(e)n=e.shadowRoot;else{e=document.createElement(`div`),e.id=`jobassist-copilot-overlay`,e.style.position=`fixed`,e.style.bottom=`20px`,e.style.right=`20px`,e.style.zIndex=`2147483647`,e.style.width=`380px`,e.style.maxHeight=`450px`,e.style.fontFamily=`system-ui, -apple-system, sans-serif`,e.style.pointerEvents=`none`,n=e.attachShadow({mode:`open`});let t=document.createElement(`style`);t.textContent=`
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
        `,n.appendChild(t);let r=document.createElement(`div`);r.className=`wrapper`,r.innerHTML=`
          <div class="header">
            <div class="pulse"></div>
            Copilot Active
          </div>
          <div class="transcript" id="transcript-box">Listening...</div>
          <div class="hint" id="hint-box" style="display:none;"></div>
        `,n.appendChild(r),document.body.appendChild(e)}if(t.type===`SHOW_COPILOT_TRANSCRIPT`){let e=n.getElementById(`transcript-box`);e&&(e.textContent=`"`+t.text.trim()+`..."`,e.scrollTop=e.scrollHeight)}if(t.type===`SHOW_COPILOT_HINT`||t.type===`STREAM_COPILOT_HINT`){let e=n.getElementById(`hint-box`);if(e){e.style.display=`block`;let n=t.hint.split(`
`).map(e=>{let t=e.trim();return t.startsWith(`-`)||t.startsWith(`*`)?`<li>${t.substring(1).trim()}</li>`:t?`<p style="margin:0 0 6px 0">${t}</p>`:``}).join(``);e.innerHTML=n.includes(`<li>`)?`<ul style="margin:0;padding-left:18px;">${n}</ul>`:n}}return r({success:!0}),!0}});function f(){if(!window.location.hostname.includes(`linkedin.com`)||!window.location.pathname.includes(`/in/`)){let e=document.getElementById(`jobassist-linkedin-outreach`);e&&e.remove();return}if(document.getElementById(`jobassist-linkedin-outreach`))return;let e=document.createElement(`button`);e.id=`jobassist-linkedin-outreach`,e.innerHTML=`✨ Draft Referral DM`,e.style.cssText=`
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
    `,e.addEventListener(`mouseenter`,()=>e.style.transform=`translateY(-2px)`),e.addEventListener(`mouseleave`,()=>e.style.transform=`translateY(0)`),e.addEventListener(`click`,async()=>{e.innerHTML=`⏳ Drafting...`;try{let t=document.querySelector(`h1`)?.innerText?.trim()||`this person`,n=document.querySelector(`.text-body-medium`)?.innerText?.trim()||``;chrome.runtime.sendMessage({type:`GENERATE_LINKEDIN_OUTREACH`,targetName:t,targetHeadline:n},t=>{t&&t.draft?(p(t.draft),e.innerHTML=`✨ Draft Referral DM`):(alert(`Error generating draft: `+(t?.error||`Unknown`)),e.innerHTML=`✨ Draft Referral DM`)})}catch(t){alert(`Error: `+t.message),e.innerHTML=`✨ Draft Referral DM`}}),document.body.appendChild(e)}function p(e){let t=document.getElementById(`jobassist-draft-overlay`);t&&t.remove(),t=document.createElement(`div`),t.id=`jobassist-draft-overlay`,t.style.cssText=`
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
    `,t.innerHTML=`
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="margin:0; font-size:16px; color:#1e293b; font-weight:700;">📝 Outreach Draft</h3>
        <button id="close-draft-btn" style="background:none;border:none;cursor:pointer;font-size:18px;color:#94a3b8;">&times;</button>
      </div>
      <textarea id="draft-textarea" style="width:100%; height:150px; padding:12px; border-radius:8px; border:1px solid #cbd5e1; font-family:inherit; font-size:14px; color:#334155; resize:none; box-sizing:border-box;">${e}</textarea>
      <button id="copy-draft-btn" style="margin-top:12px; width:100%; background:#0f172a; color:white; border:none; padding:10px; border-radius:8px; font-weight:600; cursor:pointer;">Copy to Clipboard</button>
    `,document.body.appendChild(t),document.getElementById(`close-draft-btn`).addEventListener(`click`,()=>t.remove()),document.getElementById(`copy-draft-btn`).addEventListener(`click`,()=>{document.getElementById(`draft-textarea`).select(),document.execCommand(`copy`);let e=document.getElementById(`copy-draft-btn`);e.innerText=`✅ Copied!`,setTimeout(()=>e.innerText=`Copy to Clipboard`,2e3)})}setInterval(f,2e3),console.log(`[JobAssist Pro] Content script ready`)})()}));export default t();