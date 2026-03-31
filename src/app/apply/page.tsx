'use client';

import { useState, FormEvent, ChangeEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { Applicant } from '@/lib/types';

export default function ApplyPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    job_title: '',
    years_experience: '',
    cover_letter: '',
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        setError('Please upload a PDF file.');
        return;
      }
      setResumeFile(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Upload resume PDF to Supabase Storage
      let resumeUrl: string | null = null;

      if (resumeFile) {
        const fileExt = resumeFile.name.split('.').pop();
        const fileName = `${Date.now()}-${formData.name.replace(/\s+/g, '_')}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(fileName, resumeFile);

        if (uploadError) {
          throw new Error(`Resume upload failed: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('resumes')
          .getPublicUrl(uploadData.path);

        resumeUrl = urlData.publicUrl;
      }

      // 2. Insert row into applicants table
      const { data: applicant, error: insertError } = await supabase
        .from('applicants')
        .insert({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          job_title: formData.job_title,
          years_experience: parseInt(formData.years_experience) || 0,
          cover_letter: formData.cover_letter,
          resume_url: resumeUrl,
          status: 'new',
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to submit application: ${insertError.message}`);
      }

      // 3. Call POST /api/screen with applicantId
      const screenResponse = await fetch('/api/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicantId: applicant.id }),
      });

      if (!screenResponse.ok) {
        console.warn('AI screening request failed, but application was submitted.');
      }

      // 4. Show success state
      setIsSubmitted(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center px-4">
        <div className="w-full max-w-lg text-center">
          <div className="mb-6">
            <span className="text-2xl font-bold text-white tracking-tight">
              RECRUIT<span className="text-[#FF6B35]">.AI</span>
            </span>
          </div>
          <div className="bg-[#242424] rounded-2xl border border-[#333333] p-8 md:p-12">
            <div className="w-16 h-16 bg-[#FF6B35]/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Application Submitted!</h2>
            <p className="text-gray-400 text-base leading-relaxed">
              Our AI is reviewing your profile. You will hear from us soon.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-3xl font-bold text-white tracking-tight">
            RECRUIT<span className="text-[#FF6B35]">.AI</span>
          </span>
          <p className="text-gray-400 mt-2 text-sm">AI-Powered Recruitment Platform</p>
        </div>

        {/* Form Card */}
        <div className="bg-[#242424] rounded-2xl border border-[#333333] p-6 md:p-10">
          <h1 className="text-xl font-semibold text-white mb-1">Apply Now</h1>
          <p className="text-gray-400 text-sm mb-8">Fill in your details below to submit your application.</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-6">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name & Email row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Full Name <span className="text-[#FF6B35]">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="w-full bg-[#1a1a1a] border border-[#333333] rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#FF6B35] focus:ring-1 focus:ring-[#FF6B35] transition-colors"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Email <span className="text-[#FF6B35]">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                  className="w-full bg-[#1a1a1a] border border-[#333333] rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#FF6B35] focus:ring-1 focus:ring-[#FF6B35] transition-colors"
                />
              </div>
            </div>

            {/* Phone & Job Title row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Phone <span className="text-[#FF6B35]">*</span>
                </label>
                <input
                  type="text"
                  id="phone"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 (555) 000-0000"
                  className="w-full bg-[#1a1a1a] border border-[#333333] rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#FF6B35] focus:ring-1 focus:ring-[#FF6B35] transition-colors"
                />
              </div>
              <div>
                <label htmlFor="job_title" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Current Job Title <span className="text-[#FF6B35]">*</span>
                </label>
                <input
                  type="text"
                  id="job_title"
                  name="job_title"
                  required
                  value={formData.job_title}
                  onChange={handleChange}
                  placeholder="Senior Software Engineer"
                  className="w-full bg-[#1a1a1a] border border-[#333333] rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#FF6B35] focus:ring-1 focus:ring-[#FF6B35] transition-colors"
                />
              </div>
            </div>

            {/* Years of Experience */}
            <div className="max-w-[200px]">
              <label htmlFor="years_experience" className="block text-sm font-medium text-gray-300 mb-1.5">
                Years of Experience <span className="text-[#FF6B35]">*</span>
              </label>
              <input
                type="number"
                id="years_experience"
                name="years_experience"
                required
                min="0"
                max="50"
                value={formData.years_experience}
                onChange={handleChange}
                placeholder="5"
                className="w-full bg-[#1a1a1a] border border-[#333333] rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#FF6B35] focus:ring-1 focus:ring-[#FF6B35] transition-colors"
              />
            </div>

            {/* Cover Letter */}
            <div>
              <label htmlFor="cover_letter" className="block text-sm font-medium text-gray-300 mb-1.5">
                Cover Letter <span className="text-[#FF6B35]">*</span>
              </label>
              <textarea
                id="cover_letter"
                name="cover_letter"
                required
                rows={6}
                value={formData.cover_letter}
                onChange={handleChange}
                placeholder="Tell us about yourself and why you're a great fit for this role..."
                className="w-full bg-[#1a1a1a] border border-[#333333] rounded-lg px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#FF6B35] focus:ring-1 focus:ring-[#FF6B35] transition-colors resize-vertical"
              />
            </div>

            {/* Resume Upload */}
            <div>
              <label htmlFor="resume" className="block text-sm font-medium text-gray-300 mb-1.5">
                Resume (PDF)
              </label>
              <div className="relative">
                <input
                  type="file"
                  id="resume"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="resume"
                  className="flex items-center justify-center gap-2 w-full bg-[#1a1a1a] border border-dashed border-[#444444] rounded-lg px-4 py-4 text-gray-400 text-sm cursor-pointer hover:border-[#FF6B35] hover:text-gray-300 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {resumeFile ? resumeFile.name : 'Click to upload your resume (PDF)'}
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#FF6B35] hover:bg-[#e85a25] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg text-sm transition-colors mt-2"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting Application...
                </span>
              ) : (
                'Submit Application'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-xs mt-6">
          By submitting, you agree to our privacy policy. Your data is processed securely.
        </p>
      </div>
    </div>
  );
}
