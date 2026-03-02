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
import Leave from "@/pages/Leave";
import Requests from "@/pages/Requests";
import Payroll from "@/pages/Payroll";
import PayrollOverview from "@/pages/PayrollOverview";
import SalaryAdvances from "@/pages/SalaryAdvances";
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
import Performance from "@/pages/Performance";
import Safety from "@/pages/Safety";
import Communication from "@/pages/Communication";
import Activity from "@/pages/Activity";
import MyProfile from "@/pages/MyProfile";
import MySessions from "@/pages/MySessions";
import ScanTerminal from "@/pages/registry/ScanTerminal";
import { useAuth } from "@/hooks/use-auth";
import RostersPage from "@/pages/admin/Rosters";
import RosterTemplateBuilder from "@/pages/admin/RosterTemplateBuilder";
import ShiftsPage from "@/pages/admin/Shifts";
import AdminTransport from "@/pages/admin/transport";
import BusBooking from "@/pages/transport/BusBooking";
import RosterCalendar from "@/pages/manager/RosterCalendar";
import MyRoster from "@/pages/transport/MyRoster";
import ServeTerminal from "@/pages/canteen/ServeTerminal";
import AdminTopUp from "@/pages/canteen/AdminTopUp";
import MyCanteen from "@/pages/canteen/MyCanteen";
import CanteenAdmin from "@/pages/admin/canteen/CanteenAdmin";
import AdminAssets from "@/pages/assets/AdminAssets";
import MyAssets from "@/pages/assets/MyAssets";
import MyRequests from "@/pages/requests/MyRequests";
import NewRequest from "@/pages/requests/NewRequest";
import RequestInbox from "@/pages/requests/RequestInbox";
import RequestDetails from "@/pages/requests/RequestDetails";

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

        <Route path="/me">
          <ProtectedRoute component={MyProfile} />
        </Route>

        <Route path="/me/sessions">
          <ProtectedRoute component={MySessions} />
        </Route>

        <Route path="/me/canteen">
          <ProtectedRoute component={MyCanteen} />
        </Route>

        <Route path="/registry/scan">
          <ProtectedRoute component={ScanTerminal} />
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

        <Route path="/requests">
          <ProtectedRoute component={Requests} />
        </Route>

        <Route path="/leave">
          <Redirect to="/requests?type=leave" />
        </Route>

        <Route path="/payroll">
          <ProtectedRoute component={Payroll} />
        </Route>

        <Route path="/payroll-overview">
          <ProtectedRoute component={PayrollOverview} />
        </Route>

        <Route path="/salary-advances">
          <ProtectedRoute component={SalaryAdvances} />
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

        <Route path="/bank-statements">
          <ProtectedRoute component={BankStatements} />
        </Route>

        {/* ✅ Roster Management (Admin) */}
        <Route path="/manager/rosters/calendar">
          <ProtectedRoute component={RosterCalendar} />
        </Route>
        <Route path="/canteen/serve">
          <ProtectedRoute component={ServeTerminal} />
        </Route>
        <Route path="/canteen/admin/topup">
          <ProtectedRoute component={AdminTopUp} />
        </Route>
        <Route path="/canteen/admin">
          <ProtectedRoute component={CanteenAdmin} />
        </Route>

        {/* Asset Management */}
        <Route path="/assets/admin">
          <ProtectedRoute component={AdminAssets} />
        </Route>
        <Route path="/assets/my">
          <ProtectedRoute component={MyAssets} />
        </Route>

        {/* Requests (Phase 5) */}
        <Route path="/me/requests/new">
          <ProtectedRoute component={NewRequest} />
        </Route>
        <Route path="/me/requests/:id">
          <ProtectedRoute component={RequestDetails} />
        </Route>
        <Route path="/me/requests">
          <ProtectedRoute component={MyRequests} />
        </Route>
        <Route path="/approvals/inbox">
          <Redirect to="/requests?scope=approvals" />
        </Route>
        <Route path="/requests/inbox">
          <Redirect to="/requests?scope=approvals" />
        </Route>
        <Route path="/requests/:id">
          <ProtectedRoute component={RequestDetails} />
        </Route>

        <Route path="/admin/rosters">
          <ProtectedRoute component={RostersPage} />
        </Route>
        <Route path="/admin/rosters/:id/template">
          <ProtectedRoute component={RosterTemplateBuilder} />
        </Route>
        <Route path="/admin/shifts">
          <ProtectedRoute component={ShiftsPage} />
        </Route>

        <Route path="/admin/transport">
          <ProtectedRoute component={AdminTransport} />
        </Route>

        <Route path="/transport/booking">
          <ProtectedRoute component={BusBooking} />
        </Route>

        <Route path="/me/roster">
          <ProtectedRoute component={MyRoster} />
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

        {/* ✅ Performance & KPI */}
        <Route path="/performance">
          <ProtectedRoute component={Performance} />
        </Route>
        <Route path="/performance/:tab">
          <ProtectedRoute component={Performance} />
        </Route>

        <Route path="/safety">
          <ProtectedRoute component={Safety} />
        </Route>

        {/* ✅ Internal Communication System */}
        <Route path="/communication">
          <ProtectedRoute component={Communication} />
        </Route>

        {/* ✅ Activity Log */}
        <Route path="/activity">
          <ProtectedRoute component={Activity} />
        </Route>

        {/* ✅ Action Center */}
        <Route path="/action-center">
          <ProtectedRoute component={ActionCenter} />
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

import { ThemeProvider } from "@/components/theme-provider";
import ActionCenter from "@/pages/ActionCenter";

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
