import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";

export default function PasswordReset() {
  const [location, navigate] = useLocation();
  const token = new URLSearchParams(location.split("?")[1] ?? "").get("token") ?? "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = trpc.auth.requestCustomerPasswordReset.useMutation({
    onSuccess: () => setMessage("If an active account exists for that email, a reset link has been sent."),
    onError: error => setError(error.message),
  });
  const reset = trpc.auth.resetCustomerPassword.useMutation({
    onSuccess: () => {
      setMessage("Your password has been reset. You can now sign in.");
      setPassword("");
      setConfirmation("");
    },
    onError: error => setError(error.message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (!token) {
      request.mutate({ email });
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match");
      return;
    }
    reset.mutate({ token, password });
  };

  const pending = request.isPending || reset.isPending;
  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground">
      <div className="mx-auto max-w-md">
        <Card className="border-border/70 bg-card/90 shadow-2xl shadow-black/20">
          <CardHeader>
            <CardTitle className="text-2xl">{token ? "Choose a new password" : "Reset your password"}</CardTitle>
            <CardDescription>{token ? "Use a strong password with at least 12 characters." : "Enter your email and we will send a single-use reset link if an active account matches."}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {!token && <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>}
              {token && <><div className="space-y-2"><Label htmlFor="password">New password</Label><Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={12} maxLength={128} required /></div><div className="space-y-2"><Label htmlFor="confirmation">Confirm password</Label><Input id="confirmation" type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)} minLength={12} maxLength={128} required /></div></>}
              {message && <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{message}</p>}
              {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={pending}>{pending ? "Please wait…" : token ? "Reset password" : "Send reset link"}</Button>
            </form>
            <p className="mt-5 text-center text-sm text-muted-foreground"><Link href="/customer/login" className="underline underline-offset-4">Back to sign in</Link></p>
            {token && message && <Button variant="outline" className="mt-3 w-full" onClick={() => navigate("/customer/login")}>Continue to sign in</Button>}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

