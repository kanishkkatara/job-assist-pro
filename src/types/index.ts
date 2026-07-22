export interface CandidateProfile {
  id: string;
  name: string;
  targetRole: string;
  skills: string[];
  experience: any[];
  education?: any[];
  personalInfo?: any;
  summary: string;
  resumeBase64?: string;
  resumeFileName?: string;
  additionalContext?: string;
  systemPrompt?: string;
}

export interface JobDescription {
  id?: string;
  title: string;
  company: string;
  text: string;
}

export interface AppSettings {
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  openaiKey?: string;
  anthropicKey?: string;
  geminiKey?: string;
  joobleApiKey?: string;
  rapidApiKey?: string; // For JSearch
  jobApiProvider?: 'jsearch' | 'jooble';
  apiKey?: string; // Legacy fallback
}
