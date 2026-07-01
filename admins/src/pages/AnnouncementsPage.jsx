import { Plus } from "lucide-react";
import { useState } from "react";
import { Button, PageHeader } from "@bybs/shared";
import { AnnouncementComposer } from "../components/AnnouncementComposer.jsx";
import { SentAnnouncementsList } from "../components/SentAnnouncementsList.jsx";

export function AnnouncementsPage() {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleSent() {
    setRefreshKey((current) => current + 1);
    setIsComposerOpen(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        
        title="Announcements"
      />

      {isComposerOpen ? (
        <AnnouncementComposer
          onCancel={() => setIsComposerOpen(false)}
          onSent={handleSent}
        />
      ) : null}

      <SentAnnouncementsList onCreate={() => setIsComposerOpen(true)} refreshKey={refreshKey} />
    </div>
  );
}
