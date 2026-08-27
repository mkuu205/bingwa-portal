import { FormEvent, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export default function AdminLogin() {
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = trpc.auth.adminLogin.useMutation({
    onSuccess: async () => {
      await utils.auth.adminMe.invalidate();
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ email, password });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#08111f] px-4 py-12 text-slate-100">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3 text-cyan-300">
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3"><ShieldCheck className="h-6 w-6" /></div>
          <div><p className="text-xs font-medium uppercase tracking-[0.22em]">Bingwa Portal</p><p className="mt-1 text-sm text-slate-400">Control plane access</p></div>
        </div>
        <Card className="border-white/[0.1] bg-white/[0.045] shadow-[0_24px_90px_-35px_rgba(44,128,255,.5)]">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Administrator Login</CardTitle>
            <CardDescription className="text-slate-400">Sign in to manage devices, customers, operations, and products.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2"><Label htmlFor="admin-email" className="text-slate-300">Email / phone</Label><Input id="admin-email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" required className="border-white/10 bg-black/20 text-white" /></div>
              <div className="space-y-2"><Label htmlFor="admin-password" className="text-slate-300">Password</Label><Input id="admin-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required className="border-white/10 bg-black/20 text-white" /></div>
              {login.error ? <p role="alert" className="rounded-md border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{login.error.message}</p> : null}
              <Button type="submit" disabled={login.isPending} className="w-full bg-cyan-300 text-slate-950 hover:bg-cyan-200">{login.isPending ? "Signing in…" : "Sign in"}</Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-5 text-center text-xs text-slate-500">Administrator access is separate from customer accounts.</p>
      </div>
    </main>
  );
}
