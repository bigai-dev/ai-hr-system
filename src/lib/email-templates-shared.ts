// Client-safe email template metadata. No DB, no process.env, no server-only
// imports — both server code and 'use client' components can pull from here.
// The DB-backed loaders and email builders live in `email-templates.ts`.

export type EditableTemplateId =
  | 'application_acknowledgement'
  | 'rejection'
  | 'interview_invite';

export const EDITABLE_TEMPLATES: {
  id: EditableTemplateId;
  label: string;
  description: string;
  variables: { name: string; description: string }[];
}[] = [
  {
    id: 'application_acknowledgement',
    label: 'Application acknowledgement',
    description: 'Auto-sent to candidates the moment they submit an application.',
    variables: [
      { name: 'Candidate_Name', description: "The candidate's full name" },
      { name: 'Job_Title', description: 'The role they applied to' },
      { name: 'Company_Name', description: 'Your organisation, from EMAIL_COMPANY_NAME' },
    ],
  },
  {
    id: 'rejection',
    label: 'Rejection',
    description:
      'Auto-sent when a candidate is moved to the Rejected stage from the kanban or bulk reject.',
    variables: [
      { name: 'Candidate_Name', description: "The candidate's full name" },
      { name: 'Job_Title', description: 'The role they applied to' },
      { name: 'Company_Name', description: 'Your organisation' },
      {
        name: 'Rejection_Reason',
        description: 'Generated paragraph for the reason category picked at reject time',
      },
      {
        name: 'Custom_Note',
        description: 'Optional personal note (with leading newline). Empty if none provided.',
      },
    ],
  },
  {
    id: 'interview_invite',
    label: 'Interview confirmation',
    description: 'Auto-sent to candidates after they self-book a slot via a booking link.',
    variables: [
      { name: 'Candidate_Name', description: "The candidate's full name" },
      { name: 'Job_Title', description: 'The role they applied to' },
      { name: 'Company_Name', description: 'Your organisation' },
      { name: 'Interview_Type', description: 'e.g. "Phone Screen", "Onsite"' },
      {
        name: 'Interview_Type_Lower',
        description: 'Same as Interview_Type but lowercased for mid-sentence use',
      },
      { name: 'When', description: 'Localised date+time string in the booking timezone' },
      { name: 'Duration_Minutes', description: 'Interview length, in minutes' },
    ],
  },
];

/**
 * Replace {Var_Name} occurrences with the provided values. Unknown variables
 * are left as-is so the recipient can spot them visually instead of seeing a
 * mangled body when a template is misconfigured.
 */
export function substituteVariables(
  text: string,
  vars: Record<string, string | number>,
): string {
  return text.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name: string) => {
    return name in vars ? String(vars[name]) : match;
  });
}

export type RejectionReason =
  | 'skills_mismatch'
  | 'experience'
  | 'role_filled'
  | 'timing'
  | 'other';

export const REJECTION_REASON_LABELS: Record<RejectionReason, string> = {
  skills_mismatch: 'Skills mismatch',
  experience: 'Experience level',
  role_filled: 'Role filled',
  timing: 'Timing',
  other: 'Other',
};
