import { BetaFeedbackWorkspace } from "@bybs/shared";
import { mentorApi } from "../services/api.js";

export function BetaFeedbackPage() {
  return (
    <BetaFeedbackWorkspace
      description="Send feedback to the BYBS admin team about the mentor portal, session work, reminders, mentee tracking, reviews, availability, and reports."
      listFeedback={mentorApi.listBetaFeedback}
      submitFeedback={mentorApi.createBetaFeedback}
      title="Beta Feedback"
    />
  );
}
