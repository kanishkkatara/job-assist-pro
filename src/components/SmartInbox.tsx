import React, { useState, useEffect } from 'react';
import { getApplications, updateApplicationStatus, ApplicationJob } from '../utils/db';
import { Mail, Send, Trash2, Edit3, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function SmartInbox() {
  const [jobs, setJobs] = useState<ApplicationJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    const data = await getApplications();
    // Filter jobs that have a drafted reply pending
    setJobs(data.filter(j => j.draftReply));
    setLoading(false);
  };

  const clearDraft = async (job: ApplicationJob) => {
    // In a real app we'd need an updateJob(id, partial) function, but for prototype we just filter UI
    setJobs(jobs.filter(j => j.id !== job.id));
    toast.success('Draft archived');
  };

  const sendDraft = async (job: ApplicationJob) => {
    toast.loading('Sending email via Gmail API...', { duration: 2000 });
    setTimeout(() => {
      setJobs(jobs.filter(j => j.id !== job.id));
      toast.success('Email sent successfully!');
    }, 2000);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 animate-in fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <span className="text-4xl">📥</span> Smart Inbox
        </h2>
        <p className="text-slate-500 mt-2 text-lg">
          AI-drafted replies to recruiters based on your background syncs.
        </p>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-16 text-center text-slate-500 flex flex-col items-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 ring-8 ring-slate-50/50">
            <Mail className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Inbox Zero</h3>
          <p className="mt-2 max-w-sm">No pending drafts to review. We're monitoring your connected Gmail in the background.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {jobs.map(job => (
            <div key={job.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col space-y-4 relative overflow-hidden group hover:border-indigo-300 transition-all">
              {/* Context Header */}
              <div className="flex justify-between items-start">
                <div>
                  <div className={`inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md mb-3 ${
                    job.status === 'Interviewing' ? 'bg-amber-100 text-amber-700' :
                    job.status === 'Offered' ? 'bg-emerald-100 text-emerald-700' :
                    job.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    <Mail className="w-3.5 h-3.5" />
                    <span>Auto-Detected: {job.status}</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">{job.title} at {job.company}</h3>
                </div>
              </div>

              {/* Draft Reply Area */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 relative">
                <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Drafted Reply</span>
                  <button className="text-slate-400 hover:text-indigo-500 transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
                <textarea 
                  className="w-full bg-transparent border-none resize-none focus:ring-0 p-0 text-slate-700 leading-relaxed text-sm min-h-[140px] font-medium"
                  defaultValue={job.draftReply}
                  readOnly
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end items-center space-x-3 pt-2">
                <button 
                  onClick={() => clearDraft(job)}
                  className="text-slate-400 hover:text-red-500 transition-colors p-2.5 rounded-lg hover:bg-red-50"
                  title="Discard Draft"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => sendDraft(job)}
                  className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-600/20 hover:shadow-lg hover:-translate-y-0.5"
                >
                  <Send className="w-4 h-4" />
                  <span>Approve & Send</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
