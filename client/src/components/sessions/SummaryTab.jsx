import React, { useState } from 'react';
import { SparklesIcon, CopyIcon, CheckIcon, Loader2Icon } from 'lucide-react';
import toast from 'react-hot-toast';

const SummaryTab = ({ summary, recordingStatus }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    toast.success("Summary copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (recordingStatus === "processing") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <Loader2Icon className="w-8 h-8 text-primary animate-spin" />
        <h3 className="text-base font-medium text-slate-800">Generating AI Summary...</h3>
        <p className="text-xs text-slate-500 max-w-sm">
          Audio is being transcribed and summarized by AI. Check back in a moment!
        </p>
      </div>
    );
  }

  if (recordingStatus === "failed") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
        <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center">
          <SparklesIcon className="w-5 h-5" />
        </div>
        <p className="text-sm font-medium text-rose-600">AI Summary Unavailable</p>
        <p className="text-xs text-slate-400 max-w-sm">
          The summary could not be created because recording or transcription was incomplete.
        </p>
      </div>
    );
  }

  if (!summary || recordingStatus === "none") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
          <SparklesIcon className="w-5 h-5" />
        </div>
        <p className="text-sm text-slate-500 font-medium">No Summary Available</p>
        <p className="text-xs text-slate-400">
          This meeting does not have an AI summary. Meetings must have audio speech to generate summaries.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
          <SparklesIcon className="w-4 h-4 text-primary" />
          <span>Key Meeting Insights</span>
        </div>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700">Copied</span>
            </>
          ) : (
            <>
              <CopyIcon className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="bg-gradient-to-br from-indigo-50/50 via-slate-50/70 to-emerald-50/40 rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="text-sm text-slate-800 leading-relaxed font-sans whitespace-pre-wrap max-h-96 overflow-y-auto">
          {summary}
        </div>
      </div>
    </div>
  );
};

export default SummaryTab;
