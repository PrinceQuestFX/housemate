import { errorMessage } from "@/lib/labels";

export function FlashError({ err }: { err?: string }) {
  if (!err) return null;
  return <p role="alert" className="rounded-xl border border-rose-400/60 bg-rose-500/10 p-3 text-sm text-rose-200">{errorMessage(err)}</p>;
}
