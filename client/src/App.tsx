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
import Login from "@/pages/Login";
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
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
