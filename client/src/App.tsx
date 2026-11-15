import { LobbyPage } from "./LobbyPage";
import { ProfilePage } from "./ProfilePage";
import { ReviewPage } from "./ReviewPage";

// Three pages, chosen by path; plain links move between them (no router library).
export default function App() {
  if (location.pathname.startsWith("/review")) return <ReviewPage />;
  if (location.pathname.startsWith("/lobby")) return <LobbyPage />;
  return <ProfilePage />;
}
