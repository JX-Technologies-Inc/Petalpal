/**
 * PetalPal Help & Feedback — Type Definitions
 *
 * Defines models for feedback categories, draft preservation,
 * submission transport, and support menu items.
 */

export type FeedbackCategory =
  | 'bug'
  | 'feature'
  | 'general'
  | 'ai_concern'
  | 'other';

export interface FeedbackCategoryOption {
  id: FeedbackCategory;
  label: string;
  icon: string;
  description: string;
}

export const FEEDBACK_CATEGORIES: FeedbackCategoryOption[] = [
  {
    id: 'bug',
    label: 'Bug Report',
    icon: '🐛',
    description: 'Something looks broken or behaves unexpectedly',
  },
  {
    id: 'feature',
    label: 'Feature Suggestion',
    icon: '✨',
    description: 'Ideas for new blooms, fairy features, or stationery',
  },
  {
    id: 'general',
    label: 'General Feedback',
    icon: '💬',
    description: 'Thoughts, praise, or overall feelings about the garden',
  },
  {
    id: 'ai_concern',
    label: 'AI Response Concern',
    icon: '🧚',
    description: 'Report an unusual, inappropriate, or concerning AI reply',
  },
  {
    id: 'other',
    label: 'Other',
    icon: '🌿',
    description: 'Anything else you would like us to know',
  },
];

export type SubmissionStatus =
  | 'idle'
  | 'validating'
  | 'sending'
  | 'success'
  | 'error';

export interface FeedbackAttachment {
  id: string;
  name: string;
  uri: string; // Data URL or local asset URI for preview
  sizeBytes?: number;
}

export interface FeedbackDraft {
  category: FeedbackCategory;
  subject: string;
  message: string;
  email: string;
  attachments: FeedbackAttachment[];
  updatedAt: number;
}

export const INITIAL_FEEDBACK_DRAFT: FeedbackDraft = {
  category: 'general',
  subject: '',
  message: '',
  email: '',
  attachments: [],
  updatedAt: 0,
};

export interface FeedbackSubmissionPayload {
  category: FeedbackCategory;
  subject: string;
  message: string;
  email?: string;
  attachments?: { name: string; sizeBytes?: number }[];
  route?: string;
  timestamp: number;
  clientVersion: string;
}

export interface FeedbackSubmissionResult {
  success: boolean;
  isRealTransport: boolean;
  referenceId?: string;
  message: string;
  submittedAt: number;
}

export type HelpFeedbackView = 'menu' | 'feedback_form';

export interface SupportTopicItem {
  id: string;
  title: string;
  description: string;
  iconType: 'feedback' | 'help' | 'privacy' | 'support';
}
