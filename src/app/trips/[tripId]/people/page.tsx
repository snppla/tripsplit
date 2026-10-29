import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { addMember, removeMember, renameMember, resendInvite } from "@/app/actions/members";
import { regenerateInvite } from "@/app/actions/trips";
import { inviteUrl, requireMember } from "@/lib/members";
import { loadTripData } from "@/lib/trip-data";
import { emailEnabled } from "@/lib/email";
import { ActionButton } from "@/components/ActionButton";
import { AddMemberForm } from "@/components/AddMemberForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyButton } from "@/components/CopyButton";

export default async function PeoplePage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const { trip, member: me, isOwner } = await requireMember(tripId);
  const { members, expenses, splits, settlements } = await loadTripData(tripId);
  // People involved in any expense or payment can't be removed.
  const involved = new Set([
    ...expenses.map((e) => e.paidById),
    ...splits.map((s) => s.memberId),
    ...settlements.flatMap((s) => [s.fromMemberId, s.toMemberId]),
  ]);
  const userIds = members.flatMap((m) => (m.userId ? [m.userId] : []));
  const avatars = new Map(
    (userIds.length ? await db.select().from(users).where(inArray(users.id, userIds)) : []).map((u) => [u.id, u.image]),
  );
  const link = inviteUrl(trip.inviteToken);
  const canEmail = emailEnabled();

  return (
    <div className="space-y-6">
      <section className="card p-4">
        <h2 className="font-semibold">Invite link</h2>
        <p className="muted mt-1 text-sm">Anyone with this link can join the trip after signing in with Google.</p>
        <div className="mt-3 flex items-center gap-2">
          <input readOnly value={link} className="input font-mono text-xs!" />
          <CopyButton text={link} />
        </div>
        {isOwner && (
          <div className="mt-2">
            <ConfirmButton
              action={regenerateInvite.bind(null, tripId)}
              confirm="Make a new link? The current link will stop working."
              className="text-xs muted hover:underline"
            >
              Reset link
            </ConfirmButton>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">People ({members.length})</h2>
        <ul className="card divide-y divide-stone-100 dark:divide-stone-800">
          {members.map((m) => {
            const avatar = m.userId ? avatars.get(m.userId) : null;
            const canEdit = isOwner || m.id === me.id;
            return (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="" className="size-9 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <span className="grid size-9 place-items-center rounded-full bg-stone-200 text-sm font-semibold dark:bg-stone-700">
                    {m.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  {canEdit ? (
                    <form action={renameMember.bind(null, tripId, m.id)} className="flex items-center gap-2">
                      <input
                        name="name"
                        defaultValue={m.name}
                        aria-label="Name"
                        className="-ml-1 w-full min-w-0 rounded-md border border-transparent bg-transparent px-1 font-medium outline-none hover:border-stone-300 focus:border-brand-500 dark:hover:border-stone-700"
                      />
                    </form>
                  ) : (
                    <p className="truncate font-medium">{m.name}</p>
                  )}
                  <p className="muted truncate text-xs">
                    {[
                      m.id === me.id && "You",
                      m.role === "owner" && "Organizer",
                      !m.userId && (m.email ? `Invited · ${m.email}` : "Not signed up"),
                    ]
                      .filter(Boolean)
                      .join(" · ") || m.email}
                  </p>
                </div>
                {!m.userId && m.email && canEmail && (
                  <ActionButton action={resendInvite.bind(null, tripId, m.id)} pendingText="Sending…">
                    Resend
                  </ActionButton>
                )}
                {isOwner && m.role !== "owner" && !involved.has(m.id) && (
                  <ConfirmButton action={removeMember.bind(null, tripId, m.id)} confirm={`Remove ${m.name} from the trip?`}>
                    Remove
                  </ConfirmButton>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Add someone</h2>
        <AddMemberForm action={addMember.bind(null, tripId)} emailEnabled={canEmail} />
      </section>
    </div>
  );
}
