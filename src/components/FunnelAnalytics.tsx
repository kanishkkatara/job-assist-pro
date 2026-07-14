import React, { useEffect, useState } from 'react';
import { getApplications, ApplicationJob } from '../utils/db';

export function FunnelAnalytics() {
  const [jobs, setJobs] = useState<ApplicationJob[]>([]);

  useEffect(() => {
    getApplications().then(setJobs);
  }, []);

  const total = jobs.length;
  const applied = jobs.filter(j => j.status !== 'Discovered').length;
  const interviewing = jobs.filter(j => ['Interviewing', 'Offered'].includes(j.status)).length;
  const offered = jobs.filter(j => j.status === 'Offered').length;

  const appToTotal = total > 0 ? Math.round((applied / total) * 100) : 0;
  const intToApp = applied > 0 ? Math.round((interviewing / applied) * 100) : 0;
  const offToInt = interviewing > 0 ? Math.round((offered / interviewing) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 animate-in fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <span className="text-4xl">📈</span> Conversion Analytics
        </h2>
        <p className="text-slate-500 mt-2 text-lg">
          Track your funnel performance to see where you need to improve.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center">
          <div className="text-4xl font-black text-slate-700 mb-2">{total}</div>
          <div className="font-semibold text-slate-500">Total Saved</div>
        </div>
        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 text-center">
          <div className="text-4xl font-black text-blue-600 mb-2">{applied}</div>
          <div className="font-semibold text-blue-800">Applied</div>
          <div className="text-xs text-blue-500 font-bold mt-1">{appToTotal}% of saved</div>
        </div>
        <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100 text-center">
          <div className="text-4xl font-black text-purple-600 mb-2">{interviewing}</div>
          <div className="font-semibold text-purple-800">Interviews</div>
          <div className="text-xs text-purple-500 font-bold mt-1">{intToApp}% conversion</div>
        </div>
        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 text-center">
          <div className="text-4xl font-black text-emerald-600 mb-2">{offered}</div>
          <div className="font-semibold text-emerald-800">Offers</div>
          <div className="text-xs text-emerald-500 font-bold mt-1">{offToInt}% conversion</div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          💡 AI Insights
        </h3>
        <div className="space-y-4">
          {intToApp < 10 && applied >= 10 && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex gap-3 text-rose-900">
              <span className="text-xl">⚠️</span>
              <div>
                <strong className="block mb-1">Low Application-to-Interview Conversion ({intToApp}%)</strong>
                Your resume isn't passing the ATS or capturing attention. Use the ATS Matcher and tailor your resume more aggressively before applying.
              </div>
            </div>
          )}
          {offToInt < 25 && interviewing >= 4 && (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3 text-amber-900">
              <span className="text-xl">🎤</span>
              <div>
                <strong className="block mb-1">Low Interview-to-Offer Conversion ({offToInt}%)</strong>
                You're getting in the door but struggling to close. Spend more time in the Mock Interview simulator practicing STAR format answers.
              </div>
            </div>
          )}
          {intToApp >= 20 && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex gap-3 text-emerald-900">
              <span className="text-xl">🔥</span>
              <div>
                <strong className="block mb-1">Excellent Resume Conversion ({intToApp}%)</strong>
                Your resume is highly effective. Keep applying to similar roles!
              </div>
            </div>
          )}
          {jobs.length === 0 && (
            <p className="text-slate-500">Save some jobs and apply to see your conversion insights here.</p>
          )}
        </div>
      </div>
    </div>
  );
}
