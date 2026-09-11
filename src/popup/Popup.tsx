import React, { useState, useRef, useEffect } from 'react';
import { useStorageLocal, useStorageSession } from '../hooks/useStorage';
import { addApplication } from '../utils/db';
import { getAIHeaders } from '../utils/api';
import {
  Settings, LayoutDashboard, Briefcase, Zap, MessageSquare,
  FileText, Mic, CheckCircle2, AlertCircle, XCircle, Send,
  RefreshCw, ChevronDown, ChevronUp, Plus, Sparkles
} from 'lucide-react';
import '../index.css';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  fieldContext?: string; // which field this is about
  isRefining?: boolean;
}

// ─── Popup ─────────────────────────────────────────────────────────────────────
export function Popup() {
  const [profiles] = useStorageLocal<any[]>('profiles', []);
  const [activeProfileId, setActiveProfileId] = useStorageLocal<string | null>('activeProfileId', null);
  const [settings] = useStorageLocal<any>('settings', { apiKey: '', model: 'gpt-4o-mini' });
  const [jd, setJd] = useStorageSession<any>('currentJD', null);

  const [loading, setLoading] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [generatedLetter, setGeneratedLetter] = useState<string | null>(null);

  // AI Chat / Q&A panel
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Last fill result for refinement
  const [lastFillResult, setLastFillResult] = useState<{
    fields: any[];
    answers: Record<string, string>;
  } | null>(null);
  const [refineMode, setRefineMode] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string>('');
  const [refineFeedback, setRefineFeedback] = useState('');
  const [refineLoading, setRefineLoading] = useState(false);

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const showBanner = (type: 'success' | 'error', msg: string) => {
    setBanner({ type, msg });
    setTimeout(() => setBanner(null), 4000);
  };

  const sendToContent = async (payload: any) => {
    return new Promise<any>((resolve) => {
      chrome.runtime.sendMessage({ type: 'RELAY_TO_CONTENT', payload }, (response) => {
        if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
        else resolve(response || {});
      });
    });
  };

  const handleCaptureJD = async () => {
    setLoading('capture');
    try {
      const res = await sendToContent({ type: 'EXTRACT_JD' });
      if (res.error) throw new Error(res.error);
      if (res.jd) {
        setJd(res.jd);
        await addApplication({
          id: res.jd.url || Date.now().toString(),
          title: res.jd.title || 'Unknown Title',
          company: res.jd.company || 'Unknown Company',
          url: res.jd.url || '',
          status: 'Discovered',
          jdText: res.jd.text || '',
          capturedAt: Date.now()
        });
        showBanner('success', `JD captured: ${res.jd.title}`);
      }
    } catch (e) {
      showBanner('error', 'Could not capture JD on this page.');
    }
    setLoading(null);
  };

  const handleOpenDashboard = () => chrome.runtime.openOptionsPage();

  const handleGenerateCoverLetter = async () => {
    setLoading('coverLetter');
    try {
      showBanner('success', 'Generating cover letter...');
      const { resumeBase64, ...profileData } = activeProfile;
      const prompt = `Write a professional cover letter for the following job description based on my profile.
${profileData.systemPrompt ? `\nCRITICAL INSTRUCTIONS (MUST FOLLOW STRICTLY):\n${profileData.systemPrompt}\n` : ''}
Profile:
${JSON.stringify({ ...profileData, systemPrompt: undefined, resumeBase64: undefined })}

Job Description:
${jd?.text}

Task: Cross-reference the profile against the Job Description to deeply deduce technical overlap. Do not just regurgitate the profile; analyze what the JD actually needs and highlight the most relevant implicit or explicit experiences. Keep it highly tailored. Just return the letter text.`;

      const response = await fetch('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: getAIHeaders(settings),
        body: JSON.stringify({ model: settings.model || 'gpt-4o-mini', prompt })
      });

      if (!response.ok) throw new Error('Failed to generate cover letter');
      const data = await response.json();
      setGeneratedLetter(data.text);
      try {
        await navigator.clipboard.writeText(data.text);
        showBanner('success', 'Cover letter generated and copied! 📋');
      } catch {
        showBanner('success', 'Cover letter generated!');
      }
    } catch (e: any) {
      showBanner('error', e.message || 'Failed to generate cover letter');
    }
    setLoading(null);
  };

  // ── Smart Auto-fill (4-phase) ─────────────────────────────────────────────
  const handleAutoFill = async () => {
    setLoading('autofill');
    setLastFillResult(null);
    setRefineMode(false);
    try {
      const { getApplications } = await import('../utils/db');
      const apps = await getApplications();
      const job = apps.find((a: any) => a.id === jd?.id);
      const resumeToAttach = job?.tailoredResumeBase64 || activeProfile.resumeBase64;

      if (resumeToAttach) {
        await sendToContent({
          type: 'ATTACH_RESUME',
          base64Pdf: resumeToAttach,
          filename: job?.tailoredResumeBase64 ? `Tailored_Resume_${jd.company}.pdf` : 'Resume.pdf'
        });
      }

      showBanner('success', '🔍 Scanning form fields...');
      const scanRes = await sendToContent({ type: 'SCAN_FIELDS' });
      if (scanRes.error) throw new Error(scanRes.error);
      const fields = scanRes.fields || [];

      if (fields.length === 0) {
        showBanner('error', 'No fillable fields detected on this page.');
        setLoading(null);
        return;
      }

      showBanner('success', `🤖 AI is filling ${fields.length} fields...`);
      const { resumeBase64, ...profileData } = activeProfile;

      const fieldList = fields.map((f: any) => {
        let desc = `[${f.id}] ${f.label} (type: ${f.type})`;
        if (f.options && f.options.length > 0) desc += ` — Available options: ${f.options.join(', ')}`;
        return desc;
      }).join('\n');

      const prompt = `You are an expert job application assistant. Fill out this form accurately.
${profileData.systemPrompt ? `\nCRITICAL TONE & INSTRUCTIONS:\n${profileData.systemPrompt}\n` : ''}
Candidate Profile:
${JSON.stringify({ ...profileData, systemPrompt: undefined, resumeBase64: undefined }, null, 2)}

Job Description:
${jd?.text || 'Not available'}

Form Fields:
${fieldList}

Rules:
- For 'select' and 'radio' types, pick EXACTLY one of the listed options as written.
- For 'checkbox': respond 'yes' to check or 'no' to leave unchecked.
- For 'text'/'textarea': provide a concise, relevant answer.
- For 'combobox': pick the closest matching option text.
- For salutation: infer from the candidate's name.
- Use "skip" only for truly irrelevant fields (e.g. CAPTCHA).
- Do NOT leave any field blank.

Respond with ONLY a raw JSON object. Keys = field IDs, values = answers. No markdown.`;

      const aiRes = await fetch('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: getAIHeaders(settings),
        body: JSON.stringify({ model: settings.model || 'gpt-4o-mini', prompt })
      });

      if (!aiRes.ok) throw new Error('AI server returned ' + aiRes.status);
      const data = await aiRes.json();

      let answers: Record<string, string> = {};
      try {
        const jsonStr = data.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        answers = JSON.parse(jsonStr);
      } catch {
        throw new Error('AI returned an invalid format. Please try again.');
      }

      const applyRes = await sendToContent({ type: 'APPLY_ANSWERS', answers });
      if (applyRes.error) throw new Error(applyRes.error);

      // Store result for refinement
      setLastFillResult({ fields, answers });
      showBanner('success', `✨ ${applyRes.filled || 0} of ${fields.length} fields filled!`);
    } catch (e: any) {
      showBanner('error', e.message);
    }
    setLoading(null);
  };

  // ── Refine a single answer ────────────────────────────────────────────────
  const handleRefineAnswer = async () => {
    if (!selectedFieldId || !refineFeedback.trim() || !lastFillResult) return;
    setRefineLoading(true);

    try {
      const field = lastFillResult.fields.find((f: any) => f.id === selectedFieldId);
      if (!field) throw new Error('Field not found');

      const currentAnswer = lastFillResult.answers[selectedFieldId] || '(empty)';
      const { resumeBase64, ...profileData } = activeProfile;

      const prompt = `You are refining a specific form field answer based on user feedback.

Field Label: "${field.label}"
Field Type: ${field.type}
${field.options?.length ? `Available options: ${field.options.join(', ')}` : ''}

Current Answer: "${currentAnswer}"
User Feedback: "${refineFeedback}"

Candidate Profile:
${JSON.stringify({ ...profileData, systemPrompt: undefined, resumeBase64: undefined }, null, 2)}

Job Description:
${jd?.text || 'Not available'}

Task: Revise the answer based on the feedback. ${field.options?.length ? 'You MUST pick exactly one of the listed options.' : 'Keep it concise and relevant.'}
Respond with ONLY the new answer text. No explanation, no JSON, no markdown.`;

      const aiRes = await fetch('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: getAIHeaders(settings),
        body: JSON.stringify({ model: settings.model || 'gpt-4o-mini', prompt })
      });

      if (!aiRes.ok) throw new Error('AI request failed');
      const data = await aiRes.json();
      const newAnswer = (data.text || '').trim().replace(/```/g, '').trim();

      // Apply the refined answer
      const applyRes = await sendToContent({
        type: 'APPLY_ANSWERS',
        answers: { [selectedFieldId]: newAnswer }
      });

      // Update stored answers
      setLastFillResult(prev => prev ? {
        ...prev,
        answers: { ...prev.answers, [selectedFieldId]: newAnswer }
      } : null);

      setRefineFeedback('');
      showBanner('success', `✅ Answer refined: "${newAnswer.substring(0, 40)}${newAnswer.length > 40 ? '...' : ''}"`);
    } catch (e: any) {
      showBanner('error', e.message);
    }
    setRefineLoading(false);
  };

  // ── AI Chat for custom Q&A ────────────────────────────────────────────────
  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);

    try {
      const { resumeBase64, ...profileData } = activeProfile || {};
      const systemCtx = `You are an expert career assistant helping a candidate fill job application forms.
${profileData?.systemPrompt ? `\nTone & Style: ${profileData.systemPrompt}\n` : ''}
Candidate Profile: ${JSON.stringify({ ...profileData, systemPrompt: undefined, resumeBase64: undefined })}
Job: ${jd?.title || 'Unknown'} at ${jd?.company || 'Unknown'}
JD: ${(jd?.text || '').substring(0, 2000)}

The user may ask you to:
1. Answer a specific application question they missed
2. Rewrite or improve an answer
3. Ask career advice
Keep answers concise, professional, and tailored to the profile and JD.`;

      const conversationHistory = chatMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: getAIHeaders(settings),
        body: JSON.stringify({
          model: settings.model || 'gpt-4o-mini',
          prompt: `${systemCtx}\n\n---\nConversation so far:\n${conversationHistory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}\n\nUser: ${userMsg}\n\nAssistant:`
        })
      });

      if (!response.ok) throw new Error('AI request failed');
      const data = await response.json();
      const aiAnswer = (data.text || '').trim();

      setChatMessages(prev => [...prev, { role: 'assistant', content: aiAnswer }]);
    } catch (e: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Error: ${e.message}` }]);
    }
    setChatLoading(false);
  };

  // ── Answer Qs (legacy: scan open questions and answer them) ──────────────
  const handleAnswerQs = async () => {
    setLoading('answerQs');
    try {
      showBanner('success', '🔍 Scanning for unanswered questions...');
      const scanRes = await sendToContent({ type: 'SCAN_FIELDS' });
      if (scanRes.error) throw new Error(scanRes.error);
      const fields = scanRes.fields || [];

      if (fields.length === 0) {
        showBanner('error', 'No fields detected. Try Smart Auto-fill first.');
        setLoading(null);
        return;
      }

      const { resumeBase64, ...profileData } = activeProfile;
      const fieldList = fields.map((f: any) => {
        let desc = `[${f.id}] ${f.label} (type: ${f.type})`;
        if (f.options?.length) desc += ` — Options: ${f.options.join(', ')}`;
        return desc;
      }).join('\n');

      const prompt = `You are an expert career assistant. Answer all these application form fields based on the candidate profile.
${profileData.systemPrompt ? `\nTone: ${profileData.systemPrompt}\n` : ''}
Profile: ${JSON.stringify({ ...profileData, systemPrompt: undefined, resumeBase64: undefined }, null, 2)}
JD: ${jd?.text || 'Not available'}

Fields:
${fieldList}

Rules: For select/radio pick exact option. For text/textarea give concise answers. Use "skip" only if completely irrelevant.
Return ONLY raw JSON {"field_id": "answer"}. No markdown.`;

      const aiRes = await fetch('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: getAIHeaders(settings),
        body: JSON.stringify({ model: settings.model || 'gpt-4o-mini', prompt })
      });

      if (!aiRes.ok) throw new Error('AI failed');
      const data = await aiRes.json();

      let answers: Record<string, string> = {};
      try {
        answers = JSON.parse(data.text.replace(/```json/gi, '').replace(/```/g, '').trim());
      } catch { answers = {}; }

      const fillRes = await sendToContent({ type: 'APPLY_ANSWERS', answers });
      setLastFillResult({ fields, answers });
      showBanner('success', `✨ ${fillRes.filled || 0} questions answered!`);
    } catch (e: any) {
      showBanner('error', e.message);
    }
    setLoading(null);
  };

  return (
    <div className="w-[380px] bg-slate-50 text-slate-900 font-sans shadow-xl overflow-hidden flex flex-col" style={{ height: chatOpen ? '680px' : '560px', transition: 'height 0.25s ease' }}>
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm text-neutral-900 border-b border-gray-200 px-4 py-3 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-2">
          <Briefcase size={20} className="text-neutral-500" />
          <h2 className="m-0 text-lg font-bold tracking-tight">JobAssist Pro</h2>
        </div>
        <button onClick={handleOpenDashboard} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-neutral-900" title="Open Dashboard">
          <LayoutDashboard size={18} />
        </button>
      </header>

      {/* Main Scrollable Area */}
      <div className="flex-1 overflow-y-auto flex flex-col min-h-0">

        {/* Banner */}
        {banner && (
          <div role="alert" aria-live="assertive" className={`mx-4 mt-3 px-4 py-2.5 rounded-xl flex items-start gap-2.5 text-sm font-medium shadow-sm border flex-shrink-0 ${
            banner.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            {banner.type === 'success' ? <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-500" /> : <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-500" />}
            <p className="leading-tight">{banner.msg}</p>
          </div>
        )}

        {/* Cover Letter */}
        {generatedLetter && (
          <div className="mx-4 mt-3 p-4 bg-white rounded-xl shadow-sm border border-indigo-100 relative flex-shrink-0">
            <button onClick={() => setGeneratedLetter(null)} className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors">
              <XCircle size={15} />
            </button>
            <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-1.5"><FileText size={13} />Your Cover Letter</h4>
            <div className="text-sm text-slate-700 whitespace-pre-wrap max-h-40 overflow-y-auto select-all">{generatedLetter}</div>
            <button onClick={() => { navigator.clipboard.writeText(generatedLetter); showBanner('success', 'Copied!'); }}
              className="mt-2 w-full py-1.5 bg-indigo-50 text-indigo-700 font-medium text-xs rounded-lg hover:bg-indigo-100 transition-colors">
              Copy Again
            </button>
          </div>
        )}

        {/* Form content */}
        <div className="p-4 flex flex-col gap-3 flex-shrink-0">
          {/* Profile Selector */}
          <div className="relative bg-white rounded-lg shadow-sm border border-gray-200">
            <select
              value={activeProfileId || ''}
              onChange={(e) => setActiveProfileId(e.target.value)}
              className="w-full bg-transparent p-2.5 pr-10 text-sm font-medium text-slate-700 outline-none cursor-pointer appearance-none focus-visible:ring-2 focus-visible:ring-neutral-900 rounded-lg"
              aria-label="Select active profile"
            >
              <option value="" disabled>Select your active profile...</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>

          {!activeProfileId ? (
            <div className="flex flex-col items-center justify-center text-center p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="bg-slate-100 p-4 rounded-full mb-3"><Settings size={26} className="text-slate-400" /></div>
              <h3 className="text-slate-800 font-bold mb-1">No Active Profile</h3>
              <p className="text-slate-500 text-sm mb-4 leading-relaxed">Select or create a profile in the dashboard to start applying.</p>
              <button onClick={handleOpenDashboard} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all w-full">
                Go to Dashboard
              </button>
            </div>
          ) : (
            <>
              {/* JD Context */}
              <div className={`p-3.5 rounded-2xl border transition-all ${jd ? 'bg-white border-indigo-100 shadow-sm' : 'bg-slate-100/50 border-slate-200 border-dashed'}`}>
                <div className="flex justify-between items-start mb-2.5">
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Target Role</div>
                    <div className={`font-semibold text-sm ${jd ? 'text-slate-800 line-clamp-1' : 'text-slate-400 italic'}`}>
                      {jd ? `${jd.title}${jd.company ? ` · ${jd.company}` : ''}` : 'No job captured'}
                    </div>
                  </div>
                  {jd && (
                    <button onClick={() => setJd(null)} className="text-slate-400 hover:text-rose-500 transition-colors p-0.5" title="Clear Context">
                      <XCircle size={15} />
                    </button>
                  )}
                </div>
                <button
                  onClick={handleCaptureJD}
                  disabled={loading === 'capture'}
                  className={`w-full py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    jd ? 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 ring-1 ring-indigo-200'
                  }`}
                >
                  {loading === 'capture' ? <><span className="animate-pulse">Scanning Page...</span></> : <><Briefcase size={15} />{jd ? 'Recapture JD from Page' : 'Capture Job Description'}</>}
                </button>
              </div>

              <div className="h-px bg-slate-200 rounded-full" />

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                {/* Smart Auto-fill */}
                <button
                  disabled={!jd || loading === 'autofill'}
                  onClick={handleAutoFill}
                  className="group flex items-center justify-between p-3.5 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl transition-colors ${jd ? 'bg-amber-100 text-amber-600 group-hover:bg-amber-500 group-hover:text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <Zap size={18} className={loading === 'autofill' ? 'animate-pulse' : ''} />
                    </div>
                    <div>
                      <span className="font-semibold text-sm text-slate-700">{loading === 'autofill' ? 'Autofilling...' : 'Smart Auto-fill'}</span>
                      <p className="text-xs text-slate-400 mt-0.5">Fills all fields using AI</p>
                    </div>
                  </div>
                  {lastFillResult && <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-medium">Done</span>}
                </button>

                {/* Refine Panel — appears after a fill */}
                {lastFillResult && (
                  <div className="bg-white border border-indigo-100 rounded-xl shadow-sm overflow-hidden">
                    <button
                      onClick={() => setRefineMode(!refineMode)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-indigo-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-indigo-600">
                        <RefreshCw size={14} />
                        <span className="text-xs font-semibold">Refine an Answer with AI Feedback</span>
                      </div>
                      {refineMode ? <ChevronUp size={14} className="text-indigo-400" /> : <ChevronDown size={14} className="text-indigo-400" />}
                    </button>

                    {refineMode && (
                      <div className="px-3.5 pb-3.5 flex flex-col gap-2.5 border-t border-indigo-50">
                        {/* Field selector */}
                        <div className="mt-2.5">
                          <label className="text-xs font-semibold text-slate-500 mb-1 block">Select field to refine</label>
                          <select
                            value={selectedFieldId}
                            onChange={e => setSelectedFieldId(e.target.value)}
                            className="w-full text-sm p-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300"
                          >
                            <option value="">Choose a field...</option>
                            {lastFillResult.fields.map((f: any) => (
                              <option key={f.id} value={f.id}>
                                {f.label} {lastFillResult.answers[f.id] ? `→ "${lastFillResult.answers[f.id].substring(0, 25)}${lastFillResult.answers[f.id].length > 25 ? '…' : ''}"` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedFieldId && (
                          <div className="bg-indigo-50 rounded-lg px-3 py-2 text-xs text-indigo-700">
                            <span className="font-semibold">Current: </span>
                            {lastFillResult.answers[selectedFieldId] || '(empty)'}
                          </div>
                        )}

                        {/* Feedback input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={refineFeedback}
                            onChange={e => setRefineFeedback(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleRefineAnswer(); }}
                            placeholder={selectedFieldId ? 'e.g. "Make it more concise" or "Change to Mr."' : 'Select a field first...'}
                            disabled={!selectedFieldId}
                            className="flex-1 text-sm p-2 border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 placeholder:text-slate-400"
                          />
                          <button
                            onClick={handleRefineAnswer}
                            disabled={!selectedFieldId || !refineFeedback.trim() || refineLoading}
                            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                          >
                            {refineLoading ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom 2-col buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={!jd}
                    onClick={handleAnswerQs}
                    className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed group"
                  >
                    {loading === 'answerQs' ? (
                      <MessageSquare size={19} className="text-indigo-400 animate-pulse" />
                    ) : (
                      <MessageSquare size={19} className={`transition-colors ${jd ? 'text-indigo-400 group-hover:text-indigo-600' : 'text-slate-300'}`} />
                    )}
                    <span className="text-xs font-semibold text-slate-600">{loading === 'answerQs' ? 'Thinking...' : 'Answer Qs'}</span>
                  </button>

                  <button
                    disabled={!jd || loading === 'coverLetter'}
                    onClick={handleGenerateCoverLetter}
                    className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-teal-300 hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed group"
                  >
                    {loading === 'coverLetter' ? (
                      <FileText size={19} className="text-teal-500 animate-pulse" />
                    ) : (
                      <FileText size={19} className={`transition-colors ${jd ? 'text-teal-400 group-hover:text-teal-600' : 'text-slate-300'}`} />
                    )}
                    <span className="text-xs font-semibold text-slate-600">{loading === 'coverLetter' ? 'Drafting...' : 'Cover Letter'}</span>
                  </button>
                </div>

                {/* Copilot */}
                <button
                  onClick={() => {
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                      const tab = tabs[0];
                      if (!tab || !tab.id) return showBanner('error', 'No active tab');
                      // @ts-ignore
                      chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (streamId) => {
                        if (chrome.runtime.lastError) return showBanner('error', chrome.runtime.lastError.message || 'Cannot capture this tab');
                        if (!streamId) return showBanner('error', 'Requires tab audio permission');
                        chrome.runtime.sendMessage({ type: 'START_COPILOT', streamId }, (res) => {
                          if (res && res.success) showBanner('success', 'Copilot overlay activated');
                          else showBanner('error', 'Failed to start Live Copilot');
                        });
                      });
                    });
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-neutral-900 text-white hover:bg-neutral-800 shadow-sm px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  <Mic size={16} />
                  Live Interview Copilot
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── AI Chat Panel — Custom Q&A ────────────────────────────────────── */}
        {activeProfileId && (
          <div className="flex flex-col flex-1 border-t border-slate-200 bg-white min-h-0">
            {/* Chat header toggle */}
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors flex-shrink-0"
            >
              <div className="flex items-center gap-2 text-slate-700">
                <div className="p-1.5 bg-violet-100 rounded-lg">
                  <Sparkles size={14} className="text-violet-500" />
                </div>
                <div>
                  <span className="text-sm font-semibold">AI Assistant</span>
                  <p className="text-xs text-slate-400">Ask any question or get custom answers</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {chatMessages.length > 0 && (
                  <span className="text-xs bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full font-medium">{chatMessages.length}</span>
                )}
                {chatOpen ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronUp size={16} className="text-slate-400" />}
              </div>
            </button>

            {chatOpen && (
              <div className="flex flex-col min-h-0" style={{ height: '360px' }}>
                {/* Suggestion chips */}
                {chatMessages.length === 0 && (
                  <div className="px-4 pb-2 flex gap-1.5 flex-wrap flex-shrink-0">
                    {['Answer a missed question', 'Why am I a good fit?', 'Rephrase my answer'].map(chip => (
                      <button
                        key={chip}
                        onClick={() => { setChatInput(chip); chatInputRef.current?.focus(); }}
                        className="text-xs px-2.5 py-1 bg-violet-50 text-violet-600 rounded-full border border-violet-100 hover:bg-violet-100 transition-colors font-medium"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-2 min-h-0">
                  {chatMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                      <MessageSquare size={24} className="mb-2 text-slate-300" />
                      <p className="text-xs">Ask me to answer any application question,<br />refine an answer, or get career advice.</p>
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-sm'
                          : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                      }`}>
                        {msg.content}
                        {msg.role === 'assistant' && (
                          <button
                            onClick={() => navigator.clipboard.writeText(msg.content).then(() => showBanner('success', 'Copied!'))}
                            className="block mt-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            Copy
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-2.5 flex gap-1.5">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Input */}
                <div className="px-3 pb-3 pt-2 border-t border-slate-100 flex gap-2 flex-shrink-0">
                  <textarea
                    ref={chatInputRef}
                    rows={1}
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                    placeholder="Ask a question or type your query..."
                    className="flex-1 text-sm p-2 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-violet-300 resize-none placeholder:text-slate-400 leading-tight"
                    style={{ minHeight: '36px', maxHeight: '80px' }}
                  />
                  <button
                    onClick={handleSendChat}
                    disabled={!chatInput.trim() || chatLoading}
                    className="p-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 self-end"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-slate-100 border-t border-slate-200 px-4 py-2.5 flex justify-between items-center text-xs text-slate-500 font-medium flex-shrink-0">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          Connected
        </span>
        <span>{profiles.length} profiles</span>
      </footer>
    </div>
  );
}
