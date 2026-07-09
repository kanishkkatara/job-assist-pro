# 🚀 JobAssist Pro — Chrome Extension

An AI-powered Chrome extension that helps you apply to jobs faster. Manage multiple job profiles, capture job descriptions as context, auto-fill application forms, generate cover letters, and get AI-suggested answers to application questions.

---

## 📦 Installation (Developer Mode)

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right)
3. Click **Load unpacked**
4. Select the `job-assist-pro/` folder
5. The 🚀 JobAssist Pro icon will appear in your toolbar

---

## 🗂 Project Structure

```
job-assist-pro/
├── manifest.json              # Chrome MV3 manifest
├── background/
│   └── service-worker.js      # Message router
├── dashboard/
│   ├── dashboard.html         # Full-page profile manager
│   ├── dashboard.js
│   └── dashboard.css
├── popup/
│   ├── popup.html             # Extension popup (380px)
│   ├── popup.js
│   └── popup.css
├── content/
│   └── content.js             # Page content script
├── lib/
│   ├── pdf.min.js             # PDF.js for resume parsing
│   └── pdf.worker.min.js
├── assets/
│   └── icons/                 # 16, 32, 48, 128px icons
└── utils/
    └── storage.js             # Chrome storage utilities
```

---

## 🔑 Features

### Dashboard (Right-click extension icon → Options, or click ⚙️ in popup)
- **Profile Management**: Create profiles for different job roles (FDE, TPM, SWE, etc.)
- **Resume Upload**: Upload PDF resumes — text is extracted automatically via PDF.js
- **Structured Data**: Personal info, work experience, skills, education per profile
- **Settings**: Add your OpenAI API key for AI-powered responses
- **Data Export**: Export all profiles to JSON

### Extension Popup
- **Profile Selector**: Switch between job profiles
- **📋 Capture JD**: Extracts job description from the current tab as context
- **⚡ Auto-fill Form**: Fills name, email, phone, LinkedIn, GitHub, and other standard fields
- **💬 Answer Questions**: Detects open-ended questions and generates answers
- **📝 Generate Cover Letter**: AI-crafted cover letter using your profile + JD context

---

## 🤖 AI Configuration

The extension works in two modes:

| Mode | Behavior |
|------|----------|
| **No API key** | Template-based cover letters and rule-based answers (works offline) |
| **With OpenAI API key** | AI-powered cover letters and question answers using GPT-4o-mini or GPT-4o |

**To add your API key:**
1. Open the Dashboard (⚙️ button in popup)
2. Go to **Settings**
3. Enter your OpenAI API key (`sk-...`)
4. Click **Save Settings**

Your API key is stored locally in Chrome's storage and never leaves your browser.

---

## 🧪 How to Use

### Step 1 — Create Profiles
- Open the Dashboard and click **New Profile**
- Fill in your details for the target role (e.g., "FDE Role")
- Upload your tailored resume PDF
- Add work experience, skills, and education
- Save the profile

### Step 2 — Capture a Job Description
- Navigate to any job listing (LinkedIn, Greenhouse, Lever, Workday, etc.)
- Click the 🚀 icon in your toolbar
- Click **Capture Job Description** — the JD is saved as context

### Step 3 — Apply with AI Assist
- Navigate to the application form
- Click the 🚀 icon and select your profile
- Click **Auto-fill Form** to fill standard fields instantly
- Click **Answer Questions** to get AI-generated answers for open questions
- Click **Generate Cover Letter** for a tailored cover letter

---

## 🔧 Permissions Explained

| Permission | Why |
|-----------|-----|
| `storage` | Store profiles, settings, and JD context locally |
| `tabs` | Know which tab is active |
| `activeTab` | Read the current page's content for JD extraction |
| `scripting` | Inject the content script for form filling |
| `<all_urls>` | Work on any job platform (LinkedIn, Greenhouse, etc.) |

---

## 🛠 Development Notes

- **Chrome MV3**: Uses service workers (no persistent background page)
- **PDF Parsing**: PDF.js v3.11 bundled locally for offline use
- **Form Filling**: Dispatches native `input`/`change`/`blur` events for React/Angular form compatibility
- **Session Storage**: Captured JD is stored in `chrome.storage.session` (cleared when browser closes)

---

## 📋 Roadmap (v2)

- [ ] Auto-detect job sites and suggest profile
- [ ] Application tracking (save applied jobs)
- [ ] LinkedIn Easy Apply automation
- [ ] Custom prompt templates per profile
- [ ] Chrome side panel integration
