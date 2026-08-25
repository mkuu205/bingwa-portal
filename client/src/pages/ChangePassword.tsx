import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const change = trpc.auth.changeCustomerPassword.useMutation({
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setMessage("Password changed successfully. Your other sessions have been signed out.");
    },
    onError: error => setError(error.message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (newPassword !== confirmation) {
      setError("Passwords do not match");
      return;
    }
    change.mutate({ currentPassword, newPassword });
  };

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground">
      <div className="mx-auto max-w-md">
        <Card className="border-border/70 bg-card/90 shadow-2xl shadow-black/20">
          <CardHeader>
            <CardTitle className="text-2xl">Change password</CardTitle>
            <CardDescription>Use a new password with at least 12 characters. Other active sessions will be revoked.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="current-password">Current password</Label><Input id="current-password" type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required maxLength={128} /></div>
              <div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} required minLength={12} maxLength={128} /></div>
              <div className="space-y-2"><Label htmlFor="confirmation">Confirm new password</Label><Input id="confirmation" type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required minLength={12} maxLength={128} /></div>
              {message && <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{message}</p>}
              {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={change.isPending}>{change.isPending ? "Please wait…" : "Change password"}</Button>
            </form>
            <p className="mt-5 text-center text-sm text-muted-foreground"><a href="/customer" className="underline underline-offset-4">Back to account</a></p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
