import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function CustomerAuth() {
  const [location, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">(location.includes("register") ? "register" : "login");
  useEffect(() => {
    setMode(location.includes("register") ? "register" : "login");
  }, [location]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const login = trpc.auth.loginCustomer.useMutation({
    onSuccess: () => navigate("/customer"),
    onError: error => setError(error.message),
  });
  const register = trpc.auth.registerCustomer.useMutation({
    onSuccess: result => setMessage(`Account created for ${result.email}. Check your email to verify it before signing in.`),
    onError: error => setError(error.message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (mode === "login") {
      login.mutate({ email, password });
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match");
      return;
    }
    register.mutate({ email, password, name, phone: phone || undefined });
  };

  const isPending = login.isPending || register.isPending;

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground">
      <div className="mx-auto max-w-md">
        <Card className="border-border/70 bg-card/90 shadow-2xl shadow-black/20">
          <CardHeader>
            <CardTitle className="text-2xl">Bingwa Portal</CardTitle>
            <CardDescription>Manage your connected device and subscriptions securely.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={value => setMode(value as "login" | "register")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" onClick={() => navigate("/customer/login")}>Sign in</TabsTrigger><TabsTrigger value="register" onClick={() => navigate("/customer/register")}>Create account</TabsTrigger>
              </TabsList>
              <form onSubmit={submit} className="mt-6 space-y-4">
                {mode === "register" && (
                  <>
                    <div className="space-y-2"><Label htmlFor="name">Full name</Label><Input id="name" value={name} onChange={e => setName(e.target.value)} required minLength={2} /></div>
                    <div className="space-y-2"><Label htmlFor="phone">Phone (optional)</Label><Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} /></div>
                  </>
                )}
                <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={mode === "register" ? 12 : 1} maxLength={128} /></div>
                {mode === "register" && <div className="space-y-2"><Label htmlFor="confirmation">Confirm password</Label><Input id="confirmation" type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)} required minLength={12} maxLength={128} /></div>}
                {message && <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{message}</p>}
                {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={isPending}>{isPending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</Button>
              </form>
              <div className="mt-5 flex items-center justify-between text-sm text-muted-foreground">
                {mode === "login" ? <a href="/forgot-password" className="underline underline-offset-4">Forgot password?</a> : <a href="/resend-verification" className="underline underline-offset-4">Resend verification</a>}
                <a href={mode === "login" ? "/register" : "/login"} className="underline underline-offset-4">{mode === "login" ? "Create an account" : "Back to sign in"}</a>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
