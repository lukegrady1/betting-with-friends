import { Outlet } from "react-router-dom";
import { TopBar } from "../components/Layout/TopBar";
import { BottomNav } from "../components/Layout/BottomNav";

export function AppLayout() {
  return (
    <div className="min-h-dvh">
      <TopBar />
      <main className="container-responsive pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}