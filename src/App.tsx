import { AppShell } from "@/components/AppShell";
import { CategoriesPage } from "@/pages/CategoriesPage";
import { EmployeesPage } from "@/pages/EmployeesPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { InventoryPage } from "@/pages/InventoryPage";
import { MaterialsPage } from "@/pages/MaterialsPage";
import { MovePage } from "@/pages/MovePage";
import { ReorderPage } from "@/pages/ReorderPage";
import { SuppliersPage } from "@/pages/SuppliersPage";
import { WarehouseMapPage } from "@/pages/WarehouseMapPage";
import { usePathname } from "@/lib/router";
import { InventoryProvider } from "@/store/InventoryProvider";
import { LocationProvider } from "@/store/LocationProvider";

/** 按 hash 路径选页面。 */
function CurrentPage() {
  const pathname = usePathname();
  if (pathname.startsWith("/inventory")) return <InventoryPage />;
  if (pathname.startsWith("/map")) return <WarehouseMapPage />;
  if (pathname.startsWith("/move")) return <MovePage />;
  if (pathname.startsWith("/history")) return <HistoryPage />;
  if (pathname.startsWith("/reorder")) return <ReorderPage />;
  if (pathname.startsWith("/materials")) return <MaterialsPage />;
  if (pathname.startsWith("/suppliers")) return <SuppliersPage />;
  if (pathname.startsWith("/categories")) return <CategoriesPage />;
  if (pathname.startsWith("/employees")) return <EmployeesPage />;
  return <DashboardPage />;
}

export function App() {
  // 登录门还没接上。以后用 AuthGate 包住 InventoryProvider，并先执行 supabase/authenticated-only.sql。
  return (
    <InventoryProvider>
      <LocationProvider>
        <AppShell>
          <CurrentPage />
        </AppShell>
      </LocationProvider>
    </InventoryProvider>
  );
}
