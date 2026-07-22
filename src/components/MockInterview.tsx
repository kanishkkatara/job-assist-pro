import React, { useState, useRef, useEffect } from 'react';
import { useStorageSession, useStorageLocal } from '../hooks/useStorage';
import { CandidateProfile, JobDescription, AppSettings } from '../types';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { z } from 'zod';
import { InterviewAnalytics } from './InterviewAnalytics';

export function MockInterview() {
  const [jd] = useStorageSession<JobDescription | null>('currentJD', null);
  const [profiles] = useStorageLocal<CandidateProfile[]>('profiles', []);
  const [activeProfileId] = useStorageLocal<string | null>('activeProfileId', null);
  const [settings] = useStorageLocal<AppSettings>('settings', { apiKey: '', model: 'gpt-4o-mini' });

  const activeProfile = profiles.find(p => p.id === activeProfileId);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [sessionTranscripts, setSessionTranscripts] = useState<{question: string, answer: string}[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = React.useRef<any>(null);

  // Cleanup speech recognition on unmount to prevent memory leaks and hot mics
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // 1. Hook for generating questions
  const { 
    object: questionsObject, 
    submit: fetchQuestions, 
    isLoading: isLoadingQuestions 
  } = useObject({
    api: 'http://localhost:3000/api/object',
    schema: z.object({ questions: z.array(z.string()) }),
    fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${settings.apiKey}` }
    })
  });

  const questions = questionsObject?.questions || [];

  const handleGenerateQuestions = () => {
    if (!jd || !activeProfile || !settings.apiKey) return;
    setCurrentQuestionIndex(0);
    setUserAnswer('');
    setSessionTranscripts([]);
    setIsComplete(false);
    
    const prompt = `You are an expert technical recruiter. Based on this job description and candidate profile, generate exactly 5 behavioral interview questions tailored to the role. Ensure they require STAR (Situation, Task, Action, Result) format answers.
    
    Job Title: ${jd.title}
    Company: ${jd.company}
    Job Details: ${jd.text}
    Candidate Skills: ${(activeProfile.skills || []).join(', ')}`;
    
    fetchQuestions({ 
      model: settings.model || 'gpt-4o-mini', 
      schemaId: 'mock-questions',
      messages: [{ role: 'user', content: prompt }] 
    });
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + ' ';
            }
          }
          if (finalTranscript) {
            setUserAnswer(prev => (prev ? prev.trim() + ' ' : '') + finalTranscript.trim());
          }
        };
        recognition.onerror = () => setIsRecording(false);
        recognition.onend = () => setIsRecording(false);
        
        recognition.start();
        recognitionRef.current = recognition;
        setIsRecording(true);
      } else {
        alert('Web Speech API is not supported in this browser.');
      }
    }
  };

  if (!jd) {
    return (
      <div className="p-8 bg-slate-50 rounded-2xl ring-1 ring-slate-200 text-center text-slate-500 max-w-4xl mx-auto shadow-sm">
        Capture a Job Description first to start a mock interview.
      </div>
    );
  }

  if (isComplete) {
    return (
      <InterviewAnalytics 
        transcripts={sessionTranscripts} 
        settings={settings}
        onReset={() => {
          setIsComplete(false);
          setSessionTranscripts([]);
          setCurrentQuestionIndex(0);
          setUserAnswer('');
        }}
      />
    );
  }
  return (
    <div className="bg-white p-8 rounded-2xl ring-1 ring-slate-200 shadow-sm flex flex-col h-full max-w-4xl mx-auto">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-slate-800 mb-2">🎤 STAR Mock Interview</h3>
        <p className="text-slate-500">
          Roleplay for <strong className="text-slate-800">{jd.title}</strong> at <strong className="text-slate-800">{jd.company}</strong>
        </p>
      </div>

      {questions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 ring-1 ring-indigo-200 rounded-full p-6">
              <svg className="w-12 h-12 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
          </div>
          <p className="text-lg text-slate-600 mb-6 max-w-md">
            Ready to practice? I'll generate 5 behavioral questions tailored to this job description and your profile.
          </p>
          <button 
            onClick={handleGenerateQuestions} 
            disabled={isLoadingQuestions}
            className="bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white px-4 py-2 rounded-md font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 flex items-center gap-2"
          >
            {isLoadingQuestions ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Generating Questions...
              </>
            ) : 'Start Mock Interview'}
          </button>
        </div>
      ) : (
        <QuestionBlock 
          key={currentQuestionIndex}
          question={questions[currentQuestionIndex] || ''}
          index={currentQuestionIndex}
          total={questions.length}
          initialUserAnswer={userAnswer}
          setUserAnswer={setUserAnswer}
          isRecording={isRecording}
          toggleRecording={toggleRecording}
          settings={settings}
          onNext={() => {
            setSessionTranscripts(prev => [
              ...prev, 
              { question: questions[currentQuestionIndex] || '', answer: userAnswer }
            ]);
            if (currentQuestionIndex < questions.length - 1) {
              setCurrentQuestionIndex(prev => prev + 1);
              setUserAnswer('');
            } else {
              setIsComplete(true);
            }
          }}
        />
      )}
    </div>
  );
}

function QuestionBlock({ 
  question, index, total, initialUserAnswer, setUserAnswer, isRecording, toggleRecording, settings, onNext 
}: { 
  question: string, index: number, total: number, initialUserAnswer: string, setUserAnswer: (s: string) => void, isRecording: boolean, toggleRecording: () => void, settings: AppSettings, onNext: () => void 
}) {
  const [localAnswer, setLocalAnswer] = useState(initialUserAnswer);

  // Update parent state when local changes (useful for recording appends)
  useEffect(() => {
    setLocalAnswer(initialUserAnswer);
  }, [initialUserAnswer]);

  const handleTextChange = (val: string) => {
    setLocalAnswer(val);
    setUserAnswer(val);
  };

  const {
    object: feedbackObject,
    submit: fetchFeedback,
    isLoading: isLoadingFeedback
  } = useObject({
    api: 'http://localhost:3000/api/object',
    schema: z.object({
      situation: z.string(),
      task: z.string(),
      action: z.string(),
      result: z.string(),
      critique: z.string(),
      betterVersion: z.string()
    }),
    fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${settings.apiKey}` }
    })
  });

  const handleSubmitAnswer = () => {
    if (!localAnswer.trim() || !settings.apiKey) return;
    
    if (isRecording) toggleRecording();

    const prompt = `You are an expert interview coach. Grade the following answer to the interview question using the STAR method.
    Question: ${question}
    Candidate's Answer: ${localAnswer}`;
    
    fetchFeedback({ 
      model: settings.model || 'gpt-4o-mini', 
      schemaId: 'star-critique',
      messages: [{ role: 'user', content: prompt }] 
    });
  };

  const feedback = feedbackObject;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto pr-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-sm font-bold text-indigo-600 mb-2 uppercase tracking-widest">
        Question {index + 1} of {total}
      </div>
      <div className="text-2xl text-slate-800 font-medium mb-8 leading-snug">
        {question}
      </div>

      {!feedbackObject && !isLoadingFeedback ? (
        <div className="flex flex-col gap-4">
          <label htmlFor="answerInput" className="sr-only">Your Answer</label>
          <div className="relative">
            <textarea 
              id="answerInput"
              value={localAnswer}
              onChange={e => handleTextChange(e.target.value)}
              placeholder="Type your answer here or click the microphone to speak..."
              className="w-full min-h-[200px] p-4 pb-14 rounded-2xl border border-slate-300 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none resize-y transition-all text-slate-700 bg-slate-50/50 focus:bg-white shadow-inner"
            />
            <button
              onClick={toggleRecording}
              className={`absolute bottom-4 right-4 flex items-center justify-center gap-2 p-2 px-3 rounded-full shadow-sm border transition-all ${isRecording ? 'bg-white border-rose-200 text-rose-500' : 'bg-white border-gray-200 text-gray-400 hover:text-neutral-900 hover:border-gray-300'}`}
              title={isRecording ? 'Stop Recording' : 'Start Dictation'}
            >
              {isRecording && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <button 
            onClick={handleSubmitAnswer} 
            disabled={!localAnswer.trim()}
            className="self-start bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
          >
            Submit Answer for Feedback
          </button>
        </div>
      ) : (
        <div className="bg-slate-50/50 p-6 rounded-2xl ring-1 ring-slate-200 animate-in fade-in duration-500">
          <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            Feedback {isLoadingFeedback && <svg className="animate-spin h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
          </h4>
          <div className="flex flex-col gap-3 text-slate-700">
            <div className="flex"><strong className="w-24 shrink-0 text-slate-900">Situation:</strong> <span>{feedback?.situation || <span className="text-slate-400">...</span>}</span></div>
            <div className="flex"><strong className="w-24 shrink-0 text-slate-900">Task:</strong> <span>{feedback?.task || <span className="text-slate-400">...</span>}</span></div>
            <div className="flex"><strong className="w-24 shrink-0 text-slate-900">Action:</strong> <span>{feedback?.action || <span className="text-slate-400">...</span>}</span></div>
            <div className="flex"><strong className="w-24 shrink-0 text-slate-900">Result:</strong> <span>{feedback?.result || <span className="text-slate-400">...</span>}</span></div>
            
            <div className="mt-4 pt-4 border-t border-slate-200">
              <strong className="block text-slate-900 mb-1">Critique:</strong> 
              <span className={!feedback?.critique ? "text-slate-400" : ""}>{feedback?.critique || '...'}</span>
            </div>
            
            <div className="mt-4 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 p-5 rounded-xl ring-1 ring-emerald-100/50 shadow-sm">
              <strong className="block text-emerald-900 mb-2">Better Version:</strong>
              <div className={`italic text-emerald-800 ${!feedback?.betterVersion ? "text-emerald-300" : ""}`}>
                {feedback?.betterVersion || '...'}
              </div>
            </div>
          </div>
          
          {!isLoadingFeedback && (
            <button 
              onClick={onNext} 
              disabled={index >= total - 1}
              className="mt-8 bg-gradient-to-r from-indigo-500 to-violet-600 disabled:from-slate-300 disabled:to-slate-400 disabled:text-slate-500 text-white px-6 py-3 rounded-xl font-medium shadow-md transition-all focus:ring-2 focus:ring-indigo-500 focus:outline-none w-full sm:w-auto hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] disabled:transform-none"
            >
              {index >= total - 1 ? 'Interview Complete 🎉' : 'Next Question ➔'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
