import { SpotifyProvider } from "./components/SpotifySystem";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import DayBloomApp from "./components/DayBloomApp";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <SpotifyProvider username={user.username}><DayBloomApp user={{ name: user.display_name, username: user.username }} /></SpotifyProvider>;
}
