import { CalendarPlus, Download, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./Button.jsx";
import { downloadCalendarEvent, googleCalendarUrl, outlookCalendarUrl } from "../lib/calendar.js";

export function AddToCalendarButton({
  children = "Add to calendar",
  className,
  event,
  fileName,
  size = "sm",
  variant = "secondary"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const canAdd = Boolean(event?.startsAt);
  const googleUrl = canAdd ? googleCalendarUrl(event) : "";
  const outlookUrl = canAdd ? outlookCalendarUrl(event) : "";

  useEffect(() => {
    if (!isOpen) return undefined;

    function handlePointerDown(pointerEvent) {
      if (!menuRef.current?.contains(pointerEvent.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(keyEvent) {
      if (keyEvent.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <span className="relative inline-flex" ref={menuRef}>
      <Button
        className={className}
        disabled={!canAdd}
        icon={CalendarPlus}
        onClick={() => setIsOpen((current) => !current)}
        size={size}
        type="button"
        variant={variant}
      >
        {children}
      </Button>

      {isOpen ? (
        <span className="absolute right-0 top-full z-30 mt-2 w-44 overflow-hidden rounded-md border border-bybs-border bg-white py-1 text-sm shadow-lg">
          {googleUrl ? (
            <a
              className="flex items-center gap-2 px-3 py-2 text-bybs-body hover:bg-bybs-pale hover:text-bybs-blue"
              href={googleUrl}
              onClick={() => setIsOpen(false)}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              Google Calendar
            </a>
          ) : null}
          {outlookUrl ? (
            <a
              className="flex items-center gap-2 px-3 py-2 text-bybs-body hover:bg-bybs-pale hover:text-bybs-blue"
              href={outlookUrl}
              onClick={() => setIsOpen(false)}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              Outlook
            </a>
          ) : null}
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-bybs-body hover:bg-bybs-pale hover:text-bybs-blue"
            onClick={() => {
              downloadCalendarEvent(event, fileName);
              setIsOpen(false);
            }}
            type="button"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            Download .ics
          </button>
        </span>
      ) : null}
    </span>
  );
}
