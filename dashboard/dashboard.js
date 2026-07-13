// dashboard/dashboard.js

// ─────────────────────────────────────────────
// Storage Helpers (inline to avoid module issues in extension pages)
// ─────────────────────────────────────────────
const Storage = {
  async get(keys) {
    return new Promise((r) => chrome.storage.local.get(keys, r));
  },
  async set(data) {
    return new Promise((r) => chrome.storage.local.set(data, r));
  },
  async getProfiles() {
    const { profiles } = await this.get({ profiles: [] });
    return profiles;
  },
  async saveProfiles(profiles) {
    await this.set({ profiles });
  },
  async getSettings() {
    const { settings } = await this.get({ settings: { apiKey: '', model: 'gpt-4o-mini' } });
    return settings;
  },
  async saveSettings(settings) {
    await this.set({ settings });
  },
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ─────────────────────────────────────────────
// Toast Notifications
// ─────────────────────────────────────────────
function showToast(message, type = 'success', duration = 3500) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────
function initNavigation() {
  document.querySelectorAll('.sidebar-item[data-page]').forEach((item) => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      document.querySelectorAll('.sidebar-item').forEach((i) => i.classList.remove('active'));
      document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(`page-${page}`).classList.add('active');
    });
  });

  document.getElementById('open-extension-btn').addEventListener('click', () => {
    showToast('Click the JobAssist Pro icon in your Chrome toolbar to open the extension popup.', 'info');
  });
}

// ─────────────────────────────────────────────
// Profile Cards
// ─────────────────────────────────────────────
function getInitials(name) {
  return name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
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

function renderProfileCard(profile) {
  const card = document.createElement('div');
  card.className = 'profile-card';
  card.dataset.id = profile.id;

  const hasResume = !!profile.resumeText;
  const skills = (profile.skills || []).slice(0, 4);
  const expCount = (profile.experience || []).length;

  card.innerHTML = `
    <div class="profile-card-avatar">${escapeHTML(getInitials(profile.name))}</div>
    <div class="profile-card-name">${escapeHTML(profile.name || 'Unnamed Profile')}</div>
    <div class="profile-card-role">${escapeHTML(profile.targetRole || 'No role set')}</div>
    <div class="profile-card-meta">
      ${hasResume ? '<span class="resume-badge">📄 Resume Uploaded</span>' : '<span class="resume-badge missing">⚠ No Resume</span>'}
      ${expCount > 0 ? `<span class="profile-card-tag">💼 ${expCount} job${expCount > 1 ? 's' : ''}</span>` : ''}
      ${skills.map(s => `<span class="profile-card-tag">${escapeHTML(s)}</span>`).join('')}
    </div>
    <div class="profile-card-actions">
      <button class="btn btn-secondary btn-sm edit-btn" data-id="${profile.id}">✏️ Edit</button>
      <button class="btn btn-secondary btn-sm duplicate-btn" data-id="${profile.id}">📋 Duplicate</button>
      <button class="btn btn-secondary btn-sm export-btn" data-id="${profile.id}">📤 Export</button>
      <button class="btn btn-danger btn-sm delete-btn" data-id="${profile.id}" style="margin-left:auto;">🗑</button>
    </div>
  `;

  card.querySelector('.edit-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openProfilePanel(profile.id);
  });
  card.querySelector('.duplicate-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    await duplicateProfile(profile.id);
  });
  card.querySelector('.export-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    exportProfile(profile.id);
  });
  card.querySelector('.delete-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (confirm(`Delete profile "${profile.name}"?`)) {
      await deleteProfile(profile.id);
    }
  });

  card.addEventListener('click', () => openProfilePanel(profile.id));
  return card;
}

