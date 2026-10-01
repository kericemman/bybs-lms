import { MentorQuestionsWorkspace } from "@bybs/shared";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { mentorApi } from "../services/api.js";

export function QuestionsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  function updateQuestionParam(questionId) {
    const nextParams = new URLSearchParams(searchParams);
    if (questionId) nextParams.set("question", questionId);
    else nextParams.delete("question");
    setSearchParams(nextParams);
  }

  return (
    <MentorQuestionsWorkspace
      api={{
        listQuestions: mentorApi.listMentorQuestions,
        replyQuestion: mentorApi.replyMentorQuestion,
        updateQuestionStatus: mentorApi.updateMentorQuestionStatus
      }}
      currentUser={user}
      initialQuestionId={searchParams.get("question") || ""}
      onQuestionChange={updateQuestionParam}
      role="mentor"
    />
  );
}
