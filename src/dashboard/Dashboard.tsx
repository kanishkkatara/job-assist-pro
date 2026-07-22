import React, { useState } from 'react';
import { useStorageLocal } from '../hooks/useStorage';
import { KanbanBoard } from '../components/KanbanBoard';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SmartInbox } from '../components/SmartInbox';
import { JobDiscovery } from '../components/JobDiscovery';
import { FunnelAnalytics } from '../components/FunnelAnalytics';
import { CandidateProfile, AppSettings } from '../types';
import { ProfileEditor } from '../components/ProfileEditor';
import { Toaster, toast } from 'react-hot-toast';
import { User, Compass, LayoutDashboard, Inbox, LineChart, Settings, Trash2, Eye, X, Pencil, CheckCircle, Upload, FileText, Briefcase, GraduationCap } from 'lucide-react';

export function Dashboard() {
  const [profiles, setProfiles] = useStorageLocal<CandidateProfile[]>('profiles', []);
  const [settings, setSettings] = useStorageLocal<AppSettings>('settings', { apiKey: '', model: 'gpt-4o-mini' });
  const [activeTab, setActiveTab] = useState<'profiles' | 'settings' | 'kanban' | 'ats' | 'interview' | 'inbox' | 'discovery' | 'analytics'>('profiles');
  const [activeProfileId, setActiveProfileId] = useStorageLocal<string | null>('activeProfileId', null);

  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState<CandidateProfile | null>(null);
  const [viewingProfile, setViewingProfile] = useState<CandidateProfile | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileRole, setNewProfileRole] = useState('');
  const [newProfileResume, setNewProfileResume] = useState('');
  const [newProfileFileName, setNewProfileFileName] = useState('');
  const [newProfileSystemPrompt, setNewProfileSystemPrompt] = useState('');
  const [newProfileAdditionalContext, setNewProfileAdditionalContext] = useState('');

  const resetProfileForm = () => {
    setNewProfileName('');
    setNewProfileRole('');
    setNewProfileResume('');
    setNewProfileFileName('');
    setNewProfileSystemPrompt('');
    setNewProfileAdditionalContext('');
    setJsonImportContent('');
    setImportMode('form');
    setIsAddingProfile(false);
    setEditingProfile(null);
  };

  const openEditProfile = (e: React.MouseEvent, profile: CandidateProfile) => {
    e.stopPropagation();
    setEditingProfile(profile);
    setNewProfileName(profile.name);
    setNewProfileRole(profile.targetRole);
    setNewProfileResume(profile.resumeBase64 || '');
    setNewProfileFileName(profile.resumeFileName || '');
    setNewProfileSystemPrompt(profile.systemPrompt || '');
    setNewProfileAdditionalContext(profile.additionalContext || '');
    setImportMode('form');
    setIsAddingProfile(true);
  };

  const updateSettings = (key: keyof AppSettings, value: string) => {
    setSettings({ ...settings, [key]: value });
    toast.success('Settings saved automatically');
  };

  const deleteProfile = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this profile?')) {
      const newProfiles = profiles.filter(p => p.id !== id);
      setProfiles(newProfiles);
      if (activeProfileId === id) {
        setActiveProfileId(newProfiles.length > 0 ? newProfiles[0].id : null);
      }
      toast.success('Profile deleted');
      if (newProfiles.length === 0) setWizardStep(1);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewProfileFileName(file.name);
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
  const [importMode, setImportMode] = useState<'form' | 'json'>('form');
  const [jsonImportContent, setJsonImportContent] = useState('');

  const extractTextFromPDF = async (base64Data: string) => {
    const res = await fetch('http://localhost:3000/api/extract-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64: base64Data })
    });
    if (!res.ok) throw new Error('Failed to extract text from PDF');
    const data = await res.json();
    return data.text;
  };

  const handleSaveFullProfile = (profile: CandidateProfile) => {
    if (editingProfile) {
      setProfiles(profiles.map(p => p.id === editingProfile.id ? profile : p));
      toast.success('Profile updated!');
    } else {
      setProfiles([...profiles, profile]);
      if (!activeProfileId) setActiveProfileId(profile.id);
      toast.success('Profile created!');
    }
    resetProfileForm();
  };

  const handleCreateProfile = async () => {
    if (importMode === 'json') {
      try {
        const parsed = JSON.parse(jsonImportContent);
        if (!parsed.name || !parsed.targetRole) {
          throw new Error('JSON must include at least "name" and "targetRole" fields.');
        }
        const importedProfile: CandidateProfile = {
          id: editingProfile ? editingProfile.id : Date.now().toString(),
          name: parsed.name,
          targetRole: parsed.targetRole,
          skills: parsed.skills || [],
          experience: parsed.experience || [],
          education: parsed.education || [],
          personalInfo: parsed.personalInfo || {},
          summary: parsed.summary || '',
          additionalContext: parsed.additionalContext || '',
          systemPrompt: parsed.systemPrompt || '',
          resumeBase64: parsed.resumeBase64 || '',
          resumeFileName: parsed.resumeFileName || ''
        };
        if (editingProfile) {
          setProfiles(profiles.map(p => p.id === editingProfile.id ? importedProfile : p));
          toast.success('Profile updated!');
        } else {
          setProfiles([...profiles, importedProfile]);
          if (!activeProfileId) setActiveProfileId(importedProfile.id);
          toast.success('Profile imported successfully!');
        }
        resetProfileForm();
        return;
      } catch (err: any) {
        toast.error(`Invalid JSON: ${err.message}`);
        return;
      }
    }

    if (!newProfileName || !newProfileRole) {
      toast.error('Please enter a profile name and target role');
      return;
    }

    setIsParsing(true);
    let parsedData: Partial<CandidateProfile> = {};

    try {
      if (newProfileResume && settings.apiKey) {
        toast.loading('Parsing resume with AI...', { id: 'parse-toast' });
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
          parsedData = {
            skills: data.skills || [],
            experience: data.experience || [],
            education: data.education || [],
            personalInfo: data.personalInfo || {},
            summary: data.summary || '',
          };
          toast.success('Resume parsed — all fields extracted!', { id: 'parse-toast' });
        } else {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to parse resume');
        }
      }
    } catch (e: any) {
      console.error('Parsing error', e);
      toast.error(`Parse error: ${e.message}`, { id: 'parse-toast' });
    }

    if (editingProfile) {
      // Edit mode: merge parsed data over existing, but keep manual name/role
      const updatedProfile: CandidateProfile = {
        ...editingProfile,
        name: newProfileName,
        targetRole: newProfileRole,
        resumeBase64: newProfileResume || editingProfile.resumeBase64,
        resumeFileName: newProfileFileName || editingProfile.resumeFileName,
        systemPrompt: newProfileSystemPrompt,
        additionalContext: newProfileAdditionalContext,
        ...(Object.keys(parsedData).length > 0 ? parsedData : {}),
      };
      setProfiles(profiles.map(p => p.id === editingProfile.id ? updatedProfile : p));
      toast.success('Profile updated!');
    } else {
      const newProfile: CandidateProfile = {
        id: Date.now().toString(),
        name: newProfileName,
        targetRole: newProfileRole,
        skills: parsedData.skills || [],
        experience: parsedData.experience || [],
        education: parsedData.education || [],
        personalInfo: parsedData.personalInfo || {},
        summary: parsedData.summary || '',
        resumeBase64: newProfileResume,
        resumeFileName: newProfileFileName,
      };
      setProfiles([...profiles, newProfile]);
      if (!activeProfileId) setActiveProfileId(newProfile.id);
      toast.success(newProfileResume ? 'Profile created & resume parsed!' : 'Profile created!');
    }

    setIsParsing(false);
    const wasFirstProfile = profiles.length === 0 && !editingProfile;
    resetProfileForm();
    if (wasFirstProfile) setWizardStep(3);
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      <Toaster position="top-right" />
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 p-6 flex flex-col">
        <h1 className="text-xl font-bold tracking-tight mb-8 text-neutral-900">JobAssist Pro</h1>
        <nav className="flex flex-col gap-1.5 flex-1" role="tablist">
          <button 
            role="tab"
            aria-selected={activeTab === 'profiles'}
            onClick={() => setActiveTab('profiles')}
            className={`flex items-center gap-3 text-left px-3 py-2 rounded-md transition-colors text-sm font-medium ${activeTab === 'profiles' ? 'bg-gray-100 text-neutral-900' : 'text-gray-600 hover:bg-gray-50 hover:text-neutral-900'}`}
          >
            <User size={18} className={activeTab === 'profiles' ? 'text-neutral-900' : 'text-gray-400'} />
            Profiles
          </button>
          <button 
            role="tab"
            aria-selected={activeTab === 'discovery'}
            onClick={() => setActiveTab('discovery')}
            className={`flex items-center gap-3 text-left px-3 py-2 rounded-md transition-colors text-sm font-medium ${activeTab === 'discovery' ? 'bg-gray-100 text-neutral-900' : 'text-gray-600 hover:bg-gray-50 hover:text-neutral-900'}`}
          >
            <Compass size={18} className={activeTab === 'discovery' ? 'text-neutral-900' : 'text-gray-400'} />
            Discovery
          </button>
          <button 
            role="tab"
            aria-selected={activeTab === 'kanban'}
            onClick={() => setActiveTab('kanban')}
            className={`flex items-center gap-3 text-left px-3 py-2 rounded-md transition-colors text-sm font-medium ${activeTab === 'kanban' ? 'bg-gray-100 text-neutral-900' : 'text-gray-600 hover:bg-gray-50 hover:text-neutral-900'}`}
          >
            <LayoutDashboard size={18} className={activeTab === 'kanban' ? 'text-neutral-900' : 'text-gray-400'} />
            Tracker
          </button>
          <button 
            role="tab"
            aria-selected={activeTab === 'inbox'}
            onClick={() => setActiveTab('inbox' as any)}
            className={`flex items-center gap-3 text-left px-3 py-2 rounded-md transition-colors text-sm font-medium ${activeTab === 'inbox' as any ? 'bg-gray-100 text-neutral-900' : 'text-gray-600 hover:bg-gray-50 hover:text-neutral-900'}`}
          >
            <Inbox size={18} className={activeTab === 'inbox' ? 'text-neutral-900' : 'text-gray-400'} />
            Smart Inbox
          </button>
          <button 
            role="tab"
            aria-selected={activeTab === 'analytics'}
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-3 text-left px-3 py-2 rounded-md transition-colors text-sm font-medium ${activeTab === 'analytics' ? 'bg-gray-100 text-neutral-900' : 'text-gray-600 hover:bg-gray-50 hover:text-neutral-900'}`}
          >
            <LineChart size={18} className={activeTab === 'analytics' ? 'text-neutral-900' : 'text-gray-400'} />
            Analytics
          </button>
          
          <div className="mt-auto">
            <button 
              role="tab"
              aria-selected={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-3 w-full text-left px-3 py-2 rounded-md transition-colors text-sm font-medium ${activeTab === 'settings' ? 'bg-gray-100 text-neutral-900' : 'text-gray-600 hover:bg-gray-50 hover:text-neutral-900'}`}
            >
              <Settings size={18} className={activeTab === 'settings' ? 'text-neutral-900' : 'text-gray-400'} />
              Settings
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
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Profiles</h2>
              <button 
                onClick={() => setIsAddingProfile(true)}
                className="bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
              >
                + New Profile
              </button>
            </div>
            {profiles.length === 0 || wizardStep === 3 ? (
              <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-8">
                <div className="bg-indigo-600 px-8 py-6 text-white">
                  <h3 className="text-2xl font-bold mb-2">Welcome to JobAssist Pro! 🎉</h3>
                  <p className="text-indigo-100">Let's get your AI job assistant set up in 3 quick steps.</p>
                </div>
                
                <div className="p-8">
                  {/* Progress Indicator */}
                  <div className="flex items-center justify-between mb-8">
                    {[1, 2, 3].map(step => (
                      <div key={step} className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${wizardStep >= step ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          {step}
                        </div>
                        {step < 3 && <div className={`w-24 h-1 mx-2 rounded ${wizardStep > step ? 'bg-indigo-600' : 'bg-slate-100'}`} />}
                      </div>
                    ))}
                  </div>

                  {wizardStep === 1 && (
                    <div className="animate-in fade-in slide-in-from-right-4">
                      <h4 className="text-xl font-bold text-slate-800 mb-4">Step 1: Connect OpenAI</h4>
                      <p className="text-slate-600 mb-6">We use your local API key to power the AI features securely. Your key never leaves your browser.</p>
                      <input 
                        type="password" 
                        value={settings.apiKey || ''} 
                        onChange={(e) => updateSettings('apiKey', e.target.value)}
                        className="w-full p-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none mb-6"
                        placeholder="sk-..."
                      />
                      <button 
                        onClick={() => setWizardStep(2)}
                        disabled={!settings.apiKey}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
                      >
                        Continue
                      </button>
                    </div>
                  )}

                  {wizardStep === 2 && (
                    <div className="animate-in fade-in slide-in-from-right-4">
                      <h4 className="text-xl font-bold text-slate-800 mb-4">Step 2: Upload Your Master Resume</h4>
                      <p className="text-slate-600 mb-6">Upload your PDF. We'll parse your work experience into structured data so we can perfectly tailor your applications.</p>
                      
                      <button 
                        onClick={() => setIsAddingProfile(true)}
                        className="w-full border-2 border-dashed border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-600 px-6 py-12 rounded-2xl font-bold transition-all flex flex-col items-center justify-center gap-4 mb-6"
                      >
                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Create Profile & Upload PDF
                      </button>
                    </div>
                  )}

                  {wizardStep === 3 && (
                    <div className="animate-in fade-in slide-in-from-right-4 text-center py-8">
                      <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h4 className="text-2xl font-bold text-slate-800 mb-4">You're All Set!</h4>
                      <p className="text-slate-600 mb-8 max-w-sm mx-auto">Your resume has been parsed. You can now use the Chrome extension on any job board to capture JDs, tailor resumes, and run mock interviews.</p>
                      
                      <button 
                        onClick={() => setWizardStep(4)} // 4 hides the wizard and shows the standard profile grid
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-all w-full shadow-lg shadow-indigo-600/30"
                      >
                        Go to Dashboard
                      </button>
                    </div>
                  )}
                </div>
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
                    className={`bg-white p-5 rounded-lg border transition-all duration-200 cursor-pointer group ${
                      activeProfileId === p.id 
                        ? 'border-neutral-900 shadow-sm ring-1 ring-neutral-900' 
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col gap-1 min-w-0 pr-2">
                        <h3 className="text-base font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors truncate">{p.name}</h3>
                        <p className="text-slate-500 text-sm">{p.targetRole}</p>
                        {activeProfileId === p.id && (
                          <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold tracking-wide w-fit">ACTIVE</span>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button 
                          onClick={(e) => openEditProfile(e, p)}
                          className="text-gray-400 hover:text-amber-500 hover:bg-amber-50 p-1.5 rounded-md transition-colors"
                          title="Edit Profile"
                        >
                          <Pencil size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setViewingProfile(p); }}
                          className="text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-md transition-colors"
                          title="View Profile"
                        >
                          <Eye size={14} />
                        </button>
                        <button 
                          onClick={(e) => deleteProfile(e, p.id)}
                          className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                          title="Delete Profile"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 mt-3 mb-3 text-xs text-slate-500">
                      {(p.experience?.length || 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <Briefcase size={11} /> {p.experience.length} role{p.experience.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {(p.education?.length || 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <GraduationCap size={11} /> {(p.education as any[])[0]?.institution || 'Education'}
                        </span>
                      )}
                      {p.resumeBase64 && (
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <FileText size={11} /> Resume
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {(p.skills || []).slice(0, 4).map(skill => (
                        <span key={skill} className="px-2 py-0.5 bg-slate-50 text-slate-600 ring-1 ring-slate-200 rounded-md text-xs font-medium">{skill}</span>
                      ))}
                      {(p.skills || []).length > 4 && (
                        <span className="px-2 py-0.5 bg-slate-50 text-slate-500 ring-1 ring-slate-200 rounded-md text-xs">+{p.skills.length - 4} more</span>
                      )}
                      {(p.skills || []).length === 0 && (
                        <span className="text-xs text-slate-400 italic">No skills parsed yet</span>
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
            
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 mt-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Integrations</h3>
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm">
                    <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Gmail Smart Sync</h4>
                    <p className="text-sm text-gray-500">Auto-detect interview invites and rejections.</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    chrome.identity.getAuthToken({ interactive: true }, (token) => {
                      if (chrome.runtime.lastError) {
                        toast.error('Failed to connect Gmail. Check your Client ID in manifest.json.');
                      } else {
                        toast.success('Successfully connected to Gmail!');
                      }
                    });
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm text-sm"
                >
                  Connect Gmail
                </button>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'discovery' as any && (
          <div role="tabpanel" className="h-full">
            <JobDiscovery />
          </div>
        )}
        
        {activeTab === 'inbox' as any && (
          <div role="tabpanel" className="h-full">
            <SmartInbox />
          </div>
        )}

        {activeTab === 'analytics' as any && (
          <div role="tabpanel" className="h-full">
            <FunnelAnalytics />
          </div>
        )}
        </ErrorBoundary>
      </main>
      {/* Profile Creation / Edit Modal */}
      {isAddingProfile && importMode === 'form' && (
        <ProfileEditor
          initialProfile={editingProfile}
          settings={settings}
          onSave={handleSaveFullProfile}
          onCancel={resetProfileForm}
        />
      )}

      {isAddingProfile && importMode === 'json' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl ring-1 ring-slate-200 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-8 pt-8 pb-4 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">
                JSON Import
              </h3>
              <div className="flex items-center gap-2">
                <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
                  <button 
                    onClick={() => setImportMode('form')}
                    className="px-3 py-1.5 text-xs font-bold rounded-md transition-colors text-slate-500 hover:text-slate-700"
                  >
                    Form
                  </button>
                  <button 
                    onClick={() => setImportMode('json')}
                    className="px-3 py-1.5 text-xs font-bold rounded-md transition-colors bg-white text-indigo-600 shadow-sm"
                  >
                    JSON Import
                  </button>
                </div>
                <button onClick={resetProfileForm} className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 pb-4 pt-4">
              <div className="space-y-3">
                <div>
                  <label className="block mb-1.5 font-medium text-slate-700 text-sm">Paste Profile JSON</label>
                  <p className="text-xs text-slate-500 mb-2">Paste a complete JSON profile (e.g. from <code className="bg-slate-100 px-1 rounded">fde_profile.json</code>) with personalInfo, systemPrompt, experience, etc.</p>
                  <textarea 
                    value={jsonImportContent}
                    onChange={e => setJsonImportContent(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-slate-50/50 focus:bg-white text-xs font-mono h-56 resize-none"
                    placeholder={'{ "name": "FDE Role", "targetRole": "Forward Deployed Engineer", ... }'}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-8 py-5 border-t border-slate-100 shrink-0">
              <button 
                onClick={resetProfileForm}
                className="px-5 py-2.5 rounded-xl text-slate-600 font-medium hover:bg-slate-100 transition-colors text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateProfile}
                disabled={!jsonImportContent}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
              >
                Import Profile
              </button>
            </div>
          </div>
        </div>
      )}
      {/* View Profile Modal */}
      {viewingProfile && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl ring-1 ring-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
              <div>
                <h3 className="text-2xl font-bold text-slate-800">{viewingProfile.name}</h3>
                <p className="text-indigo-600 font-medium">{viewingProfile.targetRole}</p>
                {viewingProfile.resumeFileName && (
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <FileText size={11} /> {viewingProfile.resumeFileName}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={(e) => { setViewingProfile(null); openEditProfile(e, viewingProfile); }}
                  className="text-gray-400 hover:text-amber-500 hover:bg-amber-50 p-2 rounded-lg transition-colors flex items-center gap-1.5 text-sm font-medium"
                  title="Edit Profile"
                >
                  <Pencil size={16} /> Edit
                </button>
                <button 
                  onClick={() => setViewingProfile(null)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Personal Info */}
              {viewingProfile.personalInfo && Object.keys(viewingProfile.personalInfo).filter(k => viewingProfile.personalInfo[k]).length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Contact & Personal Info</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    {Object.entries(viewingProfile.personalInfo).filter(([, v]) => v).map(([key, value]) => (
                      <div key={key} className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="truncate text-xs" title={String(value)}>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills */}
              {(viewingProfile.skills?.length || 0) > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingProfile.skills.map(s => (
                      <span key={s} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-medium border border-indigo-100">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              {viewingProfile.summary && (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Professional Summary</h4>
                  <p className="text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm">{viewingProfile.summary}</p>
                </div>
              )}

              {/* Experience */}
              {(viewingProfile.experience?.length || 0) > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Experience</h4>
                  <div className="space-y-5">
                    {viewingProfile.experience.map((exp: any, i: number) => {
                      // Normalize both data formats: fde_profile (startDate/endDate/description) and parsed AI (date/bullets)
                      const dateStr = exp.date || (exp.startDate ? `${exp.startDate} – ${exp.endDate || 'Present'}` : '');
                      const bodyContent = exp.description
                        ? <p className="text-gray-600 text-sm leading-relaxed">{exp.description}</p>
                        : Array.isArray(exp.bullets) && exp.bullets.length > 0
                          ? <ul className="list-disc pl-5 space-y-1.5 text-gray-600 text-sm">{exp.bullets.map((b: string, j: number) => <li key={j} className="leading-relaxed">{b}</li>)}</ul>
                          : null;
                      return (
                        <div key={i} className="relative pl-5 border-l-2 border-indigo-100">
                          <div className="absolute w-2.5 h-2.5 bg-indigo-400 rounded-full -left-[7px] top-1.5 ring-4 ring-white"></div>
                          <div className="flex items-center justify-between">
                            <h5 className="font-bold text-gray-900">{exp.title}</h5>
                            <span className="text-xs text-gray-400">{dateStr}</span>
                          </div>
                          <p className="text-indigo-600 text-sm font-medium mb-2">{exp.company}</p>
                          {bodyContent}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Education */}
              {(viewingProfile.education?.length || 0) > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Education</h4>
                  <div className="space-y-2">
                    {(viewingProfile.education as any[]).map((edu, i) => (
                      <div key={i} className="flex justify-between items-start bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{edu.degree}</p>
                          <p className="text-indigo-600 text-xs">{edu.institution}</p>
                          {edu.gpa && <p className="text-gray-400 text-xs">GPA: {edu.gpa}</p>}
                        </div>
                        <span className="text-xs text-gray-400">{edu.year}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* System Prompt */}
              {viewingProfile.systemPrompt && (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">System Prompt</h4>
                  <p className="text-gray-700 text-xs leading-relaxed bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">{viewingProfile.systemPrompt}</p>
                </div>
              )}

              {/* Additional Context */}
              {viewingProfile.additionalContext && (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Additional Context</h4>
                  <p className="text-gray-700 text-sm leading-relaxed bg-amber-50/50 p-4 rounded-xl border border-amber-100 whitespace-pre-wrap">{viewingProfile.additionalContext}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

