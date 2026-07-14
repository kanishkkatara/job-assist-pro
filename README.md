# 🚀 JobAssist Pro — Next-Gen AI Career Copilot

![JobAssist Pro Header](/assets/icons/icon128.png)

JobAssist Pro is an **advanced, fully-autonomous AI Chrome Extension** built to hyper-accelerate the modern job search. It seamlessly integrates a state-of-the-art **React Kanban dashboard**, an **in-browser dynamic PDF resume generator**, **true 1-click SPA form automation**, and a **Live Interview Copilot** powered by WebAssembly (WASM).

This is not a simple wrapper. It is a comprehensive, production-grade AI agent system engineered specifically for the browser environment.

---

## 🔥 Visionary Features

### 1. 🎙️ Live Interview Copilot (Offscreen WASM)
Practice makes perfect, but real-time guidance wins the offer.
- **Real-Time Transcription**: Bypasses strict Manifest V3 background script limits by leveraging the **Offscreen Document API** and `chrome.tabCapture` to extract 16kHz PCM audio directly from your Google Meet or Zoom tab.
- **100% Local Privacy**: Runs Xenova's `@xenova/transformers` (Whisper-tiny.en) directly inside a Web Worker compiled to WebAssembly. Zero audio data is sent to the cloud.
- **Glassmorphic Teleprompter**: A Shadow DOM overlay injects seamlessly into your active tab. As the interviewer speaks, the rolling context buffer triggers the AI to generate instant, tailored **STAR story bullet-points** based on your active profile.

### 2. 📄 Dynamic ATS Resume Generator (`@react-pdf/renderer`)
Don't just detect missing keywords—fix them instantly.
- **Client-Side PDF Generation**: Generates beautiful, declarative React PDFs entirely in the browser (via highly optimized Vite polyfills). 
- **100% ATS Friendly**: Unlike `html2canvas` hacks, JobAssist Pro generates genuine text-layered PDFs that parse flawlessly in Greenhouse, Workday, and Lever.
- **1-Click Tailoring**: Instantly spins up a customized resume tailored to the active Job Description in your Kanban tracker.

### 3. ⚡ True 1-Click Apply Automation
A robotic form filler that actually works on modern SPAs.
- **Prototype Hijacking**: Defeats complex React/Angular controlled inputs by intercepting native `HTMLInputElement.prototype.set` getters/setters.
- **Automated Resume Attachment**: Employs the `DataTransfer` API to programmatically convert your dynamic PDF Blobs into native `File` objects, auto-attaching them to `<input type="file">` elements.
- **Shadow DOM Defiance**: Recursively drills into modern UI component libraries to find the exact fields to fill.

### 4. 🗂️ The Job-Centric Hub (Kanban)
A beautiful, responsive workspace built with TailwindCSS and `react-beautiful-dnd`.
- **Intelligent Tracking**: Move captured jobs seamlessly from 'Discovered' to 'Offer'.
- **Deep Integration**: Click any job card to slide open the Job Details panel where you can run ATS Matches, Mock Interviews, and Resume Generations in context.

---

## 📦 Installation & Setup

### 1. Start the Local Proxy Server
We use a lightweight local Express proxy to securely manage your OpenAI API keys and prevent brutal CORS blocks from modern Applicant Tracking Systems.
```bash
cd server
npm install
node index.js
```

### 2. Build the Extension
The project is built on **Vite**, configured heavily for Manifest V3, Web Workers, and Node polyfills.
```bash
npm install
npm run build
```

### 3. Load into Chrome
1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right)
3. Click **Load unpacked**
4. Select the `dist/` folder
5. The 🚀 JobAssist Pro icon will appear in your toolbar!

---

## 🛠️ Tech Stack & Architecture

- **Extension Core**: Manifest V3, Service Workers, Offscreen Documents, `chrome.tabCapture`
- **Frontend UI**: React 18, Vite, TailwindCSS, `react-hot-toast`
- **AI & ML**: OpenAI API (`gpt-4o-mini`), Xenova Transformers (WASM Whisper-tiny.en)
- **Document Generation**: `@react-pdf/renderer` (Polyfilled for Client-Side execution)
- **State & Storage**: IndexedDB (`idb`), Chrome Local/Session Storage

---

## 🧪 Quick Start Guide

### Step 1 — Create Your Profile
Open the Dashboard and click **+ New Profile**. Fill in your core details and upload your master resume. You can maintain multiple personas (e.g. Frontend Engineer, Product Manager).

### Step 2 — Capture a Job Description
Navigate to any job listing on LinkedIn, Greenhouse, etc. Click the 🚀 extension icon and select **Capture Job Description**. It's instantly parsed and added to your Kanban board.

### Step 3 — Tailor & Apply
Open your Kanban board and click the newly captured job. Run the **ATS Matcher**. Click **Generate Tailored Resume** to instantly download an optimized PDF. Head to the application page, open the popup, and hit **⚡ Auto-fill Form**.

### Step 4 — Ace the Interview
Once you secure the interview, move the card to the 'Interviewing' column. Use the **STAR Mock Interview** tool to practice out loud. During the real interview, trigger the **🎙️ Live Interview Copilot** from the popup to get real-time teleprompter hints injected securely into your tab.

---

*Engineered for builders who want to move fast and win.*