async function renderProfiles() {
  const grid = document.getElementById('profiles-grid');
  const empty = document.getElementById('profiles-empty');
  const profiles = await Storage.getProfiles();

  // Clear existing cards (keep empty state element)
  Array.from(grid.children).forEach(child => {
    if (child !== empty) child.remove();
  });

  if (profiles.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  for (const profile of profiles) {
    grid.insertBefore(renderProfileCard(profile), empty);
  }

  // Add "+" card
  const addCard = document.createElement('div');
  addCard.className = 'add-profile-card';
  addCard.innerHTML = '<div class="add-icon">＋</div><div style="font-weight:600;font-size:14px;">New Profile</div><div style="font-size:12px;">Add a new role profile</div>';
  addCard.addEventListener('click', () => openProfilePanel());
  grid.insertBefore(addCard, empty);
}

async function duplicateProfile(id) {
  const profiles = await Storage.getProfiles();
  const src = profiles.find(p => p.id === id);
  if (!src) return;
  const copy = { ...src, id: generateId(), name: src.name + ' (copy)', createdAt: new Date().toISOString() };
  profiles.push(copy);
  await Storage.saveProfiles(profiles);
  await renderProfiles();
  showToast('Profile duplicated!');
}

async function exportProfile(id) {
  const profiles = await Storage.getProfiles();
  const profile = profiles.find(p => p.id === id);
  if (!profile) return;
  
  const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; 
  a.download = `jobassist_profile_${profile.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
  a.click(); 
  URL.revokeObjectURL(url);
  showToast(`Profile "${profile.name}" exported!`);
}

async function deleteProfile(id) {
  const profiles = await Storage.getProfiles();
  await Storage.saveProfiles(profiles.filter(p => p.id !== id));
  await renderProfiles();
  showToast('Profile deleted.', 'info');
}

// ─────────────────────────────────────────────
// Profile Panel (Drawer)
// ─────────────────────────────────────────────
let currentSkills = [];
let currentExperience = [];
let currentEducation = [];
let currentResumeText = '';
let currentResumeFileName = '';
let currentResumeBase64 = '';
let currentCustomFields = {};

function openProfilePanel(profileId = null) {
  const overlay = document.getElementById('profile-panel-overlay');
  const titleEl = document.getElementById('panel-title');
  document.getElementById('profile-id').value = profileId || '';
  currentSkills = [];
  currentExperience = [];
  currentEducation = [];
  currentResumeText = '';
  currentResumeFileName = '';
  currentResumeBase64 = '';
  currentCustomFields = {};

  // Reset form
  ['pf-name','pf-target-role','pf-full-name','pf-email','pf-phone','pf-location',
   'pf-linkedin','pf-github','pf-website','pf-years-exp','pf-availability',
   'pf-salary','pf-summary','pf-extra-context', 'pf-system-prompt'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('upload-result').style.display = 'none';
  document.getElementById('resume-preview-wrap').style.display = 'none';
  renderSkillTags();
  renderExperienceList();
  renderEducationList();
  renderCustomFieldsList();

  if (profileId) {
    titleEl.textContent = 'Edit Profile';
    Storage.getProfiles().then(profiles => {
      const profile = profiles.find(p => p.id === profileId);
      if (!profile) return;
      populateForm(profile);
    });
  } else {
    titleEl.textContent = 'New Profile';
  }

  overlay.classList.add('open');
}

function populateForm(profile) {
  const set = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
  set('pf-name', profile.name);
  set('pf-target-role', profile.targetRole);
  set('pf-full-name', profile.personalInfo?.fullName);
  set('pf-email', profile.personalInfo?.email);
  set('pf-phone', profile.personalInfo?.phone);
  set('pf-location', profile.personalInfo?.location);
  set('pf-linkedin', profile.personalInfo?.linkedin);
  set('pf-github', profile.personalInfo?.github);
  set('pf-website', profile.personalInfo?.website);
  set('pf-years-exp', profile.personalInfo?.yearsExperience);
  set('pf-availability', profile.personalInfo?.availability);
  set('pf-salary', profile.personalInfo?.expectedSalary);
  set('pf-summary', profile.summary);
  set('pf-extra-context', profile.additionalContext);
  set('pf-system-prompt', profile.systemPrompt);

  currentSkills = profile.skills || [];
  currentExperience = profile.experience || [];
  currentEducation = profile.education || [];
  currentResumeText = profile.resumeText || '';
  currentResumeFileName = profile.resumeFileName || '';
  currentResumeBase64 = profile.resumeBase64 || '';
  currentCustomFields = profile.customFields || {};

  renderSkillTags();
  renderExperienceList();
  renderEducationList();
  renderCustomFieldsList();

  if (profile.resumeText) {
    document.getElementById('upload-result').style.display = 'block';
    document.getElementById('upload-result').innerHTML = `
      <div class="upload-success">
        <span class="file-icon">📄</span>
        <div class="file-info">
          <div class="file-name">${profile.resumeFileName || 'resume.pdf'}</div>
          <div class="file-pages">Resume text extracted ✓</div>
        </div>
        <button class="btn btn-danger btn-sm" id="remove-resume-btn">Remove</button>
      </div>`;
    document.getElementById('remove-resume-btn')?.addEventListener('click', clearResume);
    document.getElementById('resume-preview-wrap').style.display = 'block';
    document.getElementById('resume-text-preview').textContent = profile.resumeText.substring(0, 600) + '...';
  }
}

function closeProfilePanel() {
  document.getElementById('profile-panel-overlay').classList.remove('open');
}

async function saveProfile() {
  const profileId = document.getElementById('profile-id').value;
  const name = document.getElementById('pf-name').value.trim();
  const targetRole = document.getElementById('pf-target-role').value.trim();
  if (!name) { showToast('Profile name is required.', 'error'); return; }

  const profile = {
    id: profileId || generateId(),
    name,
    targetRole,
    personalInfo: {
      fullName: document.getElementById('pf-full-name').value.trim(),
      email: document.getElementById('pf-email').value.trim(),
      phone: document.getElementById('pf-phone').value.trim(),
      location: document.getElementById('pf-location').value.trim(),
      linkedin: document.getElementById('pf-linkedin').value.trim(),
      github: document.getElementById('pf-github').value.trim(),
      website: document.getElementById('pf-website').value.trim(),
      yearsExperience: document.getElementById('pf-years-exp').value.trim(),
      availability: document.getElementById('pf-availability').value.trim(),
      expectedSalary: document.getElementById('pf-salary').value.trim(),
    },
    summary: document.getElementById('pf-summary').value.trim(),
    skills: [...currentSkills],
    experience: [...currentExperience],
    education: [...currentEducation],
    customFields: currentCustomFields,
    resumeText: currentResumeText,
    resumeFileName: currentResumeFileName,
    resumeBase64: currentResumeBase64,
    additionalContext: document.getElementById('pf-extra-context').value.trim(),
    systemPrompt: document.getElementById('pf-system-prompt').value.trim(),
    createdAt: profileId ? undefined : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const profiles = await Storage.getProfiles();
  if (profileId) {
    const idx = profiles.findIndex(p => p.id === profileId);
    if (idx >= 0) {
      profile.createdAt = profiles[idx].createdAt;
      profiles[idx] = profile;
    } else {
      profiles.push(profile);
    }
  } else {
    profiles.push(profile);
  }

  await Storage.saveProfiles(profiles);
  closeProfilePanel();
  await renderProfiles();
  showToast(`Profile "${name}" saved!`);
}

// ─────────────────────────────────────────────
// Skills Builder
// ─────────────────────────────────────────────
function renderSkillTags() {
  const container = document.getElementById('skills-container');
  const input = document.getElementById('skills-input');
  container.innerHTML = '';
  currentSkills.forEach((skill, i) => {
    const tag = document.createElement('span');
    tag.className = 'skill-tag';
    tag.innerHTML = `${escapeHTML(skill)} <button data-i="${i}">×</button>`;
    tag.querySelector('button').addEventListener('click', () => {
      currentSkills.splice(i, 1);
      renderSkillTags();
    });
    container.appendChild(tag);
  });
  container.appendChild(input);
}

function addSkill(val) {
  const skill = val.trim().replace(/,+$/, '').trim();
  if (skill && !currentSkills.includes(skill)) {
    currentSkills.push(skill);
    renderSkillTags();
  }
}

// ─────────────────────────────────────────────
// Experience Builder
// ─────────────────────────────────────────────
function renderExperienceList() {
  const list = document.getElementById('experience-list');
  list.innerHTML = '';
  currentExperience.forEach((exp, i) => {
    const item = document.createElement('div');
    item.className = 'exp-item';
    item.innerHTML = `
      <div class="exp-item-header">
        <div class="exp-item-title">Position ${i + 1}</div>
        <button class="btn btn-danger btn-sm" data-i="${i}">Remove</button>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Job Title</label>
          <input class="form-input" value="${escapeHTML(exp.title || '')}" placeholder="Software Engineer" data-field="title" data-i="${i}" /></div>
        <div class="form-group"><label class="form-label">Company</label>
          <input class="form-input" value="${escapeHTML(exp.company || '')}" placeholder="Google" data-field="company" data-i="${i}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Start Date</label>
          <input class="form-input" value="${escapeHTML(exp.startDate || '')}" placeholder="Jan 2022" data-field="startDate" data-i="${i}" /></div>
        <div class="form-group"><label class="form-label">End Date</label>
          <input class="form-input" value="${escapeHTML(exp.endDate || '')}" placeholder="Present" data-field="endDate" data-i="${i}" /></div>
      </div>
      <div class="form-group"><label class="form-label">Description</label>
        <textarea class="form-textarea" rows="3" placeholder="Key responsibilities and achievements..." data-field="description" data-i="${i}">${escapeHTML(exp.description || '')}</textarea></div>
    `;
    item.querySelector('button[data-i]').addEventListener('click', () => {
      currentExperience.splice(i, 1);
      renderExperienceList();
    });
    item.querySelectorAll('[data-field]').forEach(el => {
      el.addEventListener('input', () => {
        currentExperience[i][el.dataset.field] = el.value;
      });
    });
    list.appendChild(item);
  });
}

// ─────────────────────────────────────────────
// Education Builder
// ─────────────────────────────────────────────
function renderEducationList() {
  const list = document.getElementById('education-list');
  list.innerHTML = '';
  currentEducation.forEach((edu, i) => {
    const item = document.createElement('div');
    item.className = 'exp-item';
    item.innerHTML = `
      <div class="exp-item-header">
        <div class="exp-item-title">Education ${i + 1}</div>
        <button class="btn btn-danger btn-sm" data-i="${i}">Remove</button>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Degree</label>
          <input class="form-input" value="${escapeHTML(edu.degree || '')}" placeholder="B.S. Computer Science" data-field="degree" data-i="${i}" /></div>
        <div class="form-group"><label class="form-label">Institution</label>
          <input class="form-input" value="${escapeHTML(edu.institution || '')}" placeholder="MIT" data-field="institution" data-i="${i}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Year</label>
          <input class="form-input" value="${escapeHTML(edu.year || '')}" placeholder="2020" data-field="year" data-i="${i}" /></div>
        <div class="form-group"><label class="form-label">GPA (optional)</label>
          <input class="form-input" value="${escapeHTML(edu.gpa || '')}" placeholder="3.8/4.0" data-field="gpa" data-i="${i}" /></div>
      </div>
    `;
    item.querySelector('button[data-i]').addEventListener('click', () => {
      currentEducation.splice(i, 1);
      renderEducationList();
    });
    item.querySelectorAll('[data-field]').forEach(el => {
      el.addEventListener('input', () => {
        currentEducation[i][el.dataset.field] = el.value;
      });
    });
    list.appendChild(item);
  });
}

function renderCustomFieldsList() {
  const container = document.getElementById('custom-fields-list');
  const section = document.getElementById('custom-fields-section');
  if (!container || !section) return;

  const keys = Object.keys(currentCustomFields);
  if (keys.length === 0) {
    section.style.display = 'none';
    return;
  }
  
  section.style.display = 'block';
  container.innerHTML = '';
  
  keys.forEach(key => {
    const el = document.createElement('div');
    el.className = 'list-item';
    el.innerHTML = `
      <div class="list-item-content">
        <div class="list-item-title">${escapeHTML(key)}</div>
        <div class="list-item-sub">${escapeHTML(currentCustomFields[key])}</div>
      </div>
      <div class="list-item-actions">
        <button class="icon-btn del-btn" title="Delete">🗑️</button>
      </div>
    `;
    el.querySelector('.del-btn').addEventListener('click', () => {
      delete currentCustomFields[key];
      renderCustomFieldsList();
    });
    container.appendChild(el);
  });
}

// ─────────────────────────────────────────────
// PDF Resume Upload & Extraction
// ─────────────────────────────────────────────
function clearResume() {
  currentResumeText = '';
  currentResumeFileName = '';
  currentResumeBase64 = '';
  document.getElementById('upload-result').style.display = 'none';
  document.getElementById('resume-preview-wrap').style.display = 'none';
  document.getElementById('resume-file-input').value = '';
}

async function extractPdfText(file) {
  return new Promise(async (resolve, reject) => {
    const arrayBuffer = await file.arrayBuffer();
    try {
      // Set worker source
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + '\n';
      }
      resolve({ text: text.trim(), pages: pdf.numPages });
    } catch (e) {
      reject(e);
    }
  });
}

function initResumeUpload() {
  const zone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('resume-file-input');

  zone.addEventListener('click', () => fileInput.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') handleResumeFile(file);
    else showToast('Please upload a PDF file.', 'error');
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleResumeFile(file);
  });
}

async function handleResumeFile(file) {
  const extractingEl = document.getElementById('resume-extracting');
  const resultEl = document.getElementById('upload-result');
  const previewWrap = document.getElementById('resume-preview-wrap');
  const previewEl = document.getElementById('resume-text-preview');

  extractingEl.style.display = 'flex';
  resultEl.style.display = 'none';
  previewWrap.style.display = 'none';

  try {
    const { text, pages } = await extractPdfText(file);
    
    // Convert to Base64 for auto-upload feature
    const base64Str = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });

    currentResumeText = text;
    currentResumeFileName = file.name;
    currentResumeBase64 = base64Str;

    extractingEl.style.display = 'none';
    resultEl.style.display = 'block';
    resultEl.innerHTML = `
      <div class="upload-success">
        <span class="file-icon">📄</span>
        <div class="file-info">
          <div class="file-name">${escapeHTML(file.name)}</div>
          <div class="file-pages">${pages} page${pages > 1 ? 's' : ''} • ${Math.round(text.length / 5)} words extracted</div>
        </div>
        <button class="btn btn-danger btn-sm" id="remove-resume-btn">Remove</button>
      </div>`;
    document.getElementById('remove-resume-btn').addEventListener('click', clearResume);

    previewEl.textContent = text.substring(0, 600) + (text.length > 600 ? '...' : '');
    previewWrap.style.display = 'block';
    showToast('Resume text extracted successfully!');
  } catch (e) {
    extractingEl.style.display = 'none';
    showToast('Failed to read PDF. Make sure it\'s a valid, non-encrypted PDF.', 'error');
    console.error('[JobAssist] PDF extraction error:', e);
  }
}

// ─────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────
async function initSettings() {
  const settings = await Storage.getSettings();
  document.getElementById('api-key-input').value = settings.apiKey || '';
  document.getElementById('model-select').value = settings.model || 'gpt-4o-mini';

  document.getElementById('toggle-key-btn').addEventListener('click', () => {
    const input = document.getElementById('api-key-input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('save-settings-btn').addEventListener('click', async () => {
    const apiKey = document.getElementById('api-key-input').value.trim();
    const model = document.getElementById('model-select').value;
    await Storage.saveSettings({ apiKey, model });
    showToast('Settings saved!');
  });

  document.getElementById('test-api-btn').addEventListener('click', async () => {
    const apiKey = document.getElementById('api-key-input').value.trim();
    const resultEl = document.getElementById('api-test-result');
    if (!apiKey) { resultEl.textContent = '⚠ No API key entered'; resultEl.style.color = '#FBBF24'; return; }
    resultEl.textContent = 'Testing...';
    resultEl.style.color = '#9898B3';
    try {
      const resp = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (resp.ok) {
        resultEl.textContent = '✅ Connected!';
        resultEl.style.color = '#34D399';
      } else {
        resultEl.textContent = '❌ Invalid key';
        resultEl.style.color = '#F87171';
      }
    } catch {
      resultEl.textContent = '❌ Network error';
      resultEl.style.color = '#F87171';
    }
  });

  document.getElementById('export-data-btn').addEventListener('click', async () => {
    const profiles = await Storage.getProfiles();
    const settings = await Storage.getSettings();
    const data = { profiles, settings: { ...settings, apiKey: '***REDACTED***' } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'jobassist-pro-data.json';
    a.click(); URL.revokeObjectURL(url);
    showToast('Data exported!');
  });

  document.getElementById('clear-data-btn').addEventListener('click', async () => {
    if (confirm('Are you sure? This will delete ALL profiles and settings. This cannot be undone.')) {
      await chrome.storage.local.clear();
      await renderProfiles();
      document.getElementById('api-key-input').value = '';
      showToast('All data cleared.', 'info');
    }
  });
}

// ─────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initNavigation();
  await renderProfiles();
  await initSettings();
  initResumeUpload();

  // Panel open/close
  document.getElementById('new-profile-btn').addEventListener('click', () => openProfilePanel());
  document.getElementById('new-profile-btn-empty').addEventListener('click', () => openProfilePanel());
  document.getElementById('close-panel-btn').addEventListener('click', closeProfilePanel);
  document.getElementById('save-profile-btn').addEventListener('click', saveProfile);

  // Import profile
  const importInput = document.getElementById('import-profile-input');
  document.getElementById('import-profile-btn').addEventListener('click', () => {
    importInput.click();
  });
  
  importInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const profileData = JSON.parse(text);
      
      // Basic validation
      if (!profileData.name || !profileData.personalInfo) {
        throw new Error("Invalid profile structure");
      }
      
      // Generate new ID to avoid collisions
      profileData.id = generateId();
      profileData.createdAt = new Date().toISOString();
      
      const profiles = await Storage.getProfiles();
      profiles.push(profileData);
      await Storage.saveProfiles(profiles);
      
      await renderProfiles();
      showToast(`Profile "${profileData.name}" imported successfully!`);
    } catch (err) {
      showToast('Failed to import profile. Make sure it is a valid JobAssist JSON file.', 'error');
      console.error(err);
    } finally {
      e.target.value = ''; // Reset input
    }
  });

  // Click outside to close
  document.getElementById('profile-panel-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('profile-panel-overlay')) closeProfilePanel();
  });

  // Skills input
  const skillsInput = document.getElementById('skills-input');
  skillsInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill(skillsInput.value);
      skillsInput.value = '';
    } else if (e.key === 'Backspace' && skillsInput.value === '' && currentSkills.length > 0) {
      currentSkills.pop();
      renderSkillTags();
    }
  });
  skillsInput.addEventListener('blur', () => {
    if (skillsInput.value.trim()) {
      addSkill(skillsInput.value);
      skillsInput.value = '';
    }
  });

  // Add experience
  document.getElementById('add-exp-btn').addEventListener('click', () => {
    currentExperience.push({ title: '', company: '', startDate: '', endDate: '', description: '' });
    renderExperienceList();
    document.getElementById('experience-list').lastChild?.scrollIntoView({ behavior: 'smooth' });
  });

  // Add education
  document.getElementById('add-edu-btn').addEventListener('click', () => {
    currentEducation.push({ degree: '', institution: '', year: '', gpa: '' });
    renderEducationList();
    document.getElementById('education-list').lastChild?.scrollIntoView({ behavior: 'smooth' });
  });
});
