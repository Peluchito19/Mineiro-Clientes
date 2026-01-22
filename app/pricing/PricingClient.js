"use client";

import { useState } from "react";

const PLANS = [
  {
    id: "mensual",
    title: "Mensual",
    price: "$50.000",
    description: "Acceso completo, renovable cada mes.",
  },
  {
    id: "anual",
    title: "Anual",
    price: "$500.000",
    description: "Ahorra pagando el año completo.",
  },
];

export default function PricingClient() {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState("");

  const handleCheckout = async (planId) => {
    setError("");
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-16">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-400/80">
            Planes
          </p>
          <h1 className="text-3xl font-semibold text-white">
            Elige tu plan Mineiro
          </h1>
          <p className="text-sm text-slate-300">
            Activa tu tienda y recibe pagos de manera segura.
          </p>
        </header>

        {error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-800/60 bg-slate-900/70 p-8 shadow-xl backdrop-blur"
            >
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                  {plan.title}
                </p>
                <div className="text-4xl font-semibold text-white">
                  {plan.price}
                </div>
                <p className="text-sm text-slate-300">{plan.description}</p>
              </div>

              <button
                type="button"
                onClick={() => handleCheckout(plan.id)}
                disabled={loadingPlan === plan.id}
                className="mt-8 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loadingPlan === plan.id ? "Procesando..." : "Pagar"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
