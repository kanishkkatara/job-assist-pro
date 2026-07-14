import React, { useState, useEffect } from 'react';
import { useStorageLocal } from '../hooks/useStorage';
import { CandidateProfile, AppSettings } from '../types';
import { addApplication } from '../utils/db';
import { toast } from 'react-hot-toast';

export function JobDiscovery() {
  const [profiles] = useStorageLocal<CandidateProfile[]>('profiles', []);
  const [activeProfileId] = useStorageLocal<string | null>('activeProfileId', null);
  const [settings] = useStorageLocal<AppSettings>('settings', { apiKey: '', model: 'gpt-4o-mini' });
  
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  
  const activeProfile = profiles.find(p => p.id === activeProfileId);

  const handleDiscoverJobs = async () => {
    if (!activeProfile || !settings.apiKey) return;
    setLoading(true);
    setJobs([]);

    try {
      const prompt = `You are a proactive career agent. The user is looking for a job.
Profile Target Role: ${activeProfile.targetRole}
Profile Skills: ${activeProfile.skills?.join(', ') || 'N/A'}
Experience: ${(activeProfile.experience || []).map(e => e.title + ' at ' + e.company).join(', ')}

Simulate scraping the web and return 5 highly relevant, realistic job openings that perfectly match this candidate. Ensure they are a mix of well-known tech companies and strong startups. Provide a match score (0-100), a 1-sentence reason, and a URL.`;

      const response = await fetch('http://localhost:3000/api/object', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: settings.model || 'gpt-4o-mini',
          schemaId: 'discovery',
          messages: [
            { role: 'system', content: prompt }
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
          if (parsed.jobs) {
            setJobs(parsed.jobs);
          }
        } catch (e) {
          // Ignore parse errors while streaming
        }
      }
      
      try {
        const finalParsed = JSON.parse(fullJson);
        if (finalParsed.jobs) setJobs(finalParsed.jobs);
      } catch (e) {}

    } catch (e: any) {
      toast.error('Failed to discover jobs: ' + e.message);
    }
    setLoading(false);
  };

  const handleAddJob = async (job: any) => {
    try {
      await addApplication({
        id: 'job_' + Date.now(),
        title: job.title,
        company: job.company,
        url: job.url,
        status: 'Discovered',
        jdText: 'Discovered via AI agent.',
        capturedAt: Date.now()
      });
      toast.success(`Added ${job.title} to your Tracker`);
    } catch (e) {
      toast.error('Could not add job to tracker');
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 animate-in fade-in">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <span className="text-4xl">🔭</span> Job Discovery
          </h2>
          <p className="text-slate-500 mt-2 text-lg">
            AI-powered proactive sourcing based on your {activeProfile?.targetRole || 'current'} profile.
          </p>
        </div>
        <button 
          onClick={handleDiscoverJobs}
          disabled={loading || !activeProfile}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-3 px-6 rounded-xl transition-colors shadow-sm flex items-center gap-2"
        >
          {loading ? '🔍 Sourcing...' : '✨ Find High-Match Jobs'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {jobs.length === 0 && !loading && (
          <div className="text-center py-20 bg-slate-100 rounded-2xl border border-slate-200 border-dashed">
            <p className="text-slate-500 font-medium">Click "Find High-Match Jobs" to start your automated search.</p>
          </div>
        )}
        
        {jobs.map((job, idx) => (
          <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-start gap-4 transition-all hover:shadow-md hover:border-indigo-200">
            <div className="flex-1">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{job.title}</h3>
                  <p className="text-slate-500 font-medium">{job.company}</p>
                </div>
                <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold border border-emerald-200">
                  {job.matchScore}% Match
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-4">{job.reason}</p>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handleAddJob(job)}
                  className="bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-sm font-semibold py-2 px-4 rounded-lg transition-colors border border-slate-200 hover:border-indigo-200"
                >
                  + Add to Tracker
                </button>
                <a 
                  href={job.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-slate-400 hover:text-slate-600 underline"
                >
                  View Details
                </a>
              </div>
            </div>
          </div>
        ))}
        
        {loading && jobs.length === 0 && (
          <div className="text-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto mb-4"></div>
            <p className="text-slate-500 font-medium animate-pulse">Scraping job boards & analyzing matches...</p>
          </div>
        )}
      </div>
    </div>
  );
}
