import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function CustomerHome() {
  const [, navigate] = useLocation();
  const account = trpc.auth.customerAccount.useQuery();
  const logout = trpc.auth.customerLogout.useMutation({ onSuccess: () => navigate("/customer/login") });

  useEffect(() => {
    if (account.error) navigate("/customer/login");
  }, [account.error, navigate]);

  if (account.isLoading) return <main className="min-h-screen bg-background p-8 text-foreground">Loading your account…</main>;
  if (!account.data) return null;

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Bingwa Portal</p><h1 className="text-3xl font-semibold">Welcome, {account.data.name}</h1></div>
          <div className="flex items-center gap-2"><a href="/change-password" className="rounded-md border border-border px-3 py-2 text-sm underline-offset-4 hover:underline">Change password</a><Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending}>Sign out</Button></div>
        </div>
        <Card className="border-border/70 bg-card/90">
          <CardHeader><CardTitle>Account</CardTitle><CardDescription>Your customer identity is isolated from administrator access.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p><p className="mt-1 font-medium">{account.data.email}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Email status</p><p className="mt-1 font-medium text-emerald-300">Verified</p></div>
            <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Phone</p><p className="mt-1 font-medium">{account.data.phone || "Not provided"}</p></div>
          </CardContent>
        </Card>
        <Card className="border-dashed border-border/70 bg-card/50"><CardContent className="p-6"><p className="font-medium">Device pairing and subscription management</p><p className="mt-1 text-sm text-muted-foreground">These customer-owned controls will appear here after the secure pairing and product modules are enabled.</p></CardContent></Card>
      </div>
    </main>
  );
}
