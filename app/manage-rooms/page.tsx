import { redirect } from 'next/navigation';

/**
 * Redirect /manage-rooms to /dashboard/rooms
 * This route is deprecated in favor of the dashboard-integrated rooms page
 */
export default function ManageRoomsRedirect() {
  redirect('/dashboard/rooms');
}
