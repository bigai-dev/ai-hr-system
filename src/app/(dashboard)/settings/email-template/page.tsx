'use client';

import { useState, useRef, useCallback } from 'react';
import TopBar from '@/components/TopBar';

const DYNAMIC_VARIABLES = [
  '{Candidate_Name}',
  '{Job_Title}',
  '{Interview_Link}',
  '{Recruiter_Name}',
  '{Company_Name}',
  '{Scheduling_URL}',
];

const SAMPLE_DATA: Record<string, string> = {
  '{Candidate_Name}': 'John Doe',
  '{Job_Title}': 'Senior Product Designer',
  '{Interview_Link}': 'https://meet.google.com/abc-defg-hij',
  '{Recruiter_Name}': 'Sarah Mitchell',
  '{Company_Name}': 'AI Screening Inc.',
  '{Scheduling_URL}': 'https://recruit.ai/schedule/jd-2948',
};

const DEFAULT_SUBJECT = 'Next Steps: Interview for {Job_Title} with AI Screening Inc.';
const DEFAULT_BODY = `Dear {Candidate_Name},

We are impressed with your background and would like to invite you to the next stage of our selection process for the {Job_Title} position.

Our AI Screening platform has identified you as a strong match for this role. To move forward, please use the link below to schedule a time for your initial technical screening call:

{Scheduling_URL}

The call will last approximately 30 minutes and will be conducted via Google Meet.

Best regards,
The Recruitment Team`;

function replaceVarsWithHighlight(text: string): React.ReactNode[] {
  const parts = text.split(/(\{[^}]+\})/g);
  return parts.map((part, i) => {
    if (part.match(/^\{[^}]+\}$/) && SAMPLE_DATA[part]) {
      return (
        <span key={i} className="text-[#FF6B35] font-semibold bg-[#FF6B35]/10 px-0.5 rounded">
          {SAMPLE_DATA[part]}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function replaceVarsPlain(text: string): string {
  let result = text;
  for (const [key, value] of Object.entries(SAMPLE_DATA)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

export default function EmailTemplatePage() {
  const [templateName, setTemplateName] = useState('Interview Invitation');
  const [category, setCategory] = useState('Interview Scheduling');
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = useCallback((variable: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newBody = body.substring(0, start) + variable + body.substring(end);
      setBody(newBody);
      // Restore cursor position after the inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      setBody((prev) => prev + variable);
    }
  }, [body]);

  const previewSubject = replaceVarsPlain(subject);

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="SETTINGS: EMAIL TEMPLATE EDITOR" />
      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-6 h-full">
          {/* Left side - Editor */}
          <div className="flex-1 min-w-0">
            {/* Breadcrumb */}
            <div className="text-xs text-gray-500 dark:text-[#9ca3af] mb-4">
              <span className="hover:text-gray-900 dark:hover:text-white cursor-pointer">Settings</span>
              <span className="mx-2">/</span>
              <span className="text-gray-900 dark:text-white">Email Template</span>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-bold">Template Configuration</h2>
              <p className="text-sm text-gray-500 dark:text-[#9ca3af] mt-1">
                Customize automated email templates sent to candidates during the hiring pipeline
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

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase tracking-wider mb-2">
                  Email Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333333] rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                />
              </div>

              {/* Dynamic Variables */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase tracking-wider mb-2">
                  Dynamic Variables (Click to Insert)
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

              {/* Email Body */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <label className="text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase tracking-wider">
                    Email Body
                  </label>
                  <span className="text-[10px] font-semibold bg-[#FF6B35]/15 text-[#FF6B35] px-2 py-0.5 rounded uppercase tracking-wider">
                    HTML Supported
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
                  <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-500 dark:text-[#9ca3af] hover:text-gray-900 dark:hover:text-white transition-colors underline text-sm">
                    U
                  </button>
                  <div className="w-px h-5 bg-gray-200 dark:bg-[#333333] mx-1" />
                  <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-500 dark:text-[#9ca3af] hover:text-gray-900 dark:hover:text-white transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-500 dark:text-[#9ca3af] hover:text-gray-900 dark:hover:text-white transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333333] rounded-b-lg px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#FF6B35] transition-colors resize-none font-mono leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* Right side - Preview */}
          <div className="w-[480px] flex-shrink-0">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-[#10b981] rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase tracking-wider">
                Desktop Live Preview
              </span>
            </div>

            {/* Mock browser window */}
            <div className="bg-[#1a1a1a] border border-[#333333] rounded-xl overflow-hidden">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#333333] bg-[#0d0d0d]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                  <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                  <div className="w-3 h-3 rounded-full bg-[#10b981]" />
                </div>
                <div className="flex-1 mx-3 bg-[#242424] rounded-md px-3 py-1.5 text-xs text-[#9ca3af] truncate">
                  mail.recruitment-app.io/viewer/preview-829
                </div>
              </div>

              {/* Email preview content */}
              <div className="p-5">
                {/* Subject */}
                <div className="mb-4">
                  <div className="text-xs text-[#9ca3af] uppercase tracking-wider mb-1">Subject</div>
                  <div className="text-sm font-semibold">{replaceVarsWithHighlight(subject)}</div>
                </div>

                {/* Sender info */}
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#333333]">
                  <div className="w-9 h-9 rounded-full bg-[#FF6B35] flex items-center justify-center text-white text-xs font-bold">
                    HR
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Recruitment Team</div>
                    <div className="text-xs text-[#9ca3af]">no-reply@ai-screening.com</div>
                  </div>
                </div>

                {/* Email body */}
                <div className="text-sm leading-relaxed space-y-3">
                  {body.split('\n\n').map((paragraph, i) => {
                    if (!paragraph.trim()) return null;
                    // Check if paragraph is the scheduling URL variable
                    if (paragraph.trim() === '{Scheduling_URL}') {
                      return (
                        <div key={i} className="py-2">
                          <a href="#" className="inline-block bg-[#FF6B35] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#e85a25] transition-colors no-underline">
                            Schedule Interview Call
                          </a>
                        </div>
                      );
                    }
                    return (
                      <p key={i} className="text-[#e0e0e0]">
                        {replaceVarsWithHighlight(paragraph)}
                      </p>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-[#333333]">
                  <p className="text-[11px] text-[#9ca3af] leading-relaxed">
                    This call will last approximately 30 minutes. Please ensure you have a stable internet connection and a quiet environment. If you need to reschedule, use the link above.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
