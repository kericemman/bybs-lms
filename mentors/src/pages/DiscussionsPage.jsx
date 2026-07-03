import { DiscussionForum } from "@bybs/shared";
import { mentorApi } from "../services/api.js";

export function DiscussionsPage() {
  return (
    <DiscussionForum
      api={{
        listDiscussions: mentorApi.listDiscussions,
        createDiscussion: mentorApi.createDiscussion,
        replyDiscussion: mentorApi.replyDiscussion,
        listModules: mentorApi.listModules
      }}
      createDescription="Start an open thread for questions, reminders, reflections, encouragement, or resources."
      description="Open shared forum for mentors and mentees to write messages, reply, and stay connected."
      emptyDescription="Open forum threads from mentors and mentees will appear here."
      title="Forum"
    />
  );
}
