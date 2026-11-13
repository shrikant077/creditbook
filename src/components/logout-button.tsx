import { signOutAction } from "@/app/actions";

export function LogoutButton() {
  return <form action={signOutAction}><button className="btn secondary small" type="submit">Sign out</button></form>;
}
