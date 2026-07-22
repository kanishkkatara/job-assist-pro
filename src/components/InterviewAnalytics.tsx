import React, { useEffect, useState } from 'react';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { z } from 'zod';
import { AppSettings } from '../types';
import { getAIHeaders } from '../utils/api';

interface Props {
  transcripts: { question: string, answer: string }[];
  settings: AppSettings;
  onReset: () => void;
}

export function InterviewAnalytics({ transcripts, settings, onReset }: Props) {
  const [hasStarted, setHasStarted] = useState(false);

  const { object: analytics, submit, isLoading } = useObject({
    api: 'http://localhost:3000/api/object',
    schema: z.object({
      fillerWords: z.number(),
      pacing: z.string(),
      confidenceScore: z.number(),
      strengths: z.array(z.string()),
      improvements: z.array(z.string())
    }),
    fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, {
      ...init,
      headers: { ...init?.headers, ...getAIHeaders(settings) }
    })
  });

  useEffect(() => {
    if (!hasStarted && transcripts.length > 0) {
      setHasStarted(true);
      const prompt = `Analyze this mock interview transcript for the candidate's performance.
Provide a rough count of filler words (um, uh, like), feedback on pacing (e.g. 'Good', 'Too fast'), a confidence score (0-100), and 2-3 strengths and improvements.
      
Transcripts:
${transcripts.map((t, i) => `Q${i+1}: ${t.question}\nA${i+1}: ${t.answer}`).join('\n\n')}
`;
      submit({
        model: settings.model || 'gpt-4o-mini',
        schemaId: 'analytics',
        messages: [{ role: 'user', content: prompt }]
      });
    }
  }, [hasStarted, transcripts, submit, settings]);

  return (
    <div className="bg-white p-8 rounded-2xl ring-1 ring-slate-200 shadow-sm max-w-4xl mx-auto h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="text-3xl">📊</span> Post-Interview Analytics
          </h3>
          <p className="text-slate-500 mt-1">AI review of your mock interview performance.</p>
        </div>
        <button 
          onClick={onReset}
          className="text-indigo-600 hover:text-indigo-700 font-semibold hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
        >
          Practice Again
        </button>
      </div>

      {isLoading && !analytics ? (
        <div className="text-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium animate-pulse">Analyzing transcripts and computing scores...</p>
        </div>
      ) : analytics ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center">
            <div className="text-4xl font-black text-indigo-600 mb-2">{analytics.confidenceScore || 0}/100</div>
            <div className="font-semibold text-slate-700">Confidence Score</div>
            <div className="text-sm text-slate-500 mt-1">Based on vocabulary & assertiveness</div>
          </div>
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center">
            <div className="text-4xl font-black text-amber-500 mb-2">{analytics.fillerWords || 0}</div>
            <div className="font-semibold text-slate-700">Filler Words</div>
            <div className="text-sm text-slate-500 mt-1">"um", "like", "uh"</div>
          </div>
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center">
            <div className="text-4xl font-black text-emerald-500 mb-2">{analytics.pacing === 'Too fast' ? '⏱️' : analytics.pacing === 'Too slow' ? '🐢' : '✨'}</div>
            <div className="font-semibold text-slate-700">Pacing</div>
            <div className="text-sm text-slate-500 mt-1">{analytics.pacing || 'Analyzing...'}</div>
          </div>
          
          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div className="bg-emerald-50/50 p-6 rounded-xl border border-emerald-100">
              <h4 className="text-emerald-800 font-bold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Strengths
              </h4>
              <ul className="space-y-3">
                {(analytics.strengths || []).map((s: any, i: number) => (
                  <li key={i} className="flex gap-3 text-emerald-900 text-sm">
                    <span className="text-emerald-500 font-bold">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-rose-50/50 p-6 rounded-xl border border-rose-100">
              <h4 className="text-rose-800 font-bold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Areas to Improve
              </h4>
              <ul className="space-y-3">
                {(analytics.improvements || []).map((s: any, i: number) => (
                  <li key={i} className="flex gap-3 text-rose-900 text-sm">
                    <span className="text-rose-500 font-bold">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
