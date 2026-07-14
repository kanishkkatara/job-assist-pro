import React, { useEffect, useState } from 'react';
import { getApplications, updateApplicationStatus, ApplicationJob, deleteApplication } from '../utils/db';
import { DndContext, DragEndEvent, useDraggable, useDroppable, closestCorners } from '@dnd-kit/core';
import { toast } from 'react-hot-toast';

const COLUMNS: Array<ApplicationJob['status']> = ['Discovered', 'Applied', 'Interviewing', 'Offered', 'Rejected'];

function DraggableCard({ job, onDelete, onClick }: { job: ApplicationJob, onDelete: (id: string) => void, onClick: (job: ApplicationJob) => void }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: job.id,
    data: { status: job.status }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 999,
  } : undefined;

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onClick(job)}
      className="bg-white p-4 rounded-xl ring-1 ring-slate-200/60 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md hover:ring-slate-300 transition-all group active:scale-95 active:shadow-xl active:shadow-indigo-900/10 active:ring-indigo-500/30 relative"
    >
      <button 
        onClick={(e) => { e.stopPropagation(); onDelete(job.id); }}
        className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Delete"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      <div className="text-sm font-bold text-slate-800 mb-1 pr-6 leading-tight">{job.title}</div>
      <div className="text-xs text-slate-500 font-medium">{job.company}</div>
      <a 
        href={job.url} 
        target="_blank" 
        rel="noreferrer" 
        className="text-xs text-indigo-500 hover:text-indigo-600 font-semibold inline-flex items-center gap-1 group-hover:underline underline-offset-2 mt-3"
        onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking link
        onClick={(e) => e.stopPropagation()} // Prevent card click
      >
        View Job ↗
      </a>
    </div>
  );
}

function DroppableColumn({ status, jobs, onDelete, onCardClick }: { status: ApplicationJob['status'], jobs: ApplicationJob[], onDelete: (id: string) => void, onCardClick: (job: ApplicationJob) => void }) {
  const { isOver, setNodeRef } = useDroppable({
    id: status,
  });

  return (
    <div 
      ref={setNodeRef}
      className={`min-w-[280px] w-[280px] rounded-2xl p-4 flex flex-col transition-all border-2 ${isOver ? 'bg-indigo-50/30 border-indigo-300 shadow-[inset_0_0_20px_rgba(99,102,241,0.05)] ring-2 ring-indigo-500/20' : 'bg-slate-50/50 border-dashed border-slate-200/50'}`}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          {status}
        </h3>
        <span className="bg-white ring-1 ring-slate-200 text-slate-600 text-xs font-bold px-2 py-1 rounded-full shadow-sm">
          {jobs.length}
        </span>
      </div>
      
      <div className="flex flex-col gap-3 flex-1 h-full min-h-[150px]">
        {jobs.map(job => (
          <DraggableCard key={job.id} job={job} onDelete={onDelete} onClick={onCardClick} />
        ))}
        {jobs.length === 0 && (
          <div className="border-2 border-dashed border-slate-200 rounded-xl h-24 flex items-center justify-center text-slate-400 text-sm font-medium">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}



import { AtsMatcher } from './AtsMatcher';
import { MockInterview } from './MockInterview';
import { useStorageSession } from '../hooks/useStorage';

export function KanbanBoard() {
  const [jobs, setJobs] = useState<ApplicationJob[]>([]);
  const isMounted = React.useRef(true);
  const [selectedJob, setSelectedJob] = useState<ApplicationJob | null>(null);
  const [, setCurrentJD] = useStorageSession<any>('currentJD', null);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const fetchJobs = async () => {
    const data = await getApplications();
    if (isMounted.current) setJobs(data);
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id) {
      const jobId = active.id as string;
      const newStatus = over.id as ApplicationJob['status'];
      
      const job = jobs.find(j => j.id === jobId);
      if (job && job.status !== newStatus) {
        // Optimistic update
        setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus } : j));
        
        await updateApplicationStatus(jobId, newStatus);
        
        if (newStatus === 'Interviewing') {
          toast.success('Awesome job landing the interview! 🎉', {
            duration: 5000,
          });
        } else {
          toast.success(`Moved to ${newStatus}`);
        }
        
        await fetchJobs();
      }
    }
  };

  const handleDelete = async (id: string) => {
    // Optimistic update
    setJobs(prev => prev.filter(j => j.id !== id));
    await deleteApplication(id);
    toast.success('Application removed');
    if (selectedJob?.id === id) setSelectedJob(null);
    await fetchJobs();
  };

  const handleCardClick = (job: ApplicationJob) => {
    setSelectedJob(job);
    setCurrentJD({ title: job.title, company: job.company, text: job.jdText });
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <div className="flex justify-between items-center mb-6 px-2">
        <h2 className="text-3xl font-bold text-slate-800">Application Tracker</h2>
      </div>
      
      <div className="flex gap-6 overflow-x-auto pb-6 flex-1 items-start px-2">
        <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          {COLUMNS.map(status => (
            <DroppableColumn 
              key={status} 
              status={status} 
              jobs={jobs.filter(j => j.status === status)} 
              onDelete={handleDelete}
              onCardClick={handleCardClick}
            />
          ))}
        </DndContext>
      </div>

      {/* Slide-out Panel */}
      <div 
        className={`absolute top-0 right-0 w-[800px] max-w-full h-full bg-white shadow-2xl ring-1 ring-slate-200 transform transition-transform duration-500 ease-in-out z-50 flex flex-col ${selectedJob ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {selectedJob && (
          <>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{selectedJob.title}</h2>
                <p className="text-slate-500 font-medium">{selectedJob.company}</p>
              </div>
              <button 
                onClick={() => setSelectedJob(null)}
                className="text-slate-400 hover:text-slate-600 bg-white ring-1 ring-slate-200 hover:ring-slate-300 rounded-full p-2 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-12">
              <section>
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <AtsMatcher />
                </div>
              </section>

              <section>
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <MockInterview />
                </div>
              </section>

              <section>
                <h3 className="text-lg font-bold text-slate-800 mb-4 px-2">Job Description</h3>
                <div className="bg-slate-50 p-6 rounded-2xl ring-1 ring-slate-200 text-sm text-slate-700 whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                  {selectedJob.jdText || 'No job description saved.'}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
      
      {/* Backdrop */}
      {selectedJob && (
        <div 
          className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setSelectedJob(null)}
        />
      )}
    </div>
  );
}
