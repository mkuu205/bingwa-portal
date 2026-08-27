import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

const navItems = [
  ["Home", "#home"],
  ["Devices", "#devices"],
  ["Transactions", "#transactions"],
  ["Plans", "#plans"],
  ["More", "#more"],
] as const;

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function statusLabel(status: string) {
  return status.toLowerCase().replaceAll("_", " ");
}

export default function CustomerHome() {
  const [, navigate] = useLocation();
  const [active, setActive] = useState("#home");
  const [ussdCode, setUssdCode] = useState("");
  const [simSlot, setSimSlot] = useState("1");
  const [transactionFilter, setTransactionFilter] = useState<"ALL" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED">("ALL");
  const dashboard = trpc.auth.dashboard.useQuery(undefined, { refetchInterval: 30000 });
  const logout = trpc.auth.customerLogout.useMutation({ onSuccess: () => navigate("/customer/login") });
  const activatePlan = trpc.auth.activatePlan.useMutation();
  const checkPayment = trpc.auth.checkPayment.useMutation({ onSuccess: result => { if (result.status === "COMPLETED") dashboard.refetch(); } });
  const customerCommand = trpc.auth.enqueueCustomerCommand.useMutation();
  const runTransaction = trpc.auth.createDeviceTransaction.useMutation();
  const pairing = trpc.auth.createPairingToken.useMutation();
  const unpair = trpc.auth.unpairDevice.useMutation({ onSuccess: () => dashboard.refetch() });

  useEffect(() => {
    if (dashboard.error) navigate("/customer/login");
  }, [dashboard.error, navigate]);

  useEffect(() => {
    const paymentId = activatePlan.data?.kind === "PAID" ? activatePlan.data.paymentId : undefined;
    if (!paymentId) return;
    const timer = window.setInterval(() => checkPayment.mutate({ paymentId }), 4000);
    return () => window.clearInterval(timer);
  }, [activatePlan.data, checkPayment.mutate]);

  const selectedDevice = dashboard.data?.devices[0];
  const activeSubscription = useMemo(
    () => dashboard.data?.subscriptions.find(subscription => ["ACTIVE", "TRIAL"].includes(subscription.status)) ?? dashboard.data?.subscriptions[0],
    [dashboard.data?.subscriptions],
  );
  const online = selectedDevice?.lastHeartbeatAt && Date.now() - new Date(selectedDevice.lastHeartbeatAt).getTime() < 5 * 60 * 1000;

  if (dashboard.isLoading) return <main className="min-h-screen bg-background p-6 text-foreground">Loading your workspace…</main>;
  if (!dashboard.data) return null;

  const { account, devices, transactions, subscriptions, plans, devicePlans, counts } = dashboard.data;
  const hasPlan = Boolean(activeSubscription);
  const filteredTransactions = transactions.filter(transaction => transactionFilter === "ALL" || transaction.status === transactionFilter);

  return (
    <main className="min-h-screen bg-background pb-24 text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-10 -mx-4 mb-5 border-b border-border/70 bg-background/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Bingwa Portal</p>
              <h1 className="mt-1 text-xl font-semibold sm:text-2xl">Welcome back, {account.name}</h1>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Selected device</p>
              <p className="max-w-32 truncate text-sm font-medium">{selectedDevice?.deviceName ?? "No device"}</p>
              <p className={online ? "text-xs text-emerald-400" : "text-xs text-muted-foreground"}>{online ? "● Online" : "● Offline"}</p>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            {selectedDevice ? `${selectedDevice.deviceName} · last seen ${formatDate(selectedDevice.lastHeartbeatAt)}` : "Subscribe to pair your first device and start using your workspace."}
          </div>
        </header>

        <section id="home" className="scroll-mt-28 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardDescription>Devices</CardDescription><CardTitle className="text-3xl">{devices.length}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{online ? "Your device is online" : "No device currently online"}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Active plan</CardDescription><CardTitle className="truncate text-xl">{activeSubscription?.planName ?? "None"}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{activeSubscription?.tokenBalance ?? 0} tokens available</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Tokens</CardDescription><CardTitle className="text-3xl">{dashboard.data.tokens}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Available from active subscriptions</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Completed</CardDescription><CardTitle className="text-3xl text-emerald-400">{counts.completed}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Transactions recorded</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Needs attention</CardDescription><CardTitle className="text-3xl text-amber-300">{counts.pending + counts.failed}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Pending or failed activity</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Airtime</CardDescription><CardTitle className="text-xl">Unavailable</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Awaiting Android balance sync</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Commission</CardDescription><CardTitle className="text-xl">Unavailable</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Awaiting canonical commission sync</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Battery</CardDescription><CardTitle className="text-xl">{selectedDevice?.batteryPercent != null ? `${selectedDevice.batteryPercent}%` : "Unavailable"}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{selectedDevice?.batteryPercent != null ? "Reported by Android" : "Awaiting Android sync"}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardDescription>SIMs</CardDescription><CardTitle className="text-xl">{selectedDevice?.phoneNumber ? `SIM ${selectedDevice.simSlot != null ? selectedDevice.simSlot + 1 : 1}` : "Unavailable"}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{selectedDevice?.phoneNumber ?? "Awaiting device sync"}</CardContent></Card>
          </div>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader><CardTitle>Customer workspace</CardTitle><CardDescription>Manage your devices, plans, and activity from one place.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <a href="#devices" className="rounded-xl border border-border bg-card p-4 transition hover:border-primary"><p className="font-medium">Devices</p><p className="mt-1 text-sm text-muted-foreground">Pair, monitor, or unpair phones.</p></a>
              <a href="#transactions" className="rounded-xl border border-border bg-card p-4 transition hover:border-primary"><p className="font-medium">Transactions</p><p className="mt-1 text-sm text-muted-foreground">Review activity from your devices.</p></a>
              <a href="#plans" className="rounded-xl border border-border bg-card p-4 transition hover:border-primary"><p className="font-medium">Plans</p><p className="mt-1 text-sm text-muted-foreground">View the plans available to your account.</p></a>
            </CardContent>
          </Card>
        </section>

        <section id="operations" className="mt-8 scroll-mt-28 space-y-4"><div><h2 className="text-2xl font-semibold">Device operations</h2><p className="text-sm text-muted-foreground">Commands are sent to Bingwa on the selected Android device. The Portal never executes USSD itself.</p></div><Card><CardContent className="flex flex-wrap gap-3 p-5">{selectedDevice ? <><Button onClick={() => customerCommand.mutate({ deviceId: selectedDevice.id, commandType: "START_AUTOMATION" })} disabled={customerCommand.isPending || !online}>Start automation</Button><Button variant="outline" onClick={() => customerCommand.mutate({ deviceId: selectedDevice.id, commandType: "CHECK_AIRTIME", payload: { simSlot: 1 } })} disabled={customerCommand.isPending || !online}>Check airtime</Button><div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><Input value={ussdCode} onChange={event => setUssdCode(event.target.value)} placeholder="USSD code, e.g. *144#" className="sm:w-44" aria-label="USSD code" /><Input value={simSlot} onChange={event => setSimSlot(event.target.value)} inputMode="numeric" placeholder="SIM" className="sm:w-20" aria-label="SIM slot" /><Button variant="outline" onClick={() => customerCommand.mutate({ deviceId: selectedDevice.id, commandType: "EXECUTE_USSD", payload: { ussdCode, simSlot: Number(simSlot) || 1 } })} disabled={customerCommand.isPending || !online || !ussdCode.trim()}>Run USSD</Button></div></> : <p className="text-sm text-muted-foreground">Pair a device to send Android operations.</p>}{!online && selectedDevice ? <p className="basis-full text-sm text-amber-300">Device offline. Open Bingwa on the device before sending commands.</p> : null}{customerCommand.isSuccess ? <p className="basis-full text-sm text-emerald-300">Command queued for Android delivery.</p> : null}{customerCommand.error ? <p className="basis-full text-sm text-rose-300">{customerCommand.error.message}</p> : null}</CardContent></Card></section>

        <section id="devices" className="mt-8 scroll-mt-28 space-y-4"><div><h2 className="text-2xl font-semibold">Devices</h2><p className="text-sm text-muted-foreground">Phones linked to your customer account.</p></div>{devices.length ? devices.map(device => <Card key={device.id}><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{device.deviceName}</p><p className="mt-1 text-sm text-muted-foreground">{device.manufacturer ?? "Android"} {device.model ?? "phone"} · {device.appVersion ?? "Version unknown"}</p><p className="mt-1 text-xs text-muted-foreground">Last heartbeat: {formatDate(device.lastHeartbeatAt)}{device.latencyMs != null ? ` · ${device.latencyMs} ms` : " · latency unavailable"}</p><p className="mt-1 text-xs text-muted-foreground">Android {device.androidVersion ?? "version unavailable"} · {device.phoneNumber ?? "SIM unavailable"}</p><p className="mt-1 text-xs text-muted-foreground">Battery {device.batteryPercent != null ? `${device.batteryPercent}%` : "unavailable"} · Automation {device.automationEnabled == null ? "unavailable" : device.automationEnabled ? "on" : "off"} · {device.executionState ?? "idle state unavailable"}</p></div><div className="flex items-center gap-3"><span className={device.status === "online" || online ? "text-sm text-emerald-400" : "text-sm text-muted-foreground"}>● {statusLabel(device.status)}</span><Button variant="outline" onClick={() => document.getElementById("devices")?.scrollIntoView({ behavior: "smooth" })}>View</Button><Button variant="outline" onClick={() => unpair.mutate({ deviceId: device.id })} disabled={unpair.isPending}>Unpair</Button></div></CardContent></Card>) : <Card className="border-dashed"><CardContent className="p-8 text-center"><p className="text-lg font-semibold">No devices yet</p><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{hasPlan ? "Pair a phone running Bingwa to begin managing it here." : "Choose a plan first, then pair a phone from this page."}</p><Button className="mt-5" onClick={() => hasPlan ? pairing.mutate() : document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" })} disabled={pairing.isPending}>{hasPlan ? (pairing.isPending ? "Creating code…" : "Pair a device") : "View plans"}</Button>{pairing.data ? <div className="mt-4 rounded-lg bg-background/60 p-3 text-left"><p className="text-xs text-muted-foreground">Enter this code and secret in the Bingwa Android app before it expires:</p><p className="mt-2 font-mono text-xl tracking-[0.2em]">{pairing.data.code}</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{pairing.data.secret}</p><p className="mt-1 text-xs text-muted-foreground">Expires {formatDate(pairing.data.expiresAt)}</p></div> : null}</CardContent></Card>}</section>

        <section id="transactions" className="mt-8 scroll-mt-28 space-y-4"><div><h2 className="text-2xl font-semibold">Transactions</h2><p className="text-sm text-muted-foreground">Recent activity across your paired devices.</p></div><Card><CardContent className="p-5"><div className="mb-4 flex flex-wrap gap-2">{(["ALL", "PENDING", "PROCESSING", "COMPLETED", "FAILED"] as const).map(filter => <Button key={filter} size="sm" variant={transactionFilter === filter ? "default" : "outline"} onClick={() => setTransactionFilter(filter)}>{filter === "ALL" ? "All" : statusLabel(filter)}</Button>)}</div>{filteredTransactions.length ? <div className="space-y-3">{filteredTransactions.slice(0, 10).map(transaction => <div key={transaction.id} className="flex flex-col gap-1 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{transaction.packageName}</p><p className="text-xs text-muted-foreground">{transaction.device?.deviceName ?? "Device"} · {transaction.phoneNumber}</p></div><div className="text-left sm:text-right"><p className="font-medium">KES {transaction.amount}</p><p className="text-xs capitalize text-muted-foreground">{statusLabel(transaction.status)}</p></div></div>)}</div> : <div className="py-8 text-center"><p className="text-lg font-semibold">{hasPlan ? "No transactions yet" : "History locked"}</p><p className="mt-2 text-sm text-muted-foreground">{hasPlan ? "Activity from paired phones will appear here." : "Subscribe to see sales and activity from paired phones."}</p><Button className="mt-5" onClick={() => document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" })}>Choose a plan</Button></div>}</CardContent></Card></section>

        <section id="plans" className="mt-8 scroll-mt-28 space-y-4"><div><h2 className="text-2xl font-semibold">Plans</h2><p className="text-sm text-muted-foreground">Plans imported from your connected Android device and published Portal subscriptions.</p></div>{devicePlans.length ? <Card className="border-primary/20"><CardHeader><CardTitle>Android data plans</CardTitle><CardDescription>These plans come from BingwaAuto on the selected device. Run a transaction only while the device is online.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{devicePlans.map(plan => <div key={plan.id} className="rounded-xl border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{plan.packageName}</p><p className="mt-1 text-sm text-muted-foreground">{plan.dataAmount ?? plan.description ?? "Android data plan"}</p></div><span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{plan.isActive ? "Available" : "Unavailable"}</span></div><div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-xl font-semibold">{plan.price ? `KES ${plan.price}` : "Price unavailable"}</p><p className="text-xs text-muted-foreground">{plan.validity ?? "Validity unavailable"}{plan.category ? ` · ${plan.category}` : ""}</p></div><Button onClick={() => selectedDevice && runTransaction.mutate({ deviceId: selectedDevice.id, planId: plan.id, phoneNumber: selectedDevice.phoneNumber ?? account.phone ?? "", simSlot: plan.executeSim != null && plan.executeSim >= 0 ? plan.executeSim : 0 })} disabled={runTransaction.isPending || !online || !plan.price || !plan.ussdCode || !selectedDevice?.phoneNumber}>{runTransaction.isPending ? "Queueing…" : "Run transaction"}</Button></div></div>)}</CardContent></Card> : null}{runTransaction.data ? <p className="text-sm text-emerald-300">Transaction queued for BingwaAuto execution. The device will report the result after processing.</p> : null}{runTransaction.error ? <p className="text-sm text-rose-300">{runTransaction.error.message}</p> : null}{plans.length ? <div className="grid gap-4 md:grid-cols-2">{plans.map(plan => <Card key={plan.id} className="border-primary/20"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{plan.name}</p><p className="mt-1 text-sm text-muted-foreground">{plan.description || "Subscription plan for Bingwa Portal devices."}</p></div><span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">Published</span></div><div className="mt-5 flex items-end justify-between"><div><p className="text-2xl font-semibold">{plan.price ? `${plan.currency} ${plan.price}` : "Contact support"}</p><p className="text-xs text-muted-foreground">{plan.durationDays ? `${plan.durationDays} days` : "Flexible duration"}{plan.deviceLimit ? ` · ${plan.deviceLimit} device${plan.deviceLimit === 1 ? "" : "s"}` : ""}</p></div><Button onClick={() => activatePlan.mutate({ productId: plan.id })} disabled={activatePlan.isPending}>{activatePlan.isPending ? "Starting…" : plan.price ? "Pay with M-Pesa" : "Activate free plan"}</Button></div></CardContent></Card>)}</div> : <Card className="border-dashed"><CardContent className="p-8 text-center"><p className="text-lg font-semibold">No published plans</p><p className="mt-2 text-sm text-muted-foreground">Published subscription plans will appear here when they are available.</p></CardContent></Card>}{subscriptions.length ? <div className="space-y-3"><h3 className="text-lg font-semibold">Your subscriptions</h3>{subscriptions.map(subscription => <Card key={subscription.id}><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{subscription.planName}</p><p className="text-sm text-muted-foreground">{subscription.storeName} · {subscription.tokenBalance} tokens</p></div><div className="text-left sm:text-right"><p className="capitalize text-emerald-400">{statusLabel(subscription.status)}</p><p className="text-xs text-muted-foreground">Renews {formatDate(subscription.renewalAt)}</p></div></CardContent></Card>)}</div> : null}</section>{activatePlan.data ? <Card className="mt-4 border-emerald-400/30 bg-emerald-400/5"><CardContent className="p-5">{activatePlan.data.kind === "FREE" ? <><p className="font-semibold text-emerald-300">Free plan activated</p><p className="mt-1 text-sm text-muted-foreground">Enter this pairing code in the Bingwa device app:</p><p className="mt-3 font-mono text-2xl tracking-[0.3em] text-foreground">{activatePlan.data.pairingCode}</p><p className="mt-2 text-xs text-muted-foreground">Pairing secret: <span className="font-mono text-foreground">{activatePlan.data.pairingSecret}</span></p><p className="mt-2 text-xs text-muted-foreground">Both credentials expire {formatDate(activatePlan.data.expiresAt)}.</p></> : <><p className="font-semibold text-emerald-300">STK Push sent</p><p className="mt-1 text-sm text-muted-foreground">Complete the payment prompt on your phone. The Portal is checking Payflow and will activate your plan only after verified payment.</p><p className="mt-2 text-xs text-muted-foreground">Payment status: {checkPayment.data?.status ?? "pending"}</p></>}</CardContent></Card> : null}{activatePlan.error ? <p className="mt-3 text-sm text-rose-300">{activatePlan.error.message}</p> : null}

        <section id="more" className="mt-8 scroll-mt-28"><Card><CardHeader><CardTitle>Account and settings</CardTitle><CardDescription>{account.email} · {account.emailVerifiedAt ? "Verified account" : "Verification pending"}</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => navigate("/change-password")}>Change password</Button><Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending}>Sign out</Button></CardContent></Card></section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-2 py-2 backdrop-blur sm:hidden" aria-label="Customer navigation"> <div className="mx-auto grid max-w-md grid-cols-5 gap-1">{navItems.map(([label, href]) => <a key={href} href={href} onClick={() => setActive(href)} className={`rounded-lg px-1 py-2 text-center text-[11px] ${active === href ? "bg-primary/15 font-semibold text-primary" : "text-muted-foreground"}`}>{label}</a>)}</div></nav>
    </main>
  );
}
