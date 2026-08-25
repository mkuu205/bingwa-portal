import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import CustomerAuth from "./pages/CustomerAuth";
import VerifyEmail from "./pages/VerifyEmail";
import CustomerHome from "./pages/CustomerHome";
import PasswordReset from "@/pages/PasswordReset";
import ResendVerification from "@/pages/ResendVerification";
import ChangePassword from "@/pages/ChangePassword";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      {/* Customer authentication is the public entry point. Admin operations remain isolated under /admin. */}
      <Route path={"/"} component={CustomerAuth} />
      <Route path={"/login"} component={CustomerAuth} />
      <Route path={"/register"} component={CustomerAuth} />
      <Route path={"/customer/login"} component={CustomerAuth} />
      <Route path={"/customer"} component={CustomerHome} />
      <Route path={"/admin"} component={Home} />
      <Route path={"/customer/register"} component={CustomerAuth} />
      <Route path={"/forgot-password"} component={PasswordReset} />
      <Route path={"/resend-verification"} component={ResendVerification} />
      <Route path={"/change-password"} component={ChangePassword} />
      <Route path={"/customer/forgot-password"} component={PasswordReset} />
      <Route path={"/reset-password"} component={PasswordReset} />
      <Route path={"/verify-email"} component={VerifyEmail} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
