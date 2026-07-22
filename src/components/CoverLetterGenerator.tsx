import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { AppSettings, JobDescription, CandidateProfile } from '../types';
import { getAIHeaders } from '../utils/api';

interface Props {
  jd: JobDescription;
  profile: CandidateProfile;
  settings: AppSettings;
}

export function CoverLetterGenerator({ jd, profile, settings }: Props) {
  const [generating, setGenerating] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');

  const generateCoverLetter = async () => {
    if (!settings.apiKey) return;
    setGenerating(true);
    setCoverLetter('');

    try {
      const prompt = `You are an expert career coach. Write a highly persuasive, 3-paragraph cover letter for the candidate applying to ${jd.company} for the ${jd.title} role.
      
Candidate Profile:
Name: ${profile.name || 'Candidate'}
Skills: ${(profile.skills || []).join(', ')}
Experience: ${(profile.experience || []).map((e: any) => e.title + ' at ' + e.company).join(', ')}

Job Description:
${jd.text}

Constraints:
- Keep it under 250 words.
- Be punchy, enthusiastic, and confident.
- Do not use generic buzzwords.
- Output ONLY the cover letter text, no preamble.`;

      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: getAIHeaders(settings),
        body: JSON.stringify({
          model: settings.model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setCoverLetter((prev) => prev + chunk);
      }
    } catch (e: any) {
      toast.error('Failed to generate cover letter: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(coverLetter);
    toast.success('Cover letter copied to clipboard!');
  };

  return (
    <div className="mt-8 border-t border-slate-200 pt-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            ✉️ AI Cover Letter
          </h3>
          <p className="text-sm text-slate-500 mt-1">Generate a highly personalized cover letter for this exact role.</p>
        </div>
        <button 
          onClick={generateCoverLetter}
          disabled={generating}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-4 rounded-lg transition-colors border border-slate-300 disabled:opacity-50"
        >
          {generating ? 'Writing...' : 'Write Cover Letter'}
        </button>
      </div>

      {(coverLetter || generating) && (
        <div className="bg-indigo-50/50 rounded-xl border border-indigo-100 p-6 relative">
          <textarea
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            className="w-full min-h-[300px] bg-transparent border-none focus:ring-0 text-sm text-slate-700 leading-relaxed resize-y"
            placeholder="Your cover letter will appear here..."
          />
          {!generating && coverLetter && (
            <button 
              onClick={copyToClipboard}
              className="absolute top-4 right-4 bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 p-2 rounded-md shadow-sm transition-colors text-sm font-semibold flex items-center gap-2"
            >
              📋 Copy
            </button>
          )}
        </div>
      )}
    </div>
  );
}
