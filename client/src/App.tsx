import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Shell } from "@/components/layout/Shell";
import Dashboard from "@/pages/Dashboard";
import Employees from "@/pages/Employees";
import Departments from "@/pages/Departments";
import Attendance from "@/pages/Attendance";
import Payroll from "@/pages/Payroll";
import Documents from "@/pages/Documents";
import Products from "@/pages/Products";
import Contacts from "@/pages/Contacts";
import Sales from "@/pages/Sales";
import Purchase from "@/pages/Purchase";
import Inventory from "@/pages/Inventory";
import Invoices from "@/pages/Invoices";
import JournalEntries from "@/pages/JournalEntries";
import Accounts from "@/pages/Accounts";
import Journals from "@/pages/Journals";
import Reports from "@/pages/Reports";
import TaxCodes from "@/pages/TaxCodes";
import BankStatements from "@/pages/BankStatements";
import AuditLogs from "@/pages/AuditLogs";
import Login from "@/pages/Login";
import Settings from "@/pages/Settings";
import News from "@/pages/News";
import { useAuth } from "@/hooks/use-auth";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Redirect to="/login" />;

  return <Component />;
}

function Router() {
  return (
    <Shell>
      <Switch>
        <Route path="/login" component={Login} />

        <Route path="/">
          <ProtectedRoute component={Dashboard} />
        </Route>

        <Route path="/employees">
          <ProtectedRoute component={Employees} />
        </Route>

        <Route path="/departments">
          <ProtectedRoute component={Departments} />
        </Route>

        <Route path="/attendance">
          <ProtectedRoute component={Attendance} />
        </Route>

        <Route path="/payroll">
          <ProtectedRoute component={Payroll} />
        </Route>

        <Route path="/documents">
          <ProtectedRoute component={Documents} />
        </Route>

        <Route path="/products">
          <ProtectedRoute component={Products} />
        </Route>

        <Route path="/contacts">
          <ProtectedRoute component={Contacts} />
        </Route>

        <Route path="/sales">
          <ProtectedRoute component={Sales} />
        </Route>

        <Route path="/purchase">
          <ProtectedRoute component={Purchase} />
        </Route>

        <Route path="/inventory">
          <ProtectedRoute component={Inventory} />
        </Route>

        <Route path="/invoices">
          <ProtectedRoute component={Invoices} />
        </Route>

        <Route path="/journal-entries">
          <ProtectedRoute component={JournalEntries} />
        </Route>

        <Route path="/accounts">
          <ProtectedRoute component={Accounts} />
        </Route>

        <Route path="/journals">
          <ProtectedRoute component={Journals} />
        </Route>

        <Route path="/reports">
          <ProtectedRoute component={Reports} />
        </Route>

        <Route path="/tax-codes">
          <ProtectedRoute component={TaxCodes} />
        </Route>

        <Route path="/bank-statements">
          <ProtectedRoute component={BankStatements} />
        </Route>

        <Route path="/roles">
          <Redirect to="/settings" />
        </Route>

        <Route path="/audit-logs">
          <ProtectedRoute component={AuditLogs} />
        </Route>

        {/* ✅ Settings */}
        <Route path="/settings">
          <ProtectedRoute component={Settings} />
        </Route>

        {/* ✅ News Feed */}
        <Route path="/news">
          <ProtectedRoute component={News} />
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

import { ThemeProvider } from "@/components/theme-provider";

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
