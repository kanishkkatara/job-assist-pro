import React, { useState } from 'react';
import { useStorageLocal, useStorageSession } from '../hooks/useStorage';
import { addApplication } from '../utils/db';
import { Settings, LayoutDashboard, Briefcase, Zap, MessageSquare, FileText, Mic, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import '../index.css'; // Ensure tailwind is imported

export function Popup() {
  const [profiles] = useStorageLocal<any[]>('profiles', []);
  const [activeProfileId, setActiveProfileId] = useStorageLocal<string | null>('activeProfileId', null);
  const [settings] = useStorageLocal<any>('settings', { apiKey: '', model: 'gpt-4o-mini' });
  const [jd, setJd] = useStorageSession<any>('currentJD', null);
  
  const [loading, setLoading] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [generatedLetter, setGeneratedLetter] = useState<string | null>(null);

  const activeProfile = profiles.find(p => p.id === activeProfileId);

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

  const handleOpenDashboard = () => {
    chrome.runtime.openOptionsPage();
  };

  const handleGenerateCoverLetter = async () => {
    setLoading('coverLetter');
    try {
      showBanner('success', 'Generating cover letter... (this takes a few seconds)');
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
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          prompt
        })
      });

      if (!response.ok) throw new Error('Failed to generate cover letter');
      const data = await response.json();

      setGeneratedLetter(data.text);
      try {
        await navigator.clipboard.writeText(data.text);
        showBanner('success', 'Cover letter generated and copied to clipboard! 📋');
      } catch (err) {
        showBanner('success', 'Cover letter generated! (Could not auto-copy to clipboard)');
      }
    } catch (e: any) {
      showBanner('error', e.message || 'Failed to generate cover letter');
    }
    setLoading(null);
  };

  return (
    <div className="w-[380px] bg-slate-50 text-slate-900 font-sans shadow-xl overflow-hidden flex flex-col h-[500px]">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm text-neutral-900 border-b border-gray-200 px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Briefcase size={20} className="text-neutral-500" />
          <h2 className="m-0 text-lg font-bold tracking-tight">JobAssist Pro</h2>
        </div>
        <button onClick={handleOpenDashboard} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-neutral-900" title="Open Dashboard">
          <LayoutDashboard size={18} />
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-5 pb-20 relative">
        {/* Banner Alert */}
        {banner && (
          <div role="alert" aria-live="assertive" className={`mb-4 px-4 py-3 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 text-sm font-medium shadow-sm border ${
            banner.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            {banner.type === 'success' ? <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-500" /> : <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-500" />}
            <p className="leading-tight">{banner.msg}</p>
          </div>
        )}

        {/* Generated Cover Letter Modal/Section */}
        {generatedLetter && (
          <div className="mb-5 p-4 bg-white rounded-xl shadow-sm border border-indigo-100 relative group animate-in fade-in zoom-in-95">
            <button 
              onClick={() => setGeneratedLetter(null)}
              className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              <XCircle size={16} />
            </button>
            <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <FileText size={14} />
              Your Cover Letter
            </h4>
            <div className="text-sm text-slate-700 whitespace-pre-wrap max-h-48 overflow-y-auto pr-2 custom-scrollbar select-all">
              {generatedLetter}
            </div>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(generatedLetter);
                showBanner('success', 'Copied to clipboard!');
              }}
              className="mt-3 w-full py-2 bg-indigo-50 text-indigo-700 font-medium text-xs rounded-lg hover:bg-indigo-100 transition-colors"
            >
              Copy Again
            </button>
          </div>
        )}

        {/* Profile Selector */}
        <div className="relative mb-5 bg-white p-1 rounded-lg shadow-sm border border-gray-200">
          <select 
            value={activeProfileId || ''} 
            onChange={(e) => setActiveProfileId(e.target.value)}
            className="w-full bg-transparent p-2.5 pr-10 text-sm font-medium text-slate-700 outline-none cursor-pointer appearance-none focus-visible:ring-2 focus-visible:ring-neutral-900 rounded-md"
            aria-label="Select active profile"
          >
            <option value="" disabled>Select your active profile...</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>

        {!activeProfileId ? (
          <div className="flex flex-col items-center justify-center text-center mt-10 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="bg-slate-100 p-4 rounded-full mb-4">
              <Settings size={28} className="text-slate-400" />
            </div>
            <h3 className="text-slate-800 font-bold mb-2">No Active Profile</h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">You need to select or create a profile in the dashboard to start applying.</p>
            <button 
              onClick={handleOpenDashboard}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all active:scale-[0.98] w-full"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 animate-in fade-in">
            {/* JD Context Panel */}
            <div className={`p-4 rounded-2xl border transition-all ${jd ? 'bg-white border-indigo-100 shadow-sm ring-1 ring-indigo-50' : 'bg-slate-100/50 border-slate-200 border-dashed'}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Target Role</div>
                  <div className={`font-semibold text-sm ${jd ? 'text-slate-800 line-clamp-2' : 'text-slate-400 italic'}`}>
                    {jd ? jd.title : 'No job captured'}
                  </div>
                </div>
                {jd && (
                  <button onClick={() => setJd(null)} className="text-slate-400 hover:text-rose-500 transition-colors p-1" title="Clear Context">
                    <XCircle size={16} />
                  </button>
                )}
              </div>
              
              <button 
                onClick={handleCaptureJD} 
                disabled={loading === 'capture'}
                className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  jd 
                    ? 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200' 
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 ring-1 ring-indigo-200 hover:ring-indigo-300'
                }`}
              >
                {loading === 'capture' ? (
                  <><span className="animate-pulse">Scanning Page...</span></>
                ) : (
                  <>
                    <Briefcase size={16} />
                    {jd ? 'Recapture JD from Page' : 'Capture Job Description'}
                  </>
                )}
              </button>
            </div>

            <div className="h-px bg-slate-200 my-1 w-full rounded-full"></div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5">
              <button 
                disabled={!jd || loading === 'autofill'} 
                onClick={async () => {
                  setLoading('autofill');
                  try {
                    const { getApplications } = await import('../utils/db');
                    const apps = await getApplications();
                    const job = apps.find(a => a.id === jd.id);
                    const resumeToAttach = job?.tailoredResumeBase64 || activeProfile.resumeBase64;
                    
                    if (resumeToAttach) {
                      await sendToContent({ 
                        type: 'ATTACH_RESUME', 
                        base64Pdf: resumeToAttach,
                        filename: job?.tailoredResumeBase64 ? `Tailored_Resume_${jd.company}.pdf` : 'Resume.pdf'
                      });
                    }
                    
                    const res = await sendToContent({ type: 'FILL_FORM', profile: activeProfile, jd });
                    if (res.error) throw new Error(res.error);

                    if (res.unansweredQuestions && res.unansweredQuestions.length > 0) {
                      showBanner('success', `AI is answering ${res.unansweredQuestions.length} custom questions...`);
                      const { resumeBase64, ...profileData } = activeProfile;
                      const prompt = `You are an expert career assistant. Answer the following job application questions based on the candidate's profile and the job description.
${profileData.systemPrompt ? `\nCRITICAL TONE & INSTRUCTIONS:\n${profileData.systemPrompt}\n` : ''}
Profile: ${JSON.stringify({ ...profileData, systemPrompt: undefined, resumeBase64: undefined })}

JD: ${jd?.text}

Task: Deeply analyze the JD and the Profile. For each question, synthesize the best answer by inferring how the candidate's background solves the JD's core problems. Keep answers extremely relevant and concise.

Questions:
${res.unansweredQuestions.map((q: any) => `- [${q.id}] ${q.question}`).join('\n')}

Respond with ONLY a raw JSON object where the keys are the exact question IDs in brackets above, and the values are the generated text answers. Do not include markdown code blocks like \`\`\`json.`;

                      const aiRes = await fetch('http://localhost:3000/api/generate', {
                        method: 'POST',
                        headers: { 
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${settings.apiKey}`
                        },
                        body: JSON.stringify({ model: 'gpt-4o-mini', prompt })
                      });
                      
                      if (!aiRes.ok) throw new Error('Failed to generate answers for custom questions');
                      const data = await aiRes.json();
                      
                      let answers;
                      try {
                        const jsonStr = data.text.replace(/```json/gi, '').replace(/```/g, '').trim();
                        answers = JSON.parse(jsonStr);
                      } catch(e) {
                        console.error('Failed to parse AI answers:', data.text);
                        answers = {};
                      }
                      
                      const fillRes = await sendToContent({ type: 'FILL_CUSTOM_ANSWERS', answers });
                      if (fillRes.error) throw new Error(fillRes.error);
                      
                      showBanner('success', `Form auto-filled and ${fillRes.filled || 0} custom questions answered! ✨`);
                    } else {
                      showBanner('success', 'Form fields auto-filled successfully');
                    }
                  } catch (e: any) {
                    showBanner('error', e.message);
                  }
                  setLoading(null);
                }}
                className="group flex items-center justify-between p-3.5 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-gray-300 hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl transition-colors ${jd ? 'bg-amber-100 text-amber-600 group-hover:bg-amber-500 group-hover:text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <Zap size={18} className={loading === 'autofill' ? 'animate-pulse' : ''} />
                  </div>
                  <span className="font-semibold text-sm text-slate-700 group-disabled:text-slate-400">
                    {loading === 'autofill' ? 'Autofilling...' : 'Smart Auto-fill'}
                  </span>
                </div>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button 
                  disabled={!jd} 
                  onClick={async () => {
                    setLoading('answerQs');
                    try {
                      const res = await sendToContent({ type: 'FILL_FORM', profile: activeProfile, jd });
                      if (res.error) throw new Error(res.error);

                      if (res.unansweredQuestions && res.unansweredQuestions.length > 0) {
                        showBanner('success', `AI is answering ${res.unansweredQuestions.length} custom questions...`);
                        const { resumeBase64, ...profileData } = activeProfile;
                        const prompt = `You are an expert career assistant. Answer the following job application questions based on the candidate's profile and the job description.
${profileData.systemPrompt ? `\nCRITICAL TONE & INSTRUCTIONS:\n${profileData.systemPrompt}\n` : ''}
Profile: ${JSON.stringify({ ...profileData, systemPrompt: undefined, resumeBase64: undefined })}

JD: ${jd?.text}

Task: Deeply analyze the JD and the Profile. For each question, synthesize the best answer by inferring how the candidate's background solves the JD's core problems. Keep answers extremely relevant and concise.

Questions:
${res.unansweredQuestions.map((q: any) => `- [${q.id}] ${q.question}`).join('\n')}

Respond with ONLY a raw JSON object where the keys are the exact question IDs in brackets above, and the values are the generated text answers. Do not include markdown code blocks like \`\`\`json.`;

                        const aiRes = await fetch('http://localhost:3000/api/generate', {
                          method: 'POST',
                          headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${settings.apiKey}`
                          },
                          body: JSON.stringify({ model: 'gpt-4o-mini', prompt })
                        });
                        
                        if (!aiRes.ok) throw new Error('Failed to generate answers for custom questions');
                        const data = await aiRes.json();
                        
                        let answers;
                        try {
                          const jsonStr = data.text.replace(/```json/gi, '').replace(/```/g, '').trim();
                          answers = JSON.parse(jsonStr);
                        } catch(e) {
                          answers = {};
                        }
                        
                        const fillRes = await sendToContent({ type: 'FILL_CUSTOM_ANSWERS', answers });
                        if (fillRes.error) throw new Error(fillRes.error);
                        
                        showBanner('success', `${fillRes.filled || 0} custom questions answered! ✨`);
                      } else {
                        showBanner('success', 'No open questions detected on this page.');
                      }
                    } catch (e: any) {
                      showBanner('error', e.message);
                    }
                    setLoading(null);
                  }}
                  className="flex flex-col items-center gap-2 p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-gray-300 hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed group"
                >
                  {loading === 'answerQs' ? (
                    <MessageSquare size={20} className="text-indigo-400 animate-pulse" />
                  ) : (
                    <MessageSquare size={20} className={`transition-colors ${jd ? 'text-indigo-400 group-hover:text-indigo-600' : 'text-slate-300'}`} />
                  )}
                  <span className="text-xs font-semibold text-slate-600 group-disabled:text-slate-400">
                    {loading === 'answerQs' ? 'Thinking...' : 'Answer Qs'}
                  </span>
                </button>
                <button 
                  disabled={!jd || loading === 'coverLetter'} 
                  onClick={handleGenerateCoverLetter}
                  className="flex flex-col items-center gap-2 p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-gray-300 hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed group relative overflow-hidden"
                >
                  {loading === 'coverLetter' ? (
                    <div className="flex flex-col items-center gap-2 animate-pulse">
                      <FileText size={20} className="text-teal-500" />
                      <span className="text-xs font-semibold text-teal-600">Drafting...</span>
                    </div>
                  ) : (
                    <>
                      <FileText size={20} className={`transition-colors ${jd ? 'text-teal-400 group-hover:text-teal-600' : 'text-slate-300'}`} />
                      <span className="text-xs font-semibold text-slate-600 group-disabled:text-slate-400">Cover Letter</span>
                    </>
                  )}
                </button>
              </div>

              {/* Copilot Start */}
              <button 
                onClick={() => {
                  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    const tab = tabs[0];
                    if (!tab || !tab.id) return showBanner('error', 'No active tab');
                    
                    // @ts-ignore
                    chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (streamId) => {
                      if (!streamId) return showBanner('error', 'Requires tab audio permission');
                      
                      chrome.runtime.sendMessage({
                        type: "START_COPILOT",
                        streamId: streamId
                      }, (res) => {
                        if (res && res.success) {
                          showBanner('success', 'Copilot overlay activated');
                        } else {
                          showBanner('error', 'Failed to start Live Copilot');
                        }
                      });
                    });
                  });
                }}
                className="mt-2 w-full flex items-center justify-center gap-2 bg-neutral-900 text-white hover:bg-neutral-800 shadow-sm border border-neutral-900 px-4 py-3 rounded-lg text-sm font-medium transition-colors active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
              >
                <Mic size={18} />
                Live Interview Copilot
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer sticky bottom */}
      <footer className="absolute bottom-0 w-full bg-slate-100 border-t border-slate-200 px-5 py-3 flex justify-between items-center text-xs text-slate-500 font-medium">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span> Connected</span>
        <span>{profiles.length} profiles</span>
      </footer>
    </div>
  );
}
