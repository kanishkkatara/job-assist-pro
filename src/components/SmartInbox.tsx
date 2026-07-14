import React, { useState } from 'react';
import { getApplications, updateApplicationStatus } from '../utils/db';
import { AppSettings } from '../types';
import { useStorageLocal } from '../hooks/useStorage';

export function SmartInbox() {
  const [emailText, setEmailText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [settings] = useStorageLocal<AppSettings>('settings', { apiKey: '', model: 'gpt-4o-mini' });

  const handleProcessEmail = async () => {
    if (!emailText.trim()) return;
    if (!settings.apiKey) {
      setResult('Error: No OpenAI API Key found in settings.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const jobs = await getApplications();
      const jobListString = jobs.map(j => `ID: ${j.id}, Title: ${j.title}, Company: ${j.company}, Current Status: ${j.status}`).join('\n');

      const response = await fetch('http://localhost:3000/api/object', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: settings.model || 'gpt-4o-mini',
          schemaId: 'status-update',
          messages: [
            {
              role: 'system',
              content: 'You are an AI assistant parsing an email from a recruiter or company.'
            },
            {
              role: 'user',
              content: `Email Text:\n"""\n${emailText}\n"""\n\nHere is the list of jobs the candidate has tracked in their Kanban board:\n${jobListString}\n\nAnalyze the email. Determine which job it refers to. \nThen, determine if the email is:\n1. An interview invite or scheduling request -> status: "Interviewing"\n2. A rejection -> status: "Rejected"\n3. An offer -> status: "Offered"\n4. Other -> status: keep the same\n\nIf you cannot identify the job, set matchedJobId to null.`
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
      }

      const data = JSON.parse(fullJson);
      
      if (data.matchedJobId) {
        const job = jobs.find(j => j.id === data.matchedJobId);
        if (job) {
          if (data.newStatus !== job.status) {
            await updateApplicationStatus(data.matchedJobId, data.newStatus as any);
            setResult(`✅ Successfully updated ${job.company} - ${job.title} to "${data.newStatus}".\n\nAI Draft Reply:\n${data.draftReply}`);
          } else {
            setResult(`Matched ${job.company} - ${job.title}, but status remains "${job.status}".\n\nAI Draft Reply:\n${data.draftReply}`);
          }
        } else {
          setResult('Job ID matched but not found in database.');
        }
      } else {
        setResult('Could not confidently match this email to any tracked job.');
      }
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 animate-in fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <span className="text-4xl">📥</span> Smart Inbox Sync
        </h2>
        <p className="text-slate-500 mt-2 text-lg">
          Paste an email from a recruiter below. The AI will automatically identify the job, update your Kanban tracker, and draft a reply.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Paste Email Content</label>
          <textarea
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            className="w-full h-64 p-4 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans text-sm resize-none"
            placeholder="e.g. Hi Kanishk, Thanks for applying to Acme Corp. We'd love to schedule an interview with you next week..."
          />
        </div>

        <button
          onClick={handleProcessEmail}
          disabled={loading || !emailText.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-3 px-6 rounded-xl transition-colors self-start shadow-sm flex items-center gap-2"
        >
          {loading ? 'Processing...' : '✨ Process Email'}
        </button>

        {result && (
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mt-4 whitespace-pre-wrap font-mono text-sm text-slate-800">
            {result}
          </div>
        )}
      </div>
    </div>
  );
}
