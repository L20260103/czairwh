import { AppShell } from "@/components/AppShell";
import { DashboardPage } from "@/pages/DashboardPage";
import { GuidePage } from "@/pages/GuidePage";
import { HistoryPage } from "@/pages/HistoryPage";
import { InventoryPage } from "@/pages/InventoryPage";
import { MaterialsPage } from "@/pages/MaterialsPage";
import { MovePage } from "@/pages/MovePage";
import { ReorderPage } from "@/pages/ReorderPage";
import { usePathname } from "@/lib/router";
import { InventoryProvider } from "@/store/InventoryProvider";

/** 按 hash 路径选页面。 */
function CurrentPage() {
  const pathname = usePathname();
  if (pathname.startsWith("/inventory")) return <InventoryPage />;
  if (pathname.startsWith("/move")) return <MovePage />;
  if (pathname.startsWith("/history")) return <HistoryPage />;
  if (pathname.startsWith("/reorder")) return <ReorderPage />;
  if (pathname.startsWith("/materials")) return <MaterialsPage />;
  if (pathname.startsWith("/guide")) return <GuidePage />;
  return <DashboardPage />;
}

export function App() {
  return (
    <InventoryProvider>
      <AppShell>
        <CurrentPage />
      </AppShell>
    </InventoryProvider>
  );
}
