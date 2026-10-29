import Home from "@/pages/home";
import Display from "@/pages/display";
import Admin from "@/pages/admin";

export default function App() {
  const path = window.location.pathname;
  if (path === "/display") return <Display />;
  if (path === "/admin") return <Admin />;
  return <Home />;
}
