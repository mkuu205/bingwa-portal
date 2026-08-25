import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

export default function ResendVerification() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resend = trpc.auth.resendCustomerVerification.useMutation({
    onSuccess: () => setMessage("If your account is active and not yet verified, a new verification link has been sent."),
    onError: error => setError(error.message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    resend.mutate({ email });
  };

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground">
      <div className="mx-auto max-w-md">
        <Card className="border-border/70 bg-card/90 shadow-2xl shadow-black/20">
          <CardHeader>
            <CardTitle className="text-2xl">Verify your email</CardTitle>
            <CardDescription>Request a new single-use verification link for your customer account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={event => setEmail(event.target.value)} required /></div>
              {message && <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{message}</p>}
              {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={resend.isPending}>{resend.isPending ? "Please wait…" : "Send verification link"}</Button>
            </form>
            <p className="mt-5 text-center text-sm text-muted-foreground"><a href="/login" className="underline underline-offset-4">Back to sign in</a></p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
