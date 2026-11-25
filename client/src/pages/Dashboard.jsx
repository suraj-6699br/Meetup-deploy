import React, { useEffect, useState } from 'react'
import {ArrowRightIcon, CheckIcon, CopyIcon, KeyboardIcon, PlusIcon, Share2Icon, ShieldCheckIcon, VideoIcon, XIcon} from "lucide-react"
import {useNavigate} from 'react-router-dom'
import toast from "react-hot-toast";
import { useAuth, useUser } from '@clerk/react';
import api from '../config/api.js';

const Dashboard = () => {

  const {user} = useUser();
  const userName = user.fullName;
  const userEmail = user.primaryEmailAddress.emailAddress;

  const {isLoaded, isSignedIn, getToken} = useAuth()

  const navigate = useNavigate()
  const [isCreating, setIsCreating] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [stats, setStats] = useState(null)

  const [joinId, setJoinId] = useState("")
  const [createdMeeting, setCreatedMeeting] = useState(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedId, setCopiedId] = useState(false)

  useEffect(()=>{
    const timer = setInterval(()=> setCurrentTime(new Date()), 1000);
    return ()=> clearInterval(timer)
  },[])

  useEffect(()=>{
    const fetchStats = async () => {
      if (!isLoaded || !isSignedIn) return;

      try {
        const token = await getToken();
        const { data } = await api.get("/api/meetings/stats", {
          headers: { Authorization: `Bearer ${token}` },
        })
        setStats(data)
      } catch (error) {
        toast.error(error.response?.data?.error || error.message)
      }
    };
    fetchStats();
  },[isLoaded, isSignedIn, getToken])

  const handleCreateMeeting = async () =>{
    if(!isLoaded || !isSignedIn) return;
    setIsCreating(true)
   
    try {
      const token = await getToken();
      const res = await api.post("/api/meetings", { title: `${userName}'s Meeting` }, {
        headers: { Authorization: `Bearer ${token}`, },
      })

      const meetingData = res.data.meeting;
      setCreatedMeeting(meetingData);
      toast.success("Meeting created! Share the link or join now.");
    } catch (error) {
      toast.error(error.response?.data?.error || error.message);
    }finally{
      setIsCreating(false)
    }

  }

  const handleJoinMeeting = async (e) =>{
    e.preventDefault();
    const cleanId = joinId.trim();
    if (!/^[a-z]{3}(?:-[a-z]{3}){2}$/.test(cleanId)){
      toast.error("Please enter a valid Meeting ID");
      return;
    }

   try {
    const token = await getToken();
    await api.get(`/api/meetings/${cleanId}`, {headers: { Authorization: `Bearer ${token}`,}})
    navigate(`/meeting/${cleanId}`);
   } catch (error) {
    const errorMsg = error.response?.data?.error || "Meeting not found. Check the ID and try again.";
    toast.error(errorMsg);
   }
  }

  const meetingUrl = createdMeeting ? `${window.location.origin}/meeting/${createdMeeting.meetingId}` : "";

  const handleCopyLink = async () => {
    if (!meetingUrl) return;
    try {
      await navigator.clipboard.writeText(meetingUrl);
      setCopiedLink(true);
      toast.success("Meeting link copied!");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleCopyId = async () => {
    if (!createdMeeting) return;
    try {
      await navigator.clipboard.writeText(createdMeeting.meetingId);
      setCopiedId(true);
      toast.success("Meeting ID copied!");
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      toast.error("Failed to copy ID");
    }
  };

  const handleShareWhatsApp = () => {
    if (!createdMeeting) return;
    const text = encodeURIComponent(
      `Join my video meeting on MeetUp!\n\nLink: ${meetingUrl}\nMeeting ID: ${createdMeeting.meetingId}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  return (
    <div className='flex-1 max-w-7xl w-full mx-auto p-6 md:p-12 flex flex-col justify-center'>
      <div className='grid grid-cols-1 lg:grid-cols-12 gap-12 items-center'>
        {/* Left Column - Actions */}
        <div className='lg:col-span-7 space-y-8'>

          <div className='space-y-3'>
            <div className='inline-flex items-center gap-2 px-3.5 pr-6 py-2 rounded-full bg-white/25 text-xs font-medium'>
              <ShieldCheckIcon size={16}/>
              Secure Peer-to-Peer Encryption 
            </div>
            <h1 className='text-4xl sm:text-5xl text-slate-800 leading-tight font-medium'>
              High quality video calls. <br />
              <span className='text-primary'>Built for everyone.</span>
            </h1>
            <p className='text-slate-700 text-base sm:text-lg max-w-xl leading-relaxed'>
              Connect, collaborate, and celebrate from anywhere with ultra-low latency video, screen sharing, and real-time chat.
            </p>

            <div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2'>
              <button onClick={handleCreateMeeting}
              disabled={isCreating}
              className='bg-primary hover:bg-primary-hover text-white font-medium px-6 py-3.5 rounded-full shadow-md shadow-primary/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50'>
                <PlusIcon className="w-5 h-5"/>
                <span>{isCreating ? "Creating..." : "New Meeting"}</span>
              </button>

              <form onSubmit={handleJoinMeeting} className='flex-1 flex items-center gap-2'>
                <div  className='relative flex-1'>
                    <KeyboardIcon className="w-5 h-5 text-primary/90 absolute left-4 top-1/2 -translate-y-1/2"/>

                    <input type="text" placeholder="Enter meeting code (e.g. abc-def-ghi)" value={joinId} onChange={(e)=>setJoinId(e.target.value)}
                    className='w-full bg-white/75 border border-primary-border/80 focus:border-primary/60 focus:ring-1 focus:ring-primary/60 rounded-full pl-12 pr-4 py-3.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all'/>

                </div>
                <button type='submit'
                disabled={!joinId.trim()}
                className='bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-white font-medium px-6 py-3.5 rounded-full transition-all flex items-center justify-center cursor-pointer shadow-xs'>
                  <span>Join</span>
                  <ArrowRightIcon className="w-4 h-4 ml-1.5" />
                </button>
              </form>
            </div>
          </div>

        </div>

        {/* Right Column - Hero Graphic & Clock Card */}
        <div className='lg:col-span-5 flex flex-col items-center justify-center space-y-4'>
          <div className='w-full bg-white/25 backdrop-blur rounded-4xl p-8 border border-slate-200 text-center space-y-6 relative overflow-hidden'>
            <div className='space-y-1'>
              <p className='mb-5 text-xl text-left'>Hi, <span className='font-medium'>{userName}</span></p>

              <h2 className='text-4xl xl:text-7xl my-4 text-slate-900 tracking-wide'>
                {currentTime.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}
              </h2>
              <p className='font-medium tracking-wider text-primary'>
                  {currentTime.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })}
              </p>
            </div>

            <div className='pt-4 border-t border-white/30 text-sm text-slate-600'>
               <div className='flex items-center justify-between py-6 px-4'>

                <p>Logged in as: <span className="text-slate-900">{userEmail}</span></p>
                
                <span className={`px-4 py-1 rounded-full font-semibold text-xs uppercase ${stats?.plan === "premium" ? "bg-blue-700 text-white" : "bg-white/70 text-slate-800"}`}>
                  {stats?.plan || "Free"}
                </span>

                </div>     
                {stats && (
                  <div className="w-full bg-white/50 rounded-2xl px-5 py-4 border border-slate-100">
                    <div className="flex items-center justify-between text-sm">
                        <span>Monthly Meetings</span>
                        <span className="text-xs text-slate-600 font-mono">
                          {stats.monthlyLimit 
                          ? `${stats.monthlyCount} / ${stats.monthlyLimit} Used`
                          : `${stats.monthlyCount} Created (Unlimited)`}
                        </span>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* Meeting Created Invite Modal */}
      {createdMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <VideoIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Your Meeting is Ready!</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Share with others, then join when ready</p>
                </div>
              </div>
              <button
                onClick={() => setCreatedMeeting(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Close"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Joining Link Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Meeting Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={meetingUrl}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs sm:text-sm text-slate-800 font-mono outline-none select-all"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-3 rounded-2xl bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-primary/20"
                >
                  {copiedLink ? <CheckIcon className="w-4 h-4 text-white" /> : <CopyIcon className="w-4 h-4" />}
                  <span>{copiedLink ? "Copied" : "Copy Link"}</span>
                </button>
              </div>
            </div>

            {/* Code & WhatsApp Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleCopyId}
                className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {copiedId ? <CheckIcon className="w-4 h-4 text-emerald-600" /> : <CopyIcon className="w-4 h-4" />}
                <span>Code: {createdMeeting.meetingId}</span>
              </button>

              <button
                onClick={handleShareWhatsApp}
                className="px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <Share2Icon className="w-4 h-4" />
                <span>Share on WhatsApp</span>
              </button>
            </div>

            {/* Joining Status Info */}
            <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600"></span>
              </span>
              <p className="text-xs text-blue-900 leading-relaxed font-medium">
                The meeting room is live. Take your time to share the link—participants can join whenever they receive it!
              </p>
            </div>

            {/* Primary Action: Join Meeting */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                onClick={() => setCreatedMeeting(null)}
                className="px-5 py-3.5 rounded-full border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-semibold transition-all cursor-pointer"
              >
                Join Later
              </button>

              <button
                onClick={() => navigate(`/meeting/${createdMeeting.meetingId}`)}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-6 py-3.5 rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-slate-900/20"
              >
                <span>Join Meeting Now</span>
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Dashboard