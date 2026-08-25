import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function VerifyEmail() {
  const [, navigate] = useLocation();
  const verify = trpc.auth.verifyCustomerEmail.useMutation();
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) return;
    verify.mutate({ token });
  }, []);

  const state = verify.isPending ? "Verifying your email…" : verify.isSuccess ? "Email verified" : verify.isError ? verify.error.message : "Verification link required";
  const description = verify.isSuccess ? "Your account is ready. You can now sign in to Bingwa Portal." : verify.isError ? "Request a new verification email or check that the link has not expired." : "Open the verification link from your Bingwa Portal email.";

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground">
      <div className="mx-auto max-w-md">
        <Card className="border-border/70 bg-card/90 shadow-2xl shadow-black/20">
          <CardHeader><CardTitle>{state}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
          <CardContent><Button className="w-full" onClick={() => navigate("/customer/login")}>Continue to sign in</Button></CardContent>
        </Card>
      </div>
    </main>
  );
}
