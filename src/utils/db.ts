import { openDB, DBSchema } from 'idb';

export interface ApplicationJob {
  id: string; // The URL or a UUID
  title: string;
  company: string;
  url: string;
  status: 'Discovered' | 'Applied' | 'Interviewing' | 'Offered' | 'Rejected';
  jdText: string;
  capturedAt: number;
  
  atsScore?: number;
  missingKeywords?: string[];
  coverLetter?: string;
  mockInterviewFeedback?: Array<{ question: string, feedback: string }>;
}

interface JobAssistDB extends DBSchema {
  applications: {
    key: string;
    value: ApplicationJob;
    indexes: { 'by-status': string };
  };
}

const DB_NAME = 'JobAssistDB';
const DB_VERSION = 1;

export const initDB = async () => {
  return openDB<JobAssistDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('applications')) {
        const store = db.createObjectStore('applications', { keyPath: 'id' });
        store.createIndex('by-status', 'status');
      }
    },
  });
};

export const addApplication = async (job: ApplicationJob) => {
  const db = await initDB();
  return db.put('applications', job);
};

export const getApplications = async (): Promise<ApplicationJob[]> => {
  const db = await initDB();
  return db.getAll('applications');
};

export const updateApplicationStatus = async (id: string, status: ApplicationJob['status']) => {
  const db = await initDB();
  const tx = db.transaction('applications', 'readwrite');
  const store = tx.objectStore('applications');
  const job = await store.get(id);
  if (job) {
    job.status = status;
    await store.put(job);
  }
  await tx.done;
};

export const deleteApplication = async (id: string) => {
  const db = await initDB();
  return db.delete('applications', id);
};
