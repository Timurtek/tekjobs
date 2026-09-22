import { Button, Icon, Loader, Popover, toast, Tooltip } from "@/components/ui";
import { useEffect, useState } from "react";
import { api, type MailState } from "../api";

/**
 * The mailbox at a glance, from any page: how many application emails wait for a decision, whether a read is
 * running, when the last one was. Starting a read is here too; deciding what each email means stays on Today,
 * under Mail says, where the note and the choices are.
 */
export function MailButton({ onOpenMail }: { onOpenMail: () => void }) {
  const [m, setM] = useState<MailState | null>(null);
  const [open, setOpen] = useState(false);
  const load = () => api.mail().then(setM).catch(() => {});
  // A slow poll keeps the count honest after the scheduled morning read; a fast one follows a run in progress.
  useEffect(() => {
    load();
    const t = setInterval(load, m?.running ? 4000 : 30000);
    return () => clearInterval(t);
  }, [m?.running]);
  const waiting = m?.groups.length ?? 0;
  const check = async () => {
    try { setM(await api.mailCheck()); toast({ title: "Reading the mailbox", description: "Through the local CLI, Gmail read tools only. A few minutes.", tone: "neutral" }); }
    catch (e) { toast({ title: "Could not start", description: (e as Error).message, tone: "danger" }); }
  };
  return (
    <Popover open={open} onOpenChange={setOpen} size="sm">
      <Tooltip content={m?.running ? "Reading the mailbox" : waiting ? `${waiting} from the mailbox waiting on you` : "Mail"}>
        <Popover.Trigger asChild>
          <Button variant="ghost" size="sm" aria-label="Mail" leadingIcon={m?.running ? <Loader size="sm" /> : <Icon.Mail />} trailingIcon={waiting > 0 ? <span className="mailbtn__count num">{waiting}</span> : undefined} />
        </Popover.Trigger>
      </Tooltip>
      <Popover.Content align="end" showArrow={false}>
        <div className="mailbtn">
          <div className="microlabel">Mail says</div>
          <p>
            {m?.running ? "Reading the mailbox now." : waiting === 0 ? "Nothing waiting on you." : <><b className="num">{waiting}</b> {waiting === 1 ? "email group waits" : "email groups wait"} for a decision.</>}
            {m?.lastRun && <><br /><span className="muted">last read <span className="num">{m.lastRun.slice(0, 16).replace("T", " ")}</span> UTC, {m.lastSinceDays} days back</span></>}
            {m?.error && !m.running && <><br /><span className="mailbtn__error">{m.error}</span></>}
          </p>
          <div className="mailbtn__actions">
            <Button size="sm" variant="soft" tone="primary" disabled={!!m?.running} onClick={() => { setOpen(false); onOpenMail(); }}>Open Mail says</Button>
            <Button size="sm" variant="ghost" tone="neutral" disabled={!!m?.running} leadingIcon={<Icon.Refresh />} onClick={check}>Check now</Button>
          </div>
          <p className="muted mailbtn__note">Reads run on their own after the morning scan. Nothing changes a note until you confirm it.</p>
        </div>
      </Popover.Content>
    </Popover>
  );
}
