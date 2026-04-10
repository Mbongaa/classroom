import { exitOrganizationFormAction } from '@/lib/actions/superadmin-impersonation';
import type { ActingAsContext } from '@/lib/superadmin/acting-as';

/**
 * Sticky banner shown across the dashboard whenever a superadmin is acting
 * as an organization. Server component — the exit button submits a form to
 * the `exitOrganization` server action, which clears the cookie and redirects
 * back to /superadmin/organizations.
 */
export function ImpersonationBanner({ actingAs }: { actingAs: ActingAsContext }) {
  return (
    <div className="sticky top-0 z-50 w-full border-b border-red-700 bg-red-600 text-white shadow-md">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 shrink-0"
            aria-hidden="true"
          >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
          <span className="font-semibold">Superadmin mode:</span>
          <span>
            Acting as <strong>{actingAs.organizationName ?? 'organization'}</strong>
            {actingAs.organizationSlug ? ` (${actingAs.organizationSlug})` : ''}
          </span>
        </div>
        <form action={exitOrganizationFormAction}>
          <button
            type="submit"
            className="rounded-md border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wide hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
          >
            Exit impersonation
          </button>
        </form>
      </div>
    </div>
  );
}
