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
}

export interface JobDescription {
  title: string;
  company: string;
  text: string;
}

export interface AppSettings {
  apiKey: string;
  model: string;
}
