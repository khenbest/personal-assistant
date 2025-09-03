
import * as Calendar from "expo-calendar";
import { Linking } from "react-native";
import * as MailComposer from "expo-mail-composer";
import type { Handler, Slots } from "./interfaces";

export const calendarHandler: Handler = {
  canHandle: (i) => i === "create_event",
  perform: async (slots: Slots) => {
    const title = (slots["title"] as string) || "Untitled";
    const duration = (slots["duration_min"] as number) ?? 30;
    const startInput = (slots["datetime_point"] as string) || null;
    const range = (slots["datetime_range"] as { start: string; end: string }) || null;
    const cal = (await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)).find(c => c.allowsModifications) 
      ?? await Calendar.getDefaultCalendarAsync();
    const start = range ? new Date(range.start) : new Date(startInput!);
    const end = range ? new Date(range.end) : new Date(start.getTime() + duration * 60000);
    const id = await Calendar.createEventAsync(cal.id, { title, startDate: start, endDate: end });
    return { ok: true, id };
  }
};

export const remindersHandler: Handler = {
  canHandle: (i) => i === "add_reminder",
  perform: async (slots: Slots) => {
    // Reminders live under EventKit reminders entity on iOS via expo-calendar
    const title = (slots["title"] as string) || "Reminder";
    const startInput = (slots["datetime_point"] as string) || null;
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.REMINDER);
    const target = calendars.find(c => c.allowsModifications) ?? calendars[0];
    const id = await Calendar.createReminderAsync(target.id, {
      title,
      startDate: startInput ? new Date(startInput) : undefined
    });
    return { ok: true, id };
  }
};

export const notesHandler: Handler = {
  canHandle: (i) => i === "create_note",
  perform: async (slots: Slots) => {
    const body = (slots["note_body"] as string) ?? (slots["title"] as string) ?? "Note";
    const shortcutName = encodeURIComponent("Append To Notes");
    const text = encodeURIComponent(String(body));
    const url = `shortcuts://x-callback-url/run-shortcut?name=${shortcutName}&input=text&text=${text}`;
    await Linking.openURL(url);
    return { ok: true };
  }
};

export const emailHandler: Handler = {
  canHandle: (i) => i === "send_email",
  perform: async (slots: Slots) => {
    const to = (Array.isArray(slots["email_to"]) ? slots["email_to"] : [slots["email_to"]]).filter(Boolean) as string[];
    const subject = (slots["email_subject"] as string) || "";
    const body = (slots["email_body"] as string) || "";
    const res = await MailComposer.composeAsync({ recipients: to, subject, body });
    const ok = (res as any).status === MailComposer.MailComposerStatus.SENT || (res as any).status === "sent";
    return { ok };
  }
};
