import { DiscussionForum } from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";
import { studentApi } from "../services/api.js";

export function DiscussionsPage() {
  const { user } = useAuth();

  return (
    <DiscussionForum
      api={{
        listDiscussions: studentApi.listDiscussions,
        createDiscussion: studentApi.createDiscussion,
        updateDiscussion: studentApi.updateDiscussion,
        deleteDiscussion: studentApi.deleteDiscussion,
        toggleDiscussionReaction: studentApi.toggleDiscussionReaction,
        replyDiscussion: studentApi.replyDiscussion,
        updateDiscussionComment: studentApi.updateDiscussionComment,
        deleteDiscussionComment: studentApi.deleteDiscussionComment,
        toggleDiscussionCommentReaction: studentApi.toggleDiscussionCommentReaction,
        listModules: studentApi.listModules,
        uploadFile: studentApi.uploadFile
      }}
      createDescription="Start an open thread for questions, reflections, peer support, resources, or assignment discussion."
      currentUser={user}
      description="Open shared forum for mentees and mentors to write messages, reply, and stay connected."
      emptyDescription="Open forum threads from mentees and mentors will appear here."
      title="Forum"
    />
  );
}
