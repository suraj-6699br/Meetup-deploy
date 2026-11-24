import React, { useState } from 'react';
import { CopyIcon, CheckIcon, FileTextIcon, Loader2Icon } from 'lucide-react';
import toast from 'react-hot-toast';

const TranscriptTab = ({ transcript, recordingStatus }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    toast.success("Transcript copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (recordingStatus === "processing") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <Loader2Icon className="w-8 h-8 text-primary animate-spin" />
        <h3 className="text-base font-medium text-slate-800">Processing Audio Transcript...</h3>
        <p className="text-xs text-slate-500 max-w-sm">
          The meeting audio is currently being transcribed with speech-to-text. Please check back in a moment.
        </p>
      </div>
    );
  }

  if (recordingStatus === "failed") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
        <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center">
          <FileTextIcon className="w-5 h-5" />
        </div>
        <p className="text-sm font-medium text-rose-600">Transcription Failed</p>
        <p className="text-xs text-slate-400 max-w-sm">
          Could not transcribe audio for this meeting. Please check API configuration or audio quality.
        </p>
      </div>
    );
  }

  if (!transcript || recordingStatus === "none") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
          <FileTextIcon className="w-5 h-5" />
        </div>
        <p className="text-sm text-slate-500 font-medium">No Transcript Available</p>
        <p className="text-xs text-slate-400">
          This meeting was not recorded or did not have any detectable speech.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Full Speech Transcript
        </span>
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

      <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/70 text-sm text-slate-800 leading-relaxed font-sans whitespace-pre-wrap max-h-96 overflow-y-auto">
        {transcript}
      </div>
    </div>
  );
};

export default TranscriptTab;
