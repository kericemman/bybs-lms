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
  const [menuStyle, setMenuStyle] = useState({});
  const menuRef = useRef(null);
  const canAdd = Boolean(event?.startsAt);
  const googleUrl = canAdd ? googleCalendarUrl(event) : "";
  const outlookUrl = canAdd ? outlookCalendarUrl(event) : "";

  useEffect(() => {
    if (!isOpen) return undefined;

    function updateMenuPosition() {
      if (typeof window === "undefined" || !menuRef.current) return;

      const rect = menuRef.current.getBoundingClientRect();
      const margin = 12;
      const gap = 8;
      const menuWidth = 176;
      const isSmallScreen = window.matchMedia("(max-width: 639px)").matches;

      if (isSmallScreen) {
        setMenuStyle({
          bottom: 16,
          left: margin,
          maxHeight: "calc(100dvh - 2rem)",
          right: margin
        });
        return;
      }

      const left = Math.min(Math.max(margin, rect.right - menuWidth), window.innerWidth - menuWidth - margin);
      const availableBelow = window.innerHeight - rect.bottom - gap - margin;
      const shouldOpenAbove = availableBelow < 132 && rect.top > availableBelow;
      const top = shouldOpenAbove
        ? Math.max(margin, rect.top - gap - 132)
        : Math.min(rect.bottom + gap, window.innerHeight - margin);

      setMenuStyle({
        left,
        maxHeight: `calc(100dvh - ${Math.max(margin, top)}px - ${margin}px)`,
        top,
        width: menuWidth
      });
    }

    updateMenuPosition();

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
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
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
        <span className="fixed z-[80] overflow-y-auto rounded-md border border-bybs-border bg-white py-1 text-sm shadow-lg" style={menuStyle}>
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
