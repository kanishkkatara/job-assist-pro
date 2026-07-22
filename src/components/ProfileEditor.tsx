import React, { useState } from 'react';
import { CandidateProfile, AppSettings } from '../types';
import { X, Upload, CheckCircle, Plus, Trash2, ChevronRight, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getAIHeaders } from '../utils/api';

interface ProfileEditorProps {
  initialProfile?: CandidateProfile | null;
  settings: AppSettings;
  onSave: (profile: CandidateProfile) => void;
  onCancel: () => void;
}

type Tab = 'basic' | 'experience' | 'education' | 'skills';

export function ProfileEditor({ initialProfile, settings, onSave, onCancel }: ProfileEditorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('basic');
  const [isParsing, setIsParsing] = useState(false);
  
  // Draft state
  const [draft, setDraft] = useState<Partial<CandidateProfile>>({
    name: initialProfile?.name || '',
    targetRole: initialProfile?.targetRole || '',
    summary: initialProfile?.summary || '',
    skills: initialProfile?.skills || [],
    experience: initialProfile?.experience || [],
    education: initialProfile?.education || [],
    personalInfo: initialProfile?.personalInfo || {
      fullName: '', email: '', phone: '', location: '', linkedin: '', github: '', website: '', yearsExperience: ''
    },
    systemPrompt: initialProfile?.systemPrompt || '',
    additionalContext: initialProfile?.additionalContext || '',
    resumeBase64: initialProfile?.resumeBase64 || '',
    resumeFileName: initialProfile?.resumeFileName || '',
  });

  const extractTextFromPDF = async (base64Data: string): Promise<string> => {
    const res = await fetch('http://localhost:3000/api/extract-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64: base64Data })
    });
    if (!res.ok) throw new Error('Failed to extract text from PDF');
    const data = await res.json();
    return data.text;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileName = file.name;
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          const base64 = event.target.result as string;
          setDraft(prev => ({ ...prev, resumeBase64: base64, resumeFileName: fileName }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleParseResume = async () => {
    if (!draft.resumeBase64) return toast.error('Please upload a resume first');
    if (!settings.apiKey) return toast.error('Please set your OpenAI API key in settings');

    setIsParsing(true);
    try {
      toast.loading('Extracting data from resume...', { id: 'parse-toast' });
      const resumeText = await extractTextFromPDF(draft.resumeBase64);
      
      const response = await fetch('http://localhost:3000/api/parse-resume', {
        method: 'POST',
        headers: getAIHeaders(settings),
        body: JSON.stringify({ text: resumeText })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Merge parsed data into draft, preferring existing manual inputs for name/role if they exist
        setDraft(prev => ({
          ...prev,
          summary: data.summary || prev.summary,
          skills: data.skills || prev.skills,
          experience: data.experience || prev.experience,
          education: data.education || prev.education,
          personalInfo: {
            ...prev.personalInfo,
            ...data.personalInfo
          }
        }));
        toast.success('Resume data extracted and fields updated!', { id: 'parse-toast' });
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to parse resume');
      }
    } catch (e: any) {
      console.error(e);
      toast.error(`Parse error: ${e.message}`, { id: 'parse-toast' });
    } finally {
      setIsParsing(false);
    }
  };

  const updatePersonalInfo = (field: string, value: string) => {
    setDraft(prev => ({
      ...prev,
      personalInfo: {
        ...(prev.personalInfo || {}),
        [field]: value
      }
    }));
  };

  const updateExperience = (index: number, field: string, value: any) => {
    setDraft(prev => {
      const newExp = [...(prev.experience || [])];
      newExp[index] = { ...newExp[index], [field]: value };
      return { ...prev, experience: newExp };
    });
  };

  const addExperience = () => {
    setDraft(prev => ({
      ...prev,
      experience: [{ title: '', company: '', startDate: '', endDate: '', description: '' }, ...(prev.experience || [])]
    }));
  };

  const removeExperience = (index: number) => {
    setDraft(prev => ({
      ...prev,
      experience: (prev.experience || []).filter((_, i) => i !== index)
    }));
  };

  const updateEducation = (index: number, field: string, value: any) => {
    setDraft(prev => {
      const newEdu = [...(prev.education || [])];
      newEdu[index] = { ...newEdu[index], [field]: value };
      return { ...prev, education: newEdu };
    });
  };

  const addEducation = () => {
    setDraft(prev => ({
      ...prev,
      education: [{ degree: '', institution: '', year: '', gpa: '' }, ...(prev.education || [])]
    }));
  };

  const removeEducation = (index: number) => {
    setDraft(prev => ({
      ...prev,
      education: (prev.education || []).filter((_, i) => i !== index)
    }));
  };

  const handleSave = () => {
    if (!draft.name || !draft.targetRole) {
      return toast.error('Profile Name and Target Role are required');
    }

    const finalProfile: CandidateProfile = {
      id: initialProfile?.id || Date.now().toString(),
      name: draft.name!,
      targetRole: draft.targetRole!,
      skills: draft.skills || [],
      experience: draft.experience || [],
      education: draft.education || [],
      personalInfo: draft.personalInfo || {},
      summary: draft.summary || '',
      resumeBase64: draft.resumeBase64,
      resumeFileName: draft.resumeFileName,
      systemPrompt: draft.systemPrompt,
      additionalContext: draft.additionalContext
    };

    onSave(finalProfile);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl ring-1 ring-slate-200 animate-in fade-in zoom-in-95 duration-200 flex flex-col h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center px-8 pt-8 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-2xl font-bold text-slate-800">
              {initialProfile ? `Edit Profile: ${initialProfile.name}` : 'Create Profile'}
            </h3>
            <p className="text-slate-500 text-sm mt-1">Manage all details for this profile avatar.</p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Two Column Layout */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar Tabs */}
          <div className="w-64 border-r border-slate-100 bg-slate-50/50 p-4 shrink-0 overflow-y-auto">
            <nav className="space-y-1">
              {[
                { id: 'basic', label: 'Basic Info' },
                { id: 'experience', label: 'Experience' },
                { id: 'education', label: 'Education' },
                { id: 'skills', label: 'Skills & AI Context' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    activeTab === tab.id 
                      ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50' 
                      : 'text-slate-600 hover:bg-slate-100/50'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && <ChevronRight size={16} className="text-indigo-400" />}
                </button>
              ))}
            </nav>

            <div className="mt-8 p-4 bg-indigo-50/50 border border-indigo-100/50 rounded-xl">
              <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-2">Resume Auto-Fill</h4>
              <p className="text-xs text-indigo-700/80 mb-3 leading-relaxed">Upload your PDF and let AI populate all these tabs automatically.</p>
              
              <div className="relative mb-3">
                <input 
                  type="file" 
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <button className="w-full bg-white border border-indigo-200 text-indigo-600 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors">
                  {draft.resumeFileName ? <CheckCircle size={16} className="text-emerald-500" /> : <Upload size={16} />}
                  {draft.resumeFileName ? 'Change PDF' : 'Upload PDF'}
                </button>
              </div>
              
              {draft.resumeFileName && (
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 mb-2 truncate px-1" title={draft.resumeFileName}>{draft.resumeFileName}</p>
                  <button 
                    onClick={handleParseResume}
                    disabled={isParsing}
                    className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm"
                  >
                    {isParsing ? (
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      'Parse with AI'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Form Area */}
          <div className="flex-1 overflow-y-auto p-8">
            {activeTab === 'basic' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1.5 text-sm font-semibold text-slate-700">Profile Name *</label>
                    <input 
                      type="text" value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                      placeholder="e.g. FDE Role"
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5 text-sm font-semibold text-slate-700">Target Role *</label>
                    <input 
                      type="text" value={draft.targetRole} onChange={e => setDraft({...draft, targetRole: e.target.value})}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                      placeholder="e.g. Forward Deployed Engineer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 text-sm font-semibold text-slate-700">Professional Summary</label>
                  <textarea 
                    value={draft.summary} onChange={e => setDraft({...draft, summary: e.target.value})} rows={3}
                    className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm resize-y"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-bold text-slate-800 mb-4">Personal Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {['fullName', 'email', 'phone', 'location', 'linkedin', 'github', 'website', 'yearsExperience'].map(field => (
                      <div key={field}>
                        <label className="block mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{field.replace(/([A-Z])/g, ' $1').trim()}</label>
                        <input 
                          type="text" 
                          value={draft.personalInfo?.[field] || ''} 
                          onChange={e => updatePersonalInfo(field, e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'experience' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex justify-between items-center">
                  <h4 className="text-lg font-bold text-slate-800">Work Experience</h4>
                  <button onClick={addExperience} className="text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                    <Plus size={16} /> Add Role
                  </button>
                </div>
                
                <div className="space-y-6">
                  {draft.experience?.map((exp, i) => (
                    <div key={i} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 relative group">
                      <button onClick={() => removeExperience(i)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
                        <Trash2 size={16} />
                      </button>
                      <div className="grid grid-cols-2 gap-4 pr-10 mb-4">
                        <div>
                          <label className="block mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Job Title</label>
                          <input type="text" value={exp.title} onChange={e => updateExperience(i, 'title', e.target.value)} className="w-full p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm bg-white" />
                        </div>
                        <div>
                          <label className="block mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Company</label>
                          <input type="text" value={exp.company} onChange={e => updateExperience(i, 'company', e.target.value)} className="w-full p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm bg-white" />
                        </div>
                        <div>
                          <label className="block mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Start Date</label>
                          <input type="text" value={exp.startDate || exp.date?.split('-')[0] || ''} onChange={e => updateExperience(i, 'startDate', e.target.value)} placeholder="e.g. Jan 2020" className="w-full p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm bg-white" />
                        </div>
                        <div>
                          <label className="block mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">End Date</label>
                          <input type="text" value={exp.endDate || exp.date?.split('-')[1] || ''} onChange={e => updateExperience(i, 'endDate', e.target.value)} placeholder="e.g. Present" className="w-full p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm bg-white" />
                        </div>
                      </div>
                      <div>
                        <label className="block mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description / Bullets</label>
                        <textarea 
                          value={typeof exp.description === 'string' ? exp.description : (Array.isArray(exp.bullets) ? exp.bullets.join('\n') : '')} 
                          onChange={e => updateExperience(i, 'description', e.target.value)} 
                          rows={4}
                          className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm bg-white resize-y leading-relaxed" 
                        />
                      </div>
                    </div>
                  ))}
                  {(!draft.experience || draft.experience.length === 0) && (
                    <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-500 text-sm">
                      No experience added yet. Upload a resume to auto-fill.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'education' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex justify-between items-center">
                  <h4 className="text-lg font-bold text-slate-800">Education</h4>
                  <button onClick={addEducation} className="text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                    <Plus size={16} /> Add Education
                  </button>
                </div>
                
                <div className="space-y-4">
                  {draft.education?.map((edu, i) => (
                    <div key={i} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 relative group">
                      <button onClick={() => removeEducation(i)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
                        <Trash2 size={16} />
                      </button>
                      <div className="grid grid-cols-2 gap-4 pr-10">
                        <div>
                          <label className="block mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Degree / Major</label>
                          <input type="text" value={edu.degree} onChange={e => updateEducation(i, 'degree', e.target.value)} className="w-full p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm bg-white" />
                        </div>
                        <div>
                          <label className="block mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Institution</label>
                          <input type="text" value={edu.institution} onChange={e => updateEducation(i, 'institution', e.target.value)} className="w-full p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm bg-white" />
                        </div>
                        <div>
                          <label className="block mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Year / Dates</label>
                          <input type="text" value={edu.year} onChange={e => updateEducation(i, 'year', e.target.value)} className="w-full p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm bg-white" />
                        </div>
                        <div>
                          <label className="block mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">GPA</label>
                          <input type="text" value={edu.gpa || ''} onChange={e => updateEducation(i, 'gpa', e.target.value)} className="w-full p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm bg-white" />
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!draft.education || draft.education.length === 0) && (
                    <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-500 text-sm">
                      No education added yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'skills' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div>
                  <label className="block mb-1.5 text-sm font-semibold text-slate-700">Skills (comma separated)</label>
                  <textarea 
                    value={(draft.skills || []).join(', ')} 
                    onChange={e => setDraft({...draft, skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} 
                    rows={3}
                    className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm resize-y"
                    placeholder="e.g. React, TypeScript, Node.js"
                  />
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(draft.skills || []).map((s, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium border border-slate-200">{s}</span>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <h4 className="text-lg font-bold text-slate-800 mb-1">AI Context & Settings</h4>
                  <p className="text-xs text-slate-500 mb-4">Instruct the AI on how to represent you.</p>

                  <div className="space-y-4">
                    <div>
                      <label className="block mb-1.5 text-sm font-semibold text-slate-700">System Prompt</label>
                      <textarea
                        value={draft.systemPrompt}
                        onChange={e => setDraft({...draft, systemPrompt: e.target.value})}
                        rows={4}
                        className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-xs font-mono bg-slate-50/50 focus:bg-white resize-none"
                        placeholder="e.g. Write in first person. Be direct and specific. Avoid buzzwords like 'leverage', 'synergy'..."
                      />
                    </div>
                    <div>
                      <label className="block mb-1.5 text-sm font-semibold text-slate-700">Additional Context</label>
                      <textarea
                        value={draft.additionalContext}
                        onChange={e => setDraft({...draft, additionalContext: e.target.value})}
                        rows={3}
                        className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm bg-slate-50/50 focus:bg-white resize-none"
                        placeholder="e.g. I am only targeting early-stage startups. Open to relocation."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center gap-3 px-8 py-5 border-t border-slate-100 shrink-0 bg-gray-50/50 rounded-b-2xl">
          <button onClick={onCancel} className="px-6 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-200 transition-colors text-sm">
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-bold shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98] text-sm"
          >
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
}
