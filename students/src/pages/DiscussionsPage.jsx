import { DiscussionForum } from "@bybs/shared";
import { studentApi } from "../services/api.js";

export function DiscussionsPage() {
  return (
    <DiscussionForum
      api={{
        listDiscussions: studentApi.listDiscussions,
        createDiscussion: studentApi.createDiscussion,
        replyDiscussion: studentApi.replyDiscussion,
        listModules: studentApi.listModules
      }}
      createDescription="Start an open thread for questions, reflections, peer support, resources, or assignment discussion."
      description="Open shared forum for mentees and mentors to write messages, reply, and stay connected."
      emptyDescription="Open forum threads from mentees and mentors will appear here."
      title="Forum"
    />
  );
}
