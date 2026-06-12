import { NavLink, useNavigate } from 'react-router-dom';
import {
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useFriendRequests,
  useFriends,
  useRemoveFriend,
  useSentFriendRequests,
} from '../api/hooks';
import type { Friend, FriendRequest } from '../api/types';

export function FriendsScreen() {
  const friends = useFriends();
  const requests = useFriendRequests();
  const sent = useSentFriendRequests();

  return (
    <div className="min-h-dvh bg-amber-50 px-5 pb-24 pt-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-amber-900">👥 Amis</h1>
        <p className="text-xs text-gray-500">
          Ajoute des amis depuis leur profil pour comparer vos exploits.
        </p>
      </header>

      <Section title="Demandes reçues" count={requests.data?.length}>
        {requests.isLoading ? (
          <Placeholder>Chargement…</Placeholder>
        ) : requests.isError ? (
          <Placeholder error>Impossible de charger les demandes.</Placeholder>
        ) : requests.data && requests.data.length > 0 ? (
          <ul className="space-y-2">
            {requests.data.map((req) => (
              <IncomingRequestRow key={req.id} request={req} />
            ))}
          </ul>
        ) : (
          <Placeholder>Aucune demande en attente.</Placeholder>
        )}
      </Section>

      {sent.data && sent.data.length > 0 && (
        <Section title="Demandes envoyées" count={sent.data.length}>
          <ul className="space-y-2">
            {sent.data.map((req) => (
              <OutgoingRequestRow key={req.id} request={req} />
            ))}
          </ul>
        </Section>
      )}

      <Section title="Mes amis" count={friends.data?.length}>
        {friends.isLoading ? (
          <Placeholder>Chargement…</Placeholder>
        ) : friends.isError ? (
          <Placeholder error>Impossible de charger la liste d'amis.</Placeholder>
        ) : friends.data && friends.data.length > 0 ? (
          <ul className="space-y-2">
            {friends.data.map((f) => (
              <FriendRow key={f.id} friend={f} />
            ))}
          </ul>
        ) : (
          <Placeholder>Pas encore d'amis. Va consulter le classement 🏆</Placeholder>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-amber-700">
        {title}
        {count !== undefined && count > 0 && (
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900">
            {count}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}

function Placeholder({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return <p className={`text-sm ${error ? 'text-red-600' : 'text-gray-500'}`}>{children}</p>;
}

function Avatar({ username }: { username: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-200 text-lg font-semibold text-amber-900">
      {username[0]?.toUpperCase()}
    </div>
  );
}

function IncomingRequestRow({ request }: { request: FriendRequest }) {
  const accept = useAcceptFriendRequest();
  const decline = useDeclineFriendRequest();
  const navigate = useNavigate();
  const busy = accept.isPending || decline.isPending;
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
      <button onClick={() => navigate(`/users/${request.id}`)} className="flex flex-1 items-center gap-3 text-left">
        <Avatar username={request.username} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-gray-900">{request.username}</div>
          <div className="text-xs text-gray-500">veut être ton ami</div>
        </div>
      </button>
      <button
        onClick={() => accept.mutate(request.id)}
        disabled={busy}
        className="rounded-full bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        Accepter
      </button>
      <button
        onClick={() => decline.mutate(request.id)}
        disabled={busy}
        className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
      >
        Refuser
      </button>
    </li>
  );
}

function OutgoingRequestRow({ request }: { request: FriendRequest }) {
  const remove = useRemoveFriend();
  const navigate = useNavigate();
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
      <button onClick={() => navigate(`/users/${request.id}`)} className="flex flex-1 items-center gap-3 text-left">
        <Avatar username={request.username} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-gray-900">{request.username}</div>
          <div className="text-xs text-gray-500">demande en attente…</div>
        </div>
      </button>
      <button
        onClick={() => remove.mutate(request.id)}
        disabled={remove.isPending}
        className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
      >
        Annuler
      </button>
    </li>
  );
}

function FriendRow({ friend }: { friend: Friend }) {
  const remove = useRemoveFriend();
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
      <NavLink to={`/users/${friend.id}`} className="flex flex-1 items-center gap-3">
        <Avatar username={friend.username} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-gray-900">{friend.username}</div>
          <div className="text-xs text-gray-500">
            Amis depuis {new Date(friend.since).toLocaleDateString('fr-FR')}
          </div>
        </div>
      </NavLink>
      <button
        onClick={() => {
          if (confirm(`Retirer ${friend.username} de tes amis ?`)) remove.mutate(friend.id);
        }}
        disabled={remove.isPending}
        className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
      >
        Retirer
      </button>
    </li>
  );
}
