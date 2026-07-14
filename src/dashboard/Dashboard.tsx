import React, { useState } from 'react';
import { useStorageLocal } from '../hooks/useStorage';
import { KanbanBoard } from '../components/KanbanBoard';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { CandidateProfile, AppSettings } from '../types';
import { Toaster, toast } from 'react-hot-toast';

export function Dashboard() {
  const [profiles, setProfiles] = useStorageLocal<CandidateProfile[]>('profiles', []);
  const [settings, setSettings] = useStorageLocal<AppSettings>('settings', { apiKey: '', model: 'gpt-4o-mini' });
  const [activeTab, setActiveTab] = useState<'profiles' | 'settings' | 'kanban' | 'ats' | 'interview'>('profiles');
  const [activeProfileId, setActiveProfileId] = useStorageLocal<string | null>('activeProfileId', null);

  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileRole, setNewProfileRole] = useState('');
  const [newProfileSkills, setNewProfileSkills] = useState('');
  const [newProfileResume, setNewProfileResume] = useState('');

  const updateSettings = (key: keyof AppSettings, value: string) => {
    setSettings({ ...settings, [key]: value });
    toast.success('Settings saved automatically');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setNewProfileResume(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const [isParsing, setIsParsing] = useState(false);

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

  const handleCreateProfile = async () => {
    if (!newProfileName || !newProfileRole) {
      toast.error('Please fill in name and target role');
      return;
    }
    
    setIsParsing(true);
    let parsedExperience: any[] = [];
    let parsedSummary = '';
    
    try {
      if (newProfileResume && settings.apiKey) {
        toast.loading('Parsing resume...', { id: 'parse-toast' });
        const resumeText = await extractTextFromPDF(newProfileResume);
        
        const response = await fetch('http://localhost:3000/api/parse-resume', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`,
          },
          body: JSON.stringify({ text: resumeText })
        });
        
        if (response.ok) {
          const data = await response.json();
          parsedExperience = data.experience || [];
          parsedSummary = data.summary || '';
          toast.success('Resume parsed successfully!', { id: 'parse-toast' });
        } else {
          throw new Error('Failed to parse resume');
        }
      }
    } catch (e) {
      console.error('Parsing error', e);
      toast.error('Failed to parse resume, continuing with empty profile', { id: 'parse-toast' });
    }

    const newProfile: CandidateProfile = {
      id: Date.now().toString(),
      name: newProfileName,
      targetRole: newProfileRole,
      skills: newProfileSkills.split(',').map(s => s.trim()).filter(Boolean),
      experience: parsedExperience,
      summary: parsedSummary,
      resumeBase64: newProfileResume
    };
    
    setProfiles([...profiles, newProfile]);
    if (!activeProfileId) setActiveProfileId(newProfile.id);
    
    setIsAddingProfile(false);
    setNewProfileName('');
    setNewProfileRole('');
    setNewProfileSkills('');
    setNewProfileResume('');
    setIsParsing(false);
    toast.success('Profile created successfully!');
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      <Toaster position="top-right" />
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 p-6 flex flex-col">
        <h1 className="text-2xl font-bold mb-8 text-blue-600">JobAssist Pro</h1>
        <nav className="flex flex-col gap-2 flex-1" role="tablist">
          <button 
            role="tab"
            aria-selected={activeTab === 'profiles'}
            onClick={() => setActiveTab('profiles')}
            className={`text-left px-4 py-3 rounded-lg transition-colors duration-200 ${activeTab === 'profiles' ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm ring-1 ring-indigo-900/5 translate-x-1' : 'hover:bg-slate-100/50'}`}
          >
            👤 Profiles
          </button>
          <button 
            role="tab"
            aria-selected={activeTab === 'kanban'}
            onClick={() => setActiveTab('kanban')}
            className={`text-left px-4 py-3 rounded-lg transition-colors duration-200 ${activeTab === 'kanban' ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm ring-1 ring-indigo-900/5 translate-x-1' : 'hover:bg-slate-100/50'}`}
          >
            📊 Tracker
          </button>
          
          <div className="mt-auto">
            <button 
              role="tab"
              aria-selected={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors duration-200 ${activeTab === 'settings' ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm ring-1 ring-indigo-900/5 translate-x-1' : 'hover:bg-slate-100/50'}`}
            >
              ⚙️ Settings
            </button>
          </div>
        </nav>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <ErrorBoundary>
        {activeTab === 'profiles' && (
          <div role="tabpanel" className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-slate-800">Profiles</h2>
              <button 
                onClick={() => setIsAddingProfile(true)}
                className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-md shadow-indigo-500/20 transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                + New Profile
              </button>
            </div>
            {profiles.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-center mb-6">
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200 rounded-full p-6">
                    <svg className="w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-slate-700">No profiles yet</h3>
                <p className="text-slate-500 mt-2 max-w-sm mx-auto">Create a profile and upload your resume to start tailoring applications.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {profiles.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => {
                      setActiveProfileId(p.id);
                      toast.success(`Active profile set to ${p.name}`);
                    }}
                    className={`bg-white p-6 rounded-2xl ring-1 transition-all duration-300 ease-out cursor-pointer group ${
                      activeProfileId === p.id 
                        ? 'ring-indigo-500 shadow-md shadow-indigo-500/10' 
                        : 'ring-slate-200 hover:ring-indigo-200 hover:shadow-xl hover:shadow-indigo-900/5 hover:-translate-y-1'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{p.name}</h3>
                      {activeProfileId === p.id && (
                        <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded-full font-bold tracking-wide">ACTIVE</span>
                      )}
                    </div>
                    <p className="text-slate-500 font-medium mb-4">{p.targetRole}</p>
                    <div className="flex flex-wrap gap-2">
                      {(p.skills || []).slice(0, 3).map(skill => (
                        <span key={skill} className="px-2.5 py-1 bg-slate-50 text-slate-600 ring-1 ring-slate-200 rounded-md text-xs font-medium">{skill}</span>
                      ))}
                      {(p.skills || []).length > 3 && (
                        <span className="px-2.5 py-1 bg-slate-50 text-slate-600 ring-1 ring-slate-200 rounded-md text-xs font-medium">+{p.skills.length - 3}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'kanban' && (
          <div role="tabpanel" className="h-full">
            <KanbanBoard />
          </div>
        )}
        
        {activeTab === 'settings' && (
          <div role="tabpanel" className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Settings</h2>
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
              <div className="mb-6">
                <label htmlFor="apiKey" className="block mb-2 font-medium text-gray-700">OpenAI API Key</label>
                <input 
                  id="apiKey"
                  type="password" 
                  value={settings.apiKey || ''} 
                  onChange={(e) => updateSettings('apiKey', e.target.value)}
                  className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="sk-..."
                />
                <p className="text-sm text-gray-500 mt-2">Your key is stored locally and securely sent to the local proxy.</p>
              </div>
              <div>
                <label htmlFor="model" className="block mb-2 font-medium text-gray-700">Default Model</label>
                <select 
                  id="model"
                  value={settings.model || 'gpt-4o-mini'}
                  onChange={(e) => updateSettings('model', e.target.value)}
                  className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white cursor-pointer"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini (Fast & Cheap)</option>
                  <option value="gpt-4o">GPT-4o (Most Capable)</option>
                </select>
              </div>
            </div>
          </div>
        )}
        </ErrorBoundary>
      </main>

      {/* Profile Creation Modal */}
      {isAddingProfile && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl ring-1 ring-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-bold text-slate-800 mb-6">Create Profile</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block mb-1.5 font-medium text-slate-700 text-sm">Profile Name</label>
                <input 
                  type="text" 
                  value={newProfileName}
                  onChange={e => setNewProfileName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-slate-50/50 focus:bg-white text-sm"
                  placeholder="e.g. Frontend Dev (React)"
                />
              </div>
              
              <div>
                <label className="block mb-1.5 font-medium text-slate-700 text-sm">Target Role</label>
                <input 
                  type="text" 
                  value={newProfileRole}
                  onChange={e => setNewProfileRole(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-slate-50/50 focus:bg-white text-sm"
                  placeholder="e.g. Senior Frontend Engineer"
                />
              </div>

              <div>
                <label className="block mb-1.5 font-medium text-slate-700 text-sm">Core Skills (comma separated)</label>
                <input 
                  type="text" 
                  value={newProfileSkills}
                  onChange={e => setNewProfileSkills(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-slate-50/50 focus:bg-white text-sm"
                  placeholder="e.g. React, TypeScript, Node.js"
                />
              </div>

              <div>
                <label className="block mb-1.5 font-medium text-slate-700 text-sm">Upload Resume (PDF)</label>
                <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 hover:border-indigo-400 transition-colors cursor-pointer group">
                  <input 
                    type="file" 
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center gap-2">
                    <svg className={`w-8 h-8 ${newProfileResume ? 'text-emerald-500' : 'text-slate-400 group-hover:text-indigo-500'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {newProfileResume ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      )}
                    </svg>
                    <span className="text-sm font-medium text-slate-600">
                      {newProfileResume ? 'Resume attached ✅' : 'Click or drag PDF to upload'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6">
                <button 
                  onClick={() => setIsAddingProfile(false)}
                  className="px-5 py-2.5 rounded-xl text-slate-600 font-medium hover:bg-slate-100 transition-colors"
                  disabled={isParsing}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateProfile}
                  disabled={isParsing || !newProfileName || !newProfileRole || !newProfileResume}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isParsing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Parsing Resume...
                    </>
                  ) : (
                    'Create Profile'
                  )}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
