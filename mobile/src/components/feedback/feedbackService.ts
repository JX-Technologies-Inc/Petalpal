/**
 * PetalPal Feedback Submission Service
 *
 * Typed, replaceable transport interface for feedback submissions.
 * When no backend endpoint is configured, it operates in honest
 * local development mode: recording submissions locally without
 * faking delivery or inventing imaginary server responses.
 */

import type {
  FeedbackSubmissionPayload,
  FeedbackSubmissionResult,
} from './feedbackTypes';

export interface IFeedbackTransport {
  readonly isRealTransportConfigured: boolean;
  readonly transportName: string;
  submitFeedback(payload: FeedbackSubmissionPayload): Promise<FeedbackSubmissionResult>;
}

/**
 * Local Development Transport
 *
 * Used when no backend endpoint is configured.
 * Logs cleanly to development console and stores in-memory for testing,
 * while returning an honest result indicating that real transport is pending.
 */
export class LocalDevelopmentFeedbackTransport implements IFeedbackTransport {
  readonly isRealTransportConfigured = false;
  readonly transportName = 'Local Development (Offline Draft)';

  private submissions: FeedbackSubmissionPayload[] = [];

  async submitFeedback(
    payload: FeedbackSubmissionPayload
  ): Promise<FeedbackSubmissionResult> {
    // Simulate brief network latency for testing loading states (450ms)
    await new Promise((resolve) => setTimeout(resolve, 450));

    this.submissions.push(payload);

    if (__DEV__) {
      console.log(
        '%c[PetalPal Feedback (Local Dev Recording)]',
        'color: #3A6559; font-weight: bold;',
        {
          category: payload.category,
          messageLength: payload.message.length,
          timestamp: new Date(payload.timestamp).toISOString(),
          route: payload.route,
        }
      );
    }

    return {
      success: true,
      isRealTransport: false,
      message:
        'Local development mode: feedback recorded locally on this device. The backend support endpoint is not configured in this build.',
      submittedAt: Date.now(),
    };
  }

  getRecordedSubmissions(): readonly FeedbackSubmissionPayload[] {
    return this.submissions;
  }

  clearRecordedSubmissions(): void {
    this.submissions = [];
  }
}

/**
 * Singleton instance of the active transport.
 * In the future, this can be swapped with an HttpApiFeedbackTransport
 * without altering any UI components.
 */
let activeTransport: IFeedbackTransport = new LocalDevelopmentFeedbackTransport();

export function getFeedbackTransport(): IFeedbackTransport {
  return activeTransport;
}

export function setFeedbackTransport(transport: IFeedbackTransport): void {
  activeTransport = transport;
}
