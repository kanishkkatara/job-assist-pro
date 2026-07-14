import React, { useState } from 'react';
import { useStorageLocal } from '../hooks/useStorage';
import { AppSettings } from '../types';
import { ApplicationJob } from '../utils/db';

interface Props {
  job: ApplicationJob;
}

export function SalaryNegotiation({ job }: Props) {
  const [offerAmount, setOfferAmount] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [leverage, setLeverage] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState<string | null>(null);
  const [settings] = useStorageLocal<AppSettings>('settings', { apiKey: '', model: 'gpt-4o-mini' });

  const handleGenerateScript = async () => {
    if (!settings.apiKey) return;
    setLoading(true);
    setScript(null);

    try {
      const prompt = `You are an expert career and salary negotiation coach.
      
Job: ${job.title} at ${job.company}
Initial Offer Received: ${offerAmount}
Target Amount Desired: ${targetAmount}
Candidate Leverage/Notes: ${leverage || 'None specified'}

Draft a highly professional, tactful, but firm salary negotiation email to the recruiter/hiring manager. The email should express gratitude, highlight the candidate's value (using the leverage provided), and make a clear counter-offer for the target amount.`;

      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: settings.model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: prompt }
          ]
        })
      });

      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              const textPart = JSON.parse(line.substring(2));
              fullText += textPart;
              setScript(fullText);
            } catch (e) {}
          }
        }
      }
    } catch (e: any) {
      setScript(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-6 p-2">
      <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200">
        <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span>🤝</span> Salary Negotiation Copilot
        </h3>
        <p className="text-sm text-slate-500 mb-6">
          Input your offer details below to generate a data-backed, professional counter-offer script.
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Initial Offer Received</label>
            <input 
              type="text" 
              value={offerAmount}
              onChange={(e) => setOfferAmount(e.target.value)}
              placeholder="e.g. $120,000 base + 10k sign-on" 
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Target Amount</label>
            <input 
              type="text" 
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="e.g. $135,000 base" 
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Leverage / Why you deserve it</label>
            <textarea 
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
              placeholder="e.g. Another offer deadline, unique skill, average market rate in SF..." 
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
            />
          </div>

          <button 
            onClick={handleGenerateScript}
            disabled={loading || !offerAmount || !targetAmount}
            className="mt-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-3 px-6 rounded-xl transition-colors w-full"
          >
            {loading ? 'Drafting Script...' : 'Generate Counter-Offer Script'}
          </button>
        </div>
      </div>

      {script && (
        <div className="bg-slate-50 p-6 rounded-2xl shadow-sm ring-1 ring-slate-200">
          <h4 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">Draft Email</h4>
          <div className="whitespace-pre-wrap text-sm text-slate-700 font-serif leading-relaxed">
            {script}
          </div>
          <button 
            onClick={() => navigator.clipboard.writeText(script)}
            className="mt-4 text-indigo-600 text-sm font-semibold hover:underline"
          >
            Copy to Clipboard
          </button>
        </div>
      )}
    </div>
  );
}
