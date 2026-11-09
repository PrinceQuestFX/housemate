import { SubmitButton } from "@/components/submit-button";
import { getContext, loadMembers } from "@/lib/session";
import { deleteAnnouncement, postAnnouncement, setPinned } from "@/server/actions";
import { Badge, Empty, Field, btn, btnGhost, card, input } from "@/components/ui";

export default async function WallPage() {
  const ctx = await getContext();
  const members = await loadMembers(ctx);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "—";
  const { data } = await ctx.supabase.from("announcements").select("id, author_id, title, body, pinned, created_at")
    .eq("household_id", ctx.householdId).order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(50);

  return (
    <>
      <h1 className="text-2xl font-semibold">Mur de la maison</h1>
      <form action={postAnnouncement} className={`${card} space-y-3`}>
        <Field label="Titre"><input name="title" required className={input} /></Field>
        <Field label="Message"><textarea name="body" rows={3} className={input} /></Field>
        {ctx.isAdmin && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pin" />Épingler cette annonce</label>}
        <SubmitButton className={btn}>Publier</SubmitButton>
      </form>
      {!data?.length && <Empty>Aucune publication.</Empty>}
      {data?.map((a) => (
        <article key={a.id} className={`${card} space-y-2 text-sm`}>
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{a.title}</h2>{a.pinned && <Badge>Épinglé</Badge>}
          </div>
          <p className="whitespace-pre-wrap">{a.body}</p>
          <p className="text-xs text-neutral-500">{name(a.author_id)} · {new Date(a.created_at).toLocaleDateString("fr-MA")}</p>
          <div className="flex gap-2">
            {ctx.isAdmin && (
              <form action={setPinned}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="pinned" value={String(!a.pinned)} />
                <SubmitButton className={btnGhost}>{a.pinned ? "Désépingler" : "Épingler"}</SubmitButton></form>
            )}
            {(ctx.isAdmin || a.author_id === ctx.userId) && (
              <form action={deleteAnnouncement}><input type="hidden" name="id" value={a.id} /><SubmitButton className={btnGhost}>Supprimer</SubmitButton></form>
            )}
          </div>
        </article>
      ))}
    </>
  );
}
