# 🚀 JobAssist Pro — Chrome Extension

An AI-powered Chrome extension that acts as your comprehensive career assistant. Manage multiple job profiles, capture job descriptions, track applications in a Kanban board, validate your resume against ATS systems, and prep for interviews with voice-dictated STAR mock sessions.

---

## 📦 Installation (Developer Mode)

### 1. Start the Local Proxy Server
The extension uses a local proxy server to securely handle your OpenAI API key and prevent CORS issues.
```bash
cd server
npm install
node index.js
```

### 2. Build the Extension
```bash
npm install
npm run build
```

### 3. Load into Chrome
1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right)
3. Click **Load unpacked**
4. Select the `dist/` folder
5. The 🚀 JobAssist Pro icon will appear in your toolbar

---

## 🗂 Project Structure

```text
job-assist-pro/
├── manifest.json              # Chrome MV3 manifest
├── background/
│   └── service-worker.ts      # Message router
├── server/
│   └── index.js               # Local Express proxy for secure API calls
├── src/
│   ├── components/            # React UI Components (Kanban, ATS, Interview)
│   ├── dashboard/             # Full-page Dashboard UI
│   ├── popup/                 # Extension popup UI
│   ├── utils/                 # IndexedDB storage and utilities
│   └── types/                 # TypeScript interfaces
├── content/
│   └── content.ts             # Page content script (Job scraping, form filling)
```

---

## 🔑 Features

### Dashboard (The Job-Centric Hub)
- **Application Tracker (Kanban)**: Track jobs through 'Discovered', 'Applying', 'Applied', 'Interviewing', and 'Offer'.
- **Job Detail Panel**: Click any job in the Kanban board to open the slide-out panel.
- **ATS Matcher**: Runs inside the job panel. Extracts text from your uploaded PDF resume and compares it to the job description, giving you a match score and missing keywords.
- **STAR Mock Interview**: Practice behavioral interviews for a specific job. Uses the **Web Speech API** so you can dictate your answers aloud. The AI grades you using the STAR method and provides an improved rewrite.
- **Profile Management**: Create profiles (FDE, TPM, SWE, etc.) and attach PDF resumes.

### Extension Popup
- **📋 Capture JD**: Extracts job description from the current tab and saves it to your Discovered column.
- **⚡ Auto-fill Form**: Fills standard application fields (name, email, phone, LinkedIn, etc.) using content scripts.
- **💬 Answer Questions**: Detects open-ended questions on applications and generates context-aware answers.

---

## 🤖 AI Configuration

The extension uses OpenAI to power the cover letters, question answering, ATS parsing, and mock interviews.

**To add your API key:**
1. Open the Dashboard
2. Go to **Settings**
3. Enter your OpenAI API key (`sk-...`)
4. Your API key is stored locally in Chrome's storage and sent securely to the local proxy server.

---

## 🧪 How to Use

### Step 1 — Create Profiles
- Open the Dashboard and click **+ New Profile**
- Fill in your details for the target role
- Upload your tailored resume PDF (text is automatically extracted for ATS matching)

### Step 2 — Capture a Job Description
- Navigate to any job listing (LinkedIn, Greenhouse, Lever, Workday, etc.)
- Click the 🚀 icon in your toolbar
- Click **Capture Job Description**

### Step 3 — Track & Prepare
- Open the Dashboard's **Application Tracker**.
- Click on the newly captured job to open the **Job Detail Panel**.
- Run the **ATS Matcher** to see if your resume fits the role.
- Move the job card to "Interviewing" and launch a **Mock Interview** to practice your STAR answers using voice dictation.

---

## 🔧 Technology Stack

- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **Design System**: "Premium Visionary" aesthetics (Glassmorphism, gradients, micro-animations)
- **Backend/Proxy**: Node.js, Express, Vercel AI SDK
- **Storage**: IndexedDB (for persistent job data), `chrome.storage.local` (for settings/profiles)
- **Extension APIs**: Manifest V3, Service Workers, Content Scripts, Side Panels

---

## 📋 Roadmap (v3)

- [ ] Auto-detect job sites and suggest profiles automatically
- [ ] LinkedIn Easy Apply complete automation
- [ ] Custom prompt templates per profile
- [ ] Interview transcript generation and sharing

