import { MentorQuestionsWorkspace } from "@bybs/shared";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { studentApi } from "../services/api.js";

export function QuestionsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  function updateQuestionParam(questionId) {
    const nextParams = new URLSearchParams(searchParams);
    if (questionId) {
      nextParams.set("question", questionId);
      nextParams.delete("assignment");
      nextParams.delete("module");
    } else {
      nextParams.delete("question");
    }
    setSearchParams(nextParams);
  }

  return (
    <MentorQuestionsWorkspace
      api={{
        listQuestions: studentApi.listMentorQuestions,
        createQuestion: studentApi.createMentorQuestion,
        replyQuestion: studentApi.replyMentorQuestion,
        updateQuestionStatus: studentApi.updateMentorQuestionStatus,
        listModules: studentApi.listModules,
        listAssignments: studentApi.listAssignments
      }}
      currentUser={user}
      initialAssignmentId={searchParams.get("assignment") || ""}
      initialModuleId={searchParams.get("module") || ""}
      initialQuestionId={searchParams.get("question") || ""}
      onQuestionChange={updateQuestionParam}
      role="student"
    />
  );
}
