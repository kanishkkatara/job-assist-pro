import React, { useState, useEffect } from 'react';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { z } from 'zod';
import { AppSettings } from '../types';
import { getAIHeaders } from '../utils/api';

interface Props {
  company: string;
  settings: AppSettings;
}

export function CompanyIntel({ company, settings }: Props) {
  const [hasStarted, setHasStarted] = useState(false);

  const { object: intel, submit, isLoading } = useObject({
    api: 'http://localhost:3000/api/object',
    schema: z.object({
      mission: z.string(),
      recentNews: z.array(z.string()),
      culture: z.string(),
      techStack: z.array(z.string()),
      redFlags: z.array(z.string())
    }),
    fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, {
      ...init,
      headers: { ...init?.headers, ...getAIHeaders(settings) }
    })
  });

  useEffect(() => {
    if (!hasStarted && company) {
      setHasStarted(true);
      const prompt = `You are an expert tech recruiter and industry analyst. Provide a brief intelligence report on the company: ${company}.
Include their mission, 2-3 recent news events or milestones, engineering/company culture, estimated tech stack, and any potential red flags or common criticisms.`;
      
      submit({
        model: settings.model || 'gpt-4o-mini',
        schemaId: 'company-intel',
        messages: [{ role: 'user', content: prompt }]
      });
    }
  }, [hasStarted, company, submit, settings]);

  if (isLoading && !intel) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto mb-4"></div>
        <p className="text-slate-500 font-medium animate-pulse">Gathering intelligence on {company}...</p>
      </div>
    );
  }

  if (!intel) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-2xl text-indigo-600">
          🏢
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-800">{company} Intelligence Briefing</h3>
          <p className="text-sm text-slate-500">AI-generated summary for interview prep</p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Mission & Thesis</h4>
          <p className="text-slate-700 font-medium leading-relaxed">{intel.mission}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Culture</h4>
            <p className="text-slate-700 text-sm">{intel.culture}</p>
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Estimated Tech Stack</h4>
            <div className="flex flex-wrap gap-2">
              {(intel.techStack || []).map((tech: any, i: number) => (
                <span key={i} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-md border border-slate-200">
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
            <h4 className="text-emerald-800 font-bold mb-3 flex items-center gap-2 text-sm">
              📰 Recent News & Milestones
            </h4>
            <ul className="space-y-2">
              {(intel.recentNews || []).map((news: any, i: number) => (
                <li key={i} className="flex gap-2 text-emerald-900 text-sm">
                  <span className="text-emerald-500 font-bold">•</span>
                  {news}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100">
            <h4 className="text-rose-800 font-bold mb-3 flex items-center gap-2 text-sm">
              🚩 Potential Red Flags
            </h4>
            <ul className="space-y-2">
              {(intel.redFlags || []).map((flag: any, i: number) => (
                <li key={i} className="flex gap-2 text-rose-900 text-sm">
                  <span className="text-rose-500 font-bold">•</span>
                  {flag}
                </li>
              ))}
              {(!intel.redFlags || intel.redFlags.length === 0) && (
                <li className="text-rose-900/50 text-sm italic">No major red flags detected.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
