import React, { useState, useEffect } from 'react';
import { useStorageSession, useStorageLocal } from '../hooks/useStorage';
import { CandidateProfile, JobDescription } from '../types';
import { toast } from 'react-hot-toast';

declare const pdfjsLib: any;

export function AtsMatcher() {
  const [jd] = useStorageSession<JobDescription | null>('currentJD', null);
  const [profiles] = useStorageLocal<CandidateProfile[]>('profiles', []);
  const [activeProfileId] = useStorageLocal<string | null>('activeProfileId', null);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ score: number, strengths: string[], weaknesses: string[], suggestions: any[] } | null>(null);

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  const extractTextFromPDF = async (base64Data: string) => {
    // @ts-ignore
    const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
    if (!pdfjsLib) throw new Error("pdfjsLib not loaded");
    pdfjsLib.GlobalWorkerOptions.workerSrc = '../lib/pdf.worker.min.js';

    const pdfData = atob(base64Data.split(',')[1]);
    const pdfAsArray = new Uint8Array(pdfData.length);
    for (let i = 0; i < pdfData.length; i++) pdfAsArray[i] = pdfData.charCodeAt(i);

    const pdf = await pdfjsLib.getDocument({ data: pdfAsArray }).promise;
    let fullText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + ' ';
    }
    return fullText;
  };

  const isMounted = React.useRef(true);
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const analyzeATS = async () => {
    if (!jd || !activeProfile || !activeProfile.resumeBase64) return;
    setLoading(true);
    
    try {
      const { settings } = (await chrome.storage.local.get({ settings: { apiKey: '', model: 'gpt-4o-mini' } })) as any;
      const resumeText = await extractTextFromPDF(activeProfile.resumeBase64);
      
      const response = await fetch('http://localhost:3000/api/object', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: settings.model || 'gpt-4o-mini',
          schemaId: 'ats-review',
          messages: [
            {
              role: 'system',
              content: 'You are an expert ATS recruiter. Compare the candidate\'s resume against the Job Description and provide a semantic review.'
            },
            {
              role: 'user',
              content: `Job Description:\n${jd.title} at ${jd.company}\n${jd.text}\n\nCandidate Resume:\n${resumeText}`
            }
          ]
        })
      });

      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullJson = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullJson += decoder.decode(value, { stream: true });
        try {
          const parsed = JSON.parse(fullJson);
          if (isMounted.current && parsed.score !== undefined) {
            setResults(parsed);
          }
        } catch (e) {
          // Ignore parse errors while streaming
        }
      }
      
      try {
        const finalParsed = JSON.parse(fullJson);
        if (isMounted.current) setResults(finalParsed);
      } catch (e) {}
      
    } catch (e) {
      console.error(e);
      toast.error('Failed to run ATS analysis');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  if (!jd) {
    return (
      <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 text-center text-gray-500">
        Capture a Job Description first to check your ATS match.
      </div>
    );
  }

  if (!activeProfile || !activeProfile.resumeBase64) {
    return (
      <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 text-center text-gray-500">
        Active profile doesn't have a PDF resume attached.
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-2xl ring-1 ring-slate-200 shadow-sm flex flex-col h-full max-w-4xl mx-auto">
      <div className="mb-8">
        <h3 className="text-2xl font-bold text-slate-800 mb-2">📄 ATS Matcher</h3>
        <p className="text-slate-500">
          Comparing <strong className="text-slate-800">{activeProfile?.name || 'Profile'}</strong> against <strong className="text-slate-800">{jd.title}</strong>
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span className="text-slate-600 font-medium animate-pulse">Analyzing resume against job description...</span>
          </div>
        ) : !results ? (
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 ring-1 ring-indigo-200 rounded-full p-6">
                <svg className="w-12 h-12 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
            </div>
            <p className="text-slate-600 max-w-md mx-auto mb-6">Click below to extract text from your attached resume PDF and compare it against the job description.</p>
            <button 
              onClick={analyzeATS} 
              className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white px-6 py-3 rounded-xl font-medium shadow-md shadow-indigo-500/20 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              Run ATS Analysis
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-50/50 p-8 rounded-2xl ring-1 ring-slate-200 text-center shadow-inner">
              <div className={`text-6xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-br ${(results.score || 0) > 70 ? 'from-emerald-400 to-emerald-600' : (results.score || 0) > 40 ? 'from-amber-400 to-amber-600' : 'from-rose-400 to-rose-600'}`}>
                {results.score || 0}%
              </div>
              <div className="text-slate-500 font-bold uppercase tracking-widest text-xs">Semantic Match Score</div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl ring-1 ring-emerald-200 shadow-sm hover:shadow-md transition-shadow">
                <h4 className="text-emerald-700 font-bold mb-4 flex items-center gap-2"><span className="text-emerald-500">✓</span> Strengths</h4>
                <div className="flex flex-col gap-2">
                  {(results.strengths || []).map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      <span>{s}</span>
                    </div>
                  ))}
                  {(!results.strengths || results.strengths.length === 0) && <span className="text-slate-400 italic text-sm">None identified</span>}
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-2xl ring-1 ring-rose-200 shadow-sm hover:shadow-md transition-shadow">
                <h4 className="text-rose-700 font-bold mb-4 flex items-center gap-2"><span className="text-rose-500">✗</span> Weaknesses / Gaps</h4>
                <div className="flex flex-col gap-2">
                  {(results.weaknesses || []).map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="text-rose-500 mt-0.5">•</span>
                      <span>{w}</span>
                    </div>
                  ))}
                  {(!results.weaknesses || results.weaknesses.length === 0) && <span className="text-slate-400 italic text-sm">None missing</span>}
                </div>
              </div>
            </div>

            {results.suggestions && results.suggestions.length > 0 && (
              <div className="bg-white p-6 rounded-2xl ring-1 ring-indigo-200 shadow-sm mt-2">
                <h4 className="text-indigo-700 font-bold mb-4 flex items-center gap-2">✨ AI Rewrite Suggestions</h4>
                <div className="flex flex-col gap-4">
                  {results.suggestions.map((sugo, i) => (
                    <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Original</span>
                        <p className="text-sm text-slate-600 line-through decoration-rose-300">{sugo.originalContent}</p>
                      </div>
                      <div className="mb-2">
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Suggested</span>
                        <p className="text-sm text-indigo-900 font-medium">{sugo.suggestedRewrite}</p>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 italic">Why: {sugo.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex flex-col items-center gap-3 mt-4">
              <button 
                onClick={async () => {
                  try {
                    setLoading(true);
                    const { pdf } = await import('@react-pdf/renderer');
                    const { ResumeDocument } = await import('./ResumeBuilder');
                    
                    // Note: We might want to inject suggestions dynamically into the builder, but for now we'll pass weaknesses
                    const blob = await pdf(<ResumeDocument profile={activeProfile} injectedKeywords={results.weaknesses || []} />).toBlob();
                    
                    // Trigger download
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `Tailored_Resume_${jd.company}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    
                    // Convert Blob to Base64 and save to Job in DB
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      if (reader.result && jd.id) {
                        const { updateTailoredResume } = await import('../utils/db');
                        await updateTailoredResume(jd.id, reader.result as string);
                        toast.success('Tailored Resume saved to job!');
                      }
                    };
                    reader.readAsDataURL(blob);
                    
                  } catch (e) {
                    console.error("Failed to generate PDF", e);
                  } finally {
                    setLoading(false);
                  }
                }} 
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-8 py-3 rounded-xl font-bold shadow-md shadow-emerald-500/20 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center"
                disabled={loading}
              >
                {loading ? 'Generating...' : 'Generate Tailored Resume'}
              </button>
              
              <button 
                onClick={() => setResults(null)} 
                className="text-slate-500 hover:text-slate-800 font-medium transition-colors"
              >
                ⟲ Reset Analysis
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
