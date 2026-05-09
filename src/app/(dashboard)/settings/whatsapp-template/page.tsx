'use client';

import { useState, useRef, useCallback } from 'react';
import TopBar from '@/components/TopBar';

const DYNAMIC_VARIABLES = [
  '{Candidate_Name}',
  '{Interview_Date}',
  '{Interview_Time}',
  '{Meeting_Link}',
  '{Recruiter_Name}',
  '{Job_Title}',
];

const SAMPLE_DATA: Record<string, string> = {
  '{Candidate_Name}': 'John Doe',
  '{Interview_Date}': 'April 3, 2026',
  '{Interview_Time}': '2:00 PM (SGT)',
  '{Meeting_Link}': 'https://meet.google.com/abc-defg-hij',
  '{Recruiter_Name}': 'Sarah Mitchell',
  '{Job_Title}': 'Senior Product Designer',
};

const DEFAULT_MESSAGE = `Hi {Candidate_Name},

Thanks for applying for the {Job_Title} role! We'd love to schedule a quick screening call with you.

Date: {Interview_Date}
Time: {Interview_Time}

Join here: {Meeting_Link}

Best regards,
The Recruitment Team`;

function replaceVarsWithHighlight(text: string): React.ReactNode[] {
  const parts = text.split(/(\{[^}]+\})/g);
  return parts.map((part, i) => {
    if (part.match(/^\{[^}]+\}$/) && SAMPLE_DATA[part]) {
      return (
        <span key={i} className="text-[#FF6B35] font-semibold">
          {SAMPLE_DATA[part]}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function WhatsAppTemplatePage() {
  const [templateName, setTemplateName] = useState('Interview Scheduling Call');
  const [category, setCategory] = useState('Interview Scheduling');
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = useCallback((variable: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newMessage = message.substring(0, start) + variable + message.substring(end);
      setMessage(newMessage);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      setMessage((prev) => prev + variable);
    }
  }, [message]);

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="SETTINGS: WHATSAPP TEMPLATE EDITOR" />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex flex-col lg:flex-row gap-6 h-full">
          {/* Left side - Editor */}
          <div className="flex-1 min-w-0">
            {/* Breadcrumb */}
            <div className="text-xs text-gray-500 dark:text-[#9ca3af] mb-4">
              <span className="hover:text-gray-900 dark:hover:text-white cursor-pointer">Settings</span>
              <span className="mx-2">/</span>
              <span className="text-gray-900 dark:text-white">WhatsApp Template</span>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-bold">Template Configuration</h2>
              <p className="text-sm text-gray-500 dark:text-[#9ca3af] mt-1">
                Customize automated WhatsApp messages sent to candidates during the hiring pipeline
              </p>
            </div>

            <div className="space-y-5">
              {/* Template Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase tracking-wider mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333333] rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase tracking-wider mb-2">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333333] rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#FF6B35] transition-colors appearance-none cursor-pointer"
                >
                  <option>Interview Scheduling</option>
                  <option>Application Received</option>
                  <option>Rejection</option>
                  <option>Offer Letter</option>
                </select>
              </div>

              {/* Dynamic Variables */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase tracking-wider mb-2">
                  Insert Dynamic Variables
                </label>
                <div className="flex flex-wrap gap-2">
                  {DYNAMIC_VARIABLES.map((v) => (
                    <button
                      key={v}
                      onClick={() => insertVariable(v)}
                      className="bg-[#FF6B35]/15 text-[#FF6B35] border border-[#FF6B35]/30 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-[#FF6B35]/25 transition-colors cursor-pointer"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Content */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <label className="text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase tracking-wider">
                    Message Content
                  </label>
                  <span className="text-[10px] font-semibold bg-[#10b981]/15 text-[#10b981] px-2 py-0.5 rounded uppercase tracking-wider">
                    Supports Rich Text
                  </span>
                </div>
                {/* Toolbar */}
                <div className="flex items-center gap-1 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333333] border-b-0 rounded-t-lg px-3 py-2">
                  <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-500 dark:text-[#9ca3af] hover:text-gray-900 dark:hover:text-white transition-colors font-bold text-sm">
                    B
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-500 dark:text-[#9ca3af] hover:text-gray-900 dark:hover:text-white transition-colors italic text-sm">
                    I
                  </button>
                  <div className="w-px h-5 bg-gray-200 dark:bg-[#333333] mx-1" />
                  <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-500 dark:text-[#9ca3af] hover:text-gray-900 dark:hover:text-white transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-500 dark:text-[#9ca3af] hover:text-gray-900 dark:hover:text-white transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </button>
                </div>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={12}
                  className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333333] rounded-b-lg px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#FF6B35] transition-colors resize-none font-mono leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* Right side - Phone Preview */}
          <div className="w-[380px] flex-shrink-0">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-[#10b981] rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase tracking-wider">
                Live Preview
              </span>
            </div>

            {/* Phone frame */}
            <div className="mx-auto w-[320px]">
              <div className="bg-[#0d0d0d] rounded-[2.5rem] p-3 border border-[#333333] shadow-2xl">
                {/* Notch */}
                <div className="flex justify-center mb-1">
                  <div className="w-28 h-6 bg-[#0d0d0d] rounded-b-2xl relative z-10">
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 w-16 h-4 bg-[#1a1a1a] rounded-full" />
                  </div>
                </div>

                {/* Status bar */}
                <div className="flex items-center justify-between px-5 py-1 text-[10px] text-[#9ca3af]">
                  <span className="font-semibold">9:41</span>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 00-6 0zm-4-4l2 2a7.074 7.074 0 0110 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
                    </svg>
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z" />
                    </svg>
                  </div>
                </div>

                {/* WhatsApp screen */}
                <div className="bg-[#0b141a] rounded-2xl overflow-hidden mt-1" style={{ minHeight: 520 }}>
                  {/* WhatsApp header */}
                  <div className="bg-[#1f2c34] px-3 py-2.5 flex items-center gap-3">
                    <svg className="w-5 h-5 text-[#9ca3af]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <div className="w-8 h-8 rounded-full bg-[#FF6B35]/20 flex items-center justify-center text-[#FF6B35] text-xs font-bold">
                      JD
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">Candidate Name</div>
                      <div className="text-[10px] text-[#10b981]">online</div>
                    </div>
                    <div className="flex items-center gap-3 text-[#9ca3af]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="5" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="19" r="2" />
                      </svg>
                    </div>
                  </div>

                  {/* Chat area */}
                  <div className="px-3 py-4" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,107,53,0.03) 0%, transparent 50%)' }}>
                    {/* Date chip */}
                    <div className="flex justify-center mb-4">
                      <div className="bg-[#1f2c34] text-[#9ca3af] text-[10px] font-medium px-3 py-1 rounded-lg uppercase tracking-wider">
                        Today
                      </div>
                    </div>

                    {/* Chat bubble */}
                    <div className="flex justify-end">
                      <div className="max-w-[85%] bg-[#005c4b] rounded-xl rounded-tr-sm px-3 py-2 relative">
                        <div className="text-[13px] leading-relaxed text-[#e9edef] whitespace-pre-line">
                          {message.split('\n').map((line, i) => (
                            <span key={i}>
                              {replaceVarsWithHighlight(line)}
                              {i < message.split('\n').length - 1 && <br />}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[10px] text-[#9ca3af]">14:02</span>
                          <svg className="w-4 h-3 text-[#53bdeb]" viewBox="0 0 16 11" fill="currentColor">
                            <path d="M11.071.653a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 00-.336-.146.47.47 0 00-.343.146l-.311.31a.445.445 0 00-.14.337c0 .136.047.25.14.343l2.996 2.996a.724.724 0 00.514.2.676.676 0 00.515-.222l6.704-8.25a.454.454 0 00.108-.312.453.453 0 00-.108-.312l-.46-.426zm-2.323 7.18" />
                            <path d="M15.071.653a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-6.19 7.636-1.2-1.134-.311.31 1.791 1.791a.724.724 0 00.514.2.676.676 0 00.515-.222l6.704-8.25a.454.454 0 00.108-.312.453.453 0 00-.108-.312l-.46-.426z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Input bar */}
                  <div className="px-2 py-2 flex items-center gap-2 mt-auto">
                    <div className="flex-1 bg-[#1f2c34] rounded-full px-4 py-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#9ca3af]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs text-[#9ca3af]">Message</span>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Home indicator */}
                <div className="flex justify-center mt-2">
                  <div className="w-28 h-1 bg-[#333333] rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
