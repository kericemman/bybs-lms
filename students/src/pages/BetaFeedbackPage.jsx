import { BetaFeedbackWorkspace } from "@bybs/shared";
import { studentApi } from "../services/api.js";

export function BetaFeedbackPage() {
  return (
    <BetaFeedbackWorkspace
      description="Send feedback to the BYBS admin team about the mentee portal, assignments, resources, mentor booking, notifications, and support."
      listFeedback={studentApi.listBetaFeedback}
      submitFeedback={studentApi.createBetaFeedback}
      title="Beta Feedback"
    />
  );
}
