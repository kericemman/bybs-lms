import { DiscussionForum } from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";
import { mentorApi } from "../services/api.js";

export function DiscussionsPage() {
  const { user } = useAuth();

  return (
    <DiscussionForum
      api={{
        listDiscussions: mentorApi.listDiscussions,
        createDiscussion: mentorApi.createDiscussion,
        updateDiscussion: mentorApi.updateDiscussion,
        deleteDiscussion: mentorApi.deleteDiscussion,
        replyDiscussion: mentorApi.replyDiscussion,
        updateDiscussionComment: mentorApi.updateDiscussionComment,
        deleteDiscussionComment: mentorApi.deleteDiscussionComment,
        listModules: mentorApi.listModules,
        uploadFile: mentorApi.uploadSessionFile
      }}
      canChooseAudience
      createDescription="Start an open thread for questions, reminders, reflections, encouragement, or resources."
      currentUser={user}
      description="Open shared forum for mentors and mentees to write messages, reply, and stay connected."
      emptyDescription="Open forum threads from mentors and mentees will appear here."
      title="Forum"
    />
  );
}
