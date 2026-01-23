"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (!supabase) {
        setError(
          "Configuración incompleta. Las variables de Supabase no están configuradas."
        );
        setLoading(false);
        return;
      }

      if (isRegister) {
        // REGISTRO
        if (password !== confirmPassword) {
          setError("Las contraseñas no coinciden.");
          setLoading(false);
          return;
        }

        if (password.length < 6) {
          setError("La contraseña debe tener al menos 6 caracteres.");
          setLoading(false);
          return;
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          setLoading(false);
          return;
        }

        // Check if email confirmation is required
        if (data?.user?.identities?.length === 0) {
          setError("Este correo ya está registrado. Intenta iniciar sesión.");
        } else if (data?.user && !data?.session) {
          setMessage(
            "¡Cuenta creada! Revisa tu correo para confirmar tu cuenta."
          );
        } else {
          setMessage("¡Cuenta creada! Redirigiendo...");
          router.push("/dashboard");
        }
      } else {
        // LOGIN
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          // Translate common errors
          if (signInError.message === "Invalid login credentials") {
            setError("Correo o contraseña incorrectos.");
          } else if (signInError.message === "Email not confirmed") {
            setError("Debes confirmar tu correo antes de iniciar sesión.");
          } else {
            setError(signInError.message);
          }
          setLoading(false);
          return;
        }

        setMessage("¡Bienvenido! Redirigiendo...");
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Auth error:", err);
      if (err.message === "Failed to fetch") {
        setError(
          "No se pudo conectar con el servidor. Verifica que las variables de Supabase estén configuradas correctamente."
        );
      } else {
        setError("Ocurrió un error inesperado. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setError("");
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(124,58,237,0.18),_transparent_55%)]" />

        <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-16">
          <div className="w-full max-w-md rounded-2xl border border-slate-800/60 bg-slate-900/60 p-8 shadow-2xl backdrop-blur">
            {/* Header */}
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-400/80">
                {isRegister ? "Nueva cuenta" : "Acceso seguro"}
              </p>
              <h1 className="text-3xl font-semibold text-white">
                {isRegister ? "Crear cuenta" : "Inicia sesión"}
              </h1>
              <p className="text-sm text-slate-300">
                {isRegister
                  ? "Regístrate para comenzar a usar Mineiro."
                  : "Ingresa con tu correo y contraseña para continuar."}
              </p>
            </div>

            {/* Toggle Login/Register */}
            <div className="mt-6 flex rounded-xl bg-slate-800/50 p-1">
              <button
                type="button"
                onClick={() => !loading && setIsRegister(false)}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
                  !isRegister
                    ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => !loading && setIsRegister(true)}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
                  isRegister
                    ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Crear cuenta
              </button>
            </div>

            {/* Form */}
            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@correo.com"
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-violet-400/70 focus:ring-2 focus:ring-violet-500/30"
                />
              </div>

              {isRegister && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">
                    Confirmar contraseña
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-violet-400/70 focus:ring-2 focus:ring-violet-500/30"
                  />
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              )}

              {message && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 ${
                  isRegister
                    ? "bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 shadow-violet-500/20"
                    : "bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 shadow-cyan-500/20"
                }`}
              >
                {loading
                  ? isRegister
                    ? "Creando cuenta..."
                    : "Ingresando..."
                  : isRegister
                  ? "Crear mi cuenta"
                  : "Entrar"}
              </button>
            </form>

            {/* Footer */}
            <p className="mt-6 text-center text-xs text-slate-400">
              {isRegister ? (
                <>
                  ¿Ya tienes cuenta?{" "}
                  <button
                    type="button"
                    onClick={toggleMode}
                    className="text-cyan-400 hover:underline"
                  >
                    Inicia sesión
                  </button>
                </>
              ) : (
                <>
                  ¿No tienes cuenta?{" "}
                  <button
                    type="button"
                    onClick={toggleMode}
                    className="text-violet-400 hover:underline"
                  >
                    Regístrate gratis
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
