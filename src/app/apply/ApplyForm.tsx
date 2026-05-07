'use client';

import { useState, FormEvent, ChangeEvent } from 'react';
import type { Job } from '@/lib/types';

interface Props {
  jobs: Pick<Job, 'id' | 'title'>[];
}

export default function ApplyForm({ jobs }: Props) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    job_title: '',
    job_id: jobs[0]?.id ?? '',
    years_experience: '',
    cover_letter: '',
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const MAX_RESUME_BYTES = 5 * 1024 * 1024;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        setError('Please upload a PDF file.');
        return;
      }
      if (file.size > MAX_RESUME_BYTES) {
        const mb = (file.size / 1024 / 1024).toFixed(1);
        setError(`Resume must be 5 MB or smaller. Yours is ${mb} MB.`);
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
      const submission = new FormData();
      submission.append('name', formData.name);
      submission.append('email', formData.email);
      submission.append('phone', formData.phone);
      submission.append('job_title', formData.job_title);
      submission.append('job_id', formData.job_id);
      submission.append('years_experience', formData.years_experience);
      submission.append('cover_letter', formData.cover_letter);
      if (resumeFile) submission.append('resume', resumeFile);

      const res = await fetch('/api/applications', {
        method: 'POST',
        body: submission,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Submission failed. Please try again.');
      }

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-lg text-center">
          <div className="mb-6">
            <span className="text-2xl font-bold text-gray-900 tracking-tight">
              RECRUIT<span className="text-accent">.AI</span>
            </span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-8 md:p-12">
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Application Submitted!</h2>
            <p className="text-gray-500 text-base leading-relaxed">
              Our AI is reviewing your profile. You will hear from us soon.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-lg text-center">
          <div className="mb-6">
            <span className="text-2xl font-bold text-gray-900 tracking-tight">
              RECRUIT<span className="text-accent">.AI</span>
            </span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-8 md:p-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No open roles right now</h2>
            <p className="text-gray-500 text-sm">Check back soon — we&apos;ll have new positions posted.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-3xl font-bold text-gray-900 tracking-tight">
            RECRUIT<span className="text-accent">.AI</span>
          </span>
          <p className="text-gray-500 mt-2 text-sm">AI-Powered Recruitment Platform</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-10">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Apply Now</h1>
          <p className="text-gray-500 text-sm mb-8">Fill in your details below to submit your application.</p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Position applying for */}
            <div>
              <label htmlFor="job_id" className="block text-sm font-medium text-gray-700 mb-1.5">
                Position Applying For <span className="text-accent">*</span>
              </label>
              <select
                id="job_id"
                name="job_id"
                required
                value={formData.job_id}
                onChange={handleChange}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              >
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Name & Email row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Full Name <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email <span className="text-accent">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                />
              </div>
            </div>

            {/* Phone & Job Title row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  id="phone"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 (555) 000-0000"
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                />
              </div>
              <div>
                <label htmlFor="job_title" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Current Job Title <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  id="job_title"
                  name="job_title"
                  required
                  value={formData.job_title}
                  onChange={handleChange}
                  placeholder="Senior Software Engineer"
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                />
              </div>
            </div>

            {/* Years of Experience */}
            <div className="max-w-[200px]">
              <label htmlFor="years_experience" className="block text-sm font-medium text-gray-700 mb-1.5">
                Years of Experience <span className="text-accent">*</span>
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
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              />
            </div>

            {/* Cover Letter */}
            <div>
              <label htmlFor="cover_letter" className="block text-sm font-medium text-gray-700 mb-1.5">
                Cover Letter <span className="text-accent">*</span>
              </label>
              <textarea
                id="cover_letter"
                name="cover_letter"
                required
                rows={6}
                value={formData.cover_letter}
                onChange={handleChange}
                placeholder="Tell us about yourself and why you're a great fit for this role..."
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors resize-vertical"
              />
            </div>

            {/* Resume Upload */}
            <div>
              <label htmlFor="resume" className="block text-sm font-medium text-gray-700 mb-1.5">
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
                  className="flex items-center justify-center gap-2 w-full bg-gray-50 border border-dashed border-gray-300 rounded-lg px-4 py-4 text-gray-500 text-sm cursor-pointer hover:border-accent hover:text-gray-700 transition-colors"
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
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg text-sm transition-colors mt-2"
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
          By submitting, you agree to our{' '}
          <a href="/privacy" className="text-accent hover:underline">
            privacy policy
          </a>
          . You can request deletion of your data at any time.
        </p>
      </div>
    </div>
  );
}
