import React, { useState } from 'react';
import { useStorageLocal, useStorageSession } from '../hooks/useStorage';
import { addApplication } from '../utils/db';
import { Settings, LayoutDashboard, Briefcase, Zap, MessageSquare, FileText, Mic, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import '../index.css'; // Ensure tailwind is imported

export function Popup() {
  const [profiles] = useStorageLocal<any[]>('profiles', []);
  const [activeProfileId, setActiveProfileId] = useStorageLocal<string | null>('activeProfileId', null);
  const [jd, setJd] = useStorageSession<any>('currentJD', null);
  
  const [loading, setLoading] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

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

  return (
    <div className="w-[380px] bg-slate-50 text-slate-900 font-sans shadow-xl overflow-hidden flex flex-col h-[500px]">
      {/* Header */}
      <header className="bg-indigo-600 text-white px-5 py-4 flex justify-between items-center shadow-md z-10 relative">
        <div className="flex items-center gap-2">
          <Briefcase size={20} className="text-indigo-200" />
          <h2 className="m-0 text-lg font-bold tracking-tight">JobAssist Pro</h2>
        </div>
        <button onClick={handleOpenDashboard} className="p-1.5 hover:bg-indigo-500 rounded-lg transition-colors text-indigo-100 hover:text-white" title="Open Dashboard">
          <LayoutDashboard size={20} />
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-5 pb-20 relative">
        {/* Banner Alert */}
        {banner && (
          <div className={`mb-4 px-4 py-3 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 text-sm font-medium shadow-sm border ${
            banner.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            {banner.type === 'success' ? <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-500" /> : <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-500" />}
            <p className="leading-tight">{banner.msg}</p>
          </div>
        )}

        {/* Profile Selector */}
        <div className="mb-5 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
          <select 
            value={activeProfileId || ''} 
            onChange={(e) => setActiveProfileId(e.target.value)}
            className="w-full bg-transparent p-3 text-sm font-medium text-slate-700 outline-none cursor-pointer appearance-none"
          >
            <option value="" disabled>Select your active profile...</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
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
                    showBanner('success', 'Form fields auto-filled successfully');
                  } catch (e: any) {
                    showBanner('error', e.message);
                  }
                  setLoading(null);
                }}
                className="group flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:border-slate-200 disabled:hover:shadow-sm"
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
                  className="flex flex-col items-center gap-2 p-3 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed group"
                >
                  <MessageSquare size={20} className={`transition-colors ${jd ? 'text-indigo-400 group-hover:text-indigo-600' : 'text-slate-300'}`} />
                  <span className="text-xs font-semibold text-slate-600 group-disabled:text-slate-400">Answer Qs</span>
                </button>
                <button 
                  disabled={!jd} 
                  className="flex flex-col items-center gap-2 p-3 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed group"
                >
                  <FileText size={20} className={`transition-colors ${jd ? 'text-teal-400 group-hover:text-teal-600' : 'text-slate-300'}`} />
                  <span className="text-xs font-semibold text-slate-600 group-disabled:text-slate-400">Cover Letter</span>
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
                className="mt-2 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white p-3.5 rounded-2xl font-bold shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all active:scale-[0.98]"
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
