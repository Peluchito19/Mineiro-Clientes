"use client";

import { useState } from "react";

const PLANS = [
  {
    id: "mensual",
    title: "Mensual",
    price: "$50.000",
    priceNum: 50000,
    description: "Acceso completo, renovable cada mes.",
  },
  {
    id: "anual",
    title: "Anual",
    price: "$500.000",
    priceNum: 500000,
    description: "Ahorra pagando el año completo.",
    badge: "Ahorra 2 meses",
  },
];

export default function PricingClient({ userId, userEmail, tienda, hasUnlimitedAccess }) {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [activatingDemo, setActivatingDemo] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleCheckout = async (planId) => {
    setError("");
    setSuccess("");
    setLoadingPlan(planId);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "No se pudo crear el pago.");
      }

      const { init_point, sandbox_init_point } = await response.json();
      const checkoutUrl = init_point || sandbox_init_point;

      if (!checkoutUrl) {
        throw new Error("No se recibió la URL de pago.");
      }

      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err?.message || "Ocurrió un error inesperado.");
      setLoadingPlan(null);
    }
  };

  const handleActivateDemo = async () => {
    setError("");
    setSuccess("");
    setActivatingDemo(true);

    try {
      const response = await fetch("/api/checkout/activate-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo activar el acceso.");
      }

      setSuccess(data.message || "¡Acceso ilimitado activado!");
      setTimeout(() => {
        window.location.href = "/dashboard?status=demo-activated";
      }, 1500);
    } catch (err) {
      setError(err?.message || "Ocurrió un error inesperado.");
      setActivatingDemo(false);
    }
  };

  // Check if already paid
  const isPaid = tienda?.estado_pago;
  const currentPlan = tienda?.plan;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-16">
        <header className="space-y-3">
          <a href="/dashboard" className="text-sm text-cyan-400 hover:underline">
            ← Volver al panel
          </a>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-400/80">
            Planes
          </p>
          <h1 className="text-3xl font-semibold text-white">
            Elige tu plan Mineiro
          </h1>
          <p className="text-sm text-slate-300">
            Activa tu tienda y edita tu web de manera visual.
          </p>
        </header>

        {isPaid && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-200">
            ✅ Tu plan <strong>{currentPlan === "unlimited" ? "Ilimitado" : currentPlan}</strong> ya está activo. ¡Gracias por confiar en Mineiro!
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {success}
          </div>
        )}

        {/* Unlimited Access Banner for demo users */}
        {hasUnlimitedAccess && !isPaid && (
          <div className="rounded-2xl border-2 border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🎁</span>
                  <h2 className="text-xl font-semibold text-white">
                    ¡Tienes acceso ilimitado gratuito!
                  </h2>
                </div>
                <p className="text-sm text-slate-300">
                  Tu cuenta <strong>{userEmail}</strong> tiene acceso ilimitado al editor Mineiro. Activa tu plan con un solo clic.
                </p>
              </div>
              <button
                type="button"
                onClick={handleActivateDemo}
                disabled={activatingDemo}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {activatingDemo ? "Activando..." : "🚀 Activar gratis"}
              </button>
            </div>
          </div>
        )}

        {/* Trial info */}
        {!isPaid && !hasUnlimitedAccess && (
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-4 text-sm text-violet-200">
            <span className="font-semibold">🎁 Prueba gratis 3 días</span> — Al seleccionar un plan, ingresarás tu método de pago. 
            Tu tarjeta no será cobrada hasta que termine el período de prueba. Puedes cancelar en cualquier momento.
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col justify-between rounded-2xl border p-8 shadow-xl backdrop-blur ${
                plan.id === "anual"
                  ? "border-cyan-500/50 bg-slate-900/80"
                  : "border-slate-800/60 bg-slate-900/70"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 right-6 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-3 py-1 text-xs font-semibold text-white">
                  {plan.badge}
                </div>
              )}
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                  {plan.title}
                </p>
                <div className="text-4xl font-semibold text-white">
                  {plan.price}
                  <span className="text-sm font-normal text-slate-400"> CLP</span>
                </div>
                <p className="text-sm text-slate-300">{plan.description}</p>
              </div>

              <button
                type="button"
                onClick={() => handleCheckout(plan.id)}
                disabled={loadingPlan === plan.id || isPaid}
                className={`mt-8 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 ${
                  plan.id === "anual"
                    ? "bg-gradient-to-r from-cyan-500 to-violet-500 shadow-cyan-500/20"
                    : "bg-gradient-to-r from-slate-700 to-slate-600 shadow-slate-700/20"
                }`}
              >
                {loadingPlan === plan.id 
                  ? "Procesando..." 
                  : isPaid 
                    ? "Plan activo" 
                    : "Comenzar prueba gratis"}
              </button>
            </div>
          ))}
        </div>

        <div className="text-center text-xs text-slate-500">
          <p>
            Al activar tu plan, aceptas nuestros términos de servicio. 
            Puedes cancelar en cualquier momento durante el período de prueba sin costo alguno.
          </p>
        </div>
      </div>
    </div>
  );
}
