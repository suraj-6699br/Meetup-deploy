import React, { useState } from 'react'
import { XIcon, SparklesIcon, FileTextIcon, MessageSquareIcon, UsersIcon } from 'lucide-react'
import SessionChatTab from './SessionChatTab';
import SessionParticipantsTab from './SessionParticipantsTab';
import TranscriptTab from './TranscriptTab';
import SummaryTab from './SummaryTab';

const SessionDetailModal = ({session, onClose}) => {

  const initialTab = session?.summary || session?.recordingStatus === "done" ? "summary" : "chat";
  const [activeTab, setActiveTab] = useState(initialTab);

  if(!session) return null;

  const isEnded = session.status === "ended";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-150">

        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md">ID: {session.meetingId}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                isEnded ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"
              }`}>
                {isEnded ? "Ended" : "Active"}
              </span>
              {session.recordingStatus === 'done' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200/60">
                  <SparklesIcon className="w-2.5 h-2.5" /> AI Summary Ready
                </span>
              )}
            </div>
            <h2 className='text-2xl font-medium text-slate-900 mt-1'>{session.title || "Meeting Details"}</h2>
            <p className='text-xs text-slate-400 mt-1'>
              Host: {session.host?.name || "Host"} • Created {new Date(session.createdAt).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose}
          className='p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer' aria-label="Close session details">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-100 px-6 bg-slate-50/50 overflow-x-auto">
            <button onClick={()=> setActiveTab("summary")}
              className={`py-3 px-4 font-medium text-sm border-b-2 cursor-pointer transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === "summary" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              <SparklesIcon className="w-4 h-4" />
              <span>AI Summary</span>
            </button>

            <button onClick={()=> setActiveTab("transcript")}
              className={`py-3 px-4 font-medium text-sm border-b-2 cursor-pointer transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === "transcript" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              <FileTextIcon className="w-4 h-4" />
              <span>Transcript</span>
            </button>

            <button onClick={()=> setActiveTab("chat")}
              className={`py-3 px-4 font-medium text-sm border-b-2 cursor-pointer transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === "chat" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              <MessageSquareIcon className="w-4 h-4" />
              <span>In-Room Chat ({session.messages?.length || 0})</span>
            </button>

            <button onClick={()=> setActiveTab("participants")}
              className={`py-3 px-4 font-medium text-sm border-b-2 cursor-pointer transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === "participants" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              <UsersIcon className="w-4 h-4" />
              <span>Participants ({session.participants?.length || 0})</span>
            </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-6 overflow-y-auto min-h-75">
              {activeTab === 'summary' && (
                <SummaryTab summary={session.summary} recordingStatus={session.recordingStatus} />
              )}
              {activeTab === 'transcript' && (
                <TranscriptTab transcript={session.transcript} recordingStatus={session.recordingStatus} />
              )}
              {activeTab === 'chat' && (
                <SessionChatTab messages={session.messages}/>
              )}
              {activeTab === 'participants' && (
                <SessionParticipantsTab participants={session.participants} host={session.host}/>
              )}
        </div>

      </div>
    </div>
  )
}

export default SessionDetailModal
