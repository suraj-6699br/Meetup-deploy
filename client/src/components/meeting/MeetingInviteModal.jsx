import React, { useState } from 'react';
import { CheckIcon, CopyIcon, Share2Icon, XIcon, UsersIcon } from 'lucide-react';
import toast from 'react-hot-toast';

const MeetingInviteModal = ({ meetingId, isOpen, onClose, participantCount = 1 }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  if (!isOpen || !meetingId) return null;

  const meetingUrl = `${window.location.origin}/meeting/${meetingId}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(meetingUrl);
      setCopiedLink(true);
      toast.success("Meeting link copied!");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(meetingId);
      setCopiedId(true);
      toast.success("Meeting ID copied!");
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      toast.error("Failed to copy ID");
    }
  };

  const shareOnWhatsApp = () => {
    const text = encodeURIComponent(
      `Join my video meeting on MeetUp!\n\nLink: ${meetingUrl}\nMeeting ID: ${meetingId}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs sm:items-end sm:justify-start sm:p-6 pointer-events-none">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 pointer-events-auto transform transition-all animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Your meeting is ready</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Share this info with others you want in the meeting
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Dismiss"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Status Badge */}
        {participantCount <= 1 && (
          <div className="mt-3.5 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
            </span>
            <span className="text-xs font-medium text-blue-800">
              Waiting for others to join... Take your time to share!
            </span>
          </div>
        )}

        {/* Meeting Link Field */}
        <div className="mt-4 space-y-2">
          <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
            Joining Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={meetingUrl}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-mono outline-none select-all"
            />
            <button
              onClick={copyLink}
              className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              {copiedLink ? <CheckIcon className="w-3.5 h-3.5 text-white" /> : <CopyIcon className="w-3.5 h-3.5" />}
              <span>{copiedLink ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>

        {/* Meeting ID Field & WhatsApp Button */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={copyId}
            className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            {copiedId ? <CheckIcon className="w-3.5 h-3.5 text-emerald-600" /> : <CopyIcon className="w-3.5 h-3.5" />}
            <span>ID: {meetingId}</span>
          </button>

          <button
            onClick={shareOnWhatsApp}
            className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Share2Icon className="w-3.5 h-3.5" />
            <span>Share WhatsApp</span>
          </button>
        </div>

        {/* Footer Warning / Note */}
        <p className="mt-3.5 text-[11px] text-slate-500 leading-relaxed text-center">
          💡 Keep this tab open while sharing. When friends click the link, they will appear automatically.
        </p>
      </div>
    </div>
  );
};

export default MeetingInviteModal;
