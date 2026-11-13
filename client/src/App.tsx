import { ProfilePage } from "./ProfilePage";
import { ReviewPage } from "./ReviewPage";

// Two pages, chosen by path; plain links move between them (no router library).
export default function App() {
  return location.pathname.startsWith("/review") ? <ReviewPage /> : <ProfilePage />;
}
