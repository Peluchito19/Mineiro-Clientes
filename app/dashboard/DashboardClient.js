"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/utils/supabase/client";

export default function DashboardClient({
  userId,
  userEmail,
  initialTiendas = [],
  initialTienda,
  initialChanges = [],
}) {
  const router = useRouter();
  const supabase = getSupabaseClient();
  
  // Multi-store support
  const [tiendas, setTiendas] = useState(initialTiendas);
  const [selectedTienda, setSelectedTienda] = useState(initialTienda);
  const [recentChanges, setRecentChanges] = useState(initialChanges);
  
  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(initialTiendas.length === 0);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingNombre, setOnboardingNombre] = useState("");
  const [onboardingUrl, setOnboardingUrl] = useState("");
  
  // Store form
  const [tiendaNombre, setTiendaNombre] = useState(initialTienda?.nombre_negocio ?? "");
  const [tiendaUrl, setTiendaUrl] = useState(initialTienda?.url_web ?? "");
  const [tiendaSlug, setTiendaSlug] = useState(initialTienda?.slug ?? "");
  const [tiendaStatus, setTiendaStatus] = useState("");
  const [creatingTienda, setCreatingTienda] = useState(false);

  // Perfil de usuario - ahora en panel separado
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [profileEmail, setProfileEmail] = useState(userEmail ?? "");
  const [emailStatus, setEmailStatus] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [deletedTiendaIds, setDeletedTiendaIds] = useState(new Set()); // Track deleted stores locally
  
  // Loading states for better UX
  const [isDeleting, setIsDeleting] = useState(null);
  const [isClearingChanges, setIsClearingChanges] = useState(false);

  const callEditApi = async ({ action, table, data, where }) => {
    const response = await fetch("/api/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, table, data, where }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.error) {
      throw new Error(payload.error || "Error en API de edición");
    }

    return payload;
  };

  // Update form when selected tienda changes
  useEffect(() => {
    if (selectedTienda) {
      setTiendaNombre(selectedTienda.nombre_negocio ?? "");
      setTiendaUrl(selectedTienda.url_web ?? "");
      setTiendaSlug(selectedTienda.slug ?? "");
    }
  }, [selectedTienda]);

  useEffect(() => {
    setProfileEmail(userEmail ?? "");
  }, [userEmail]);

  // Handlers
  const handleChangeEmail = async () => {
    if (!supabase) return;
    const nextEmail = profileEmail.trim();

    if (!nextEmail) {
      setEmailStatus("Ingresa un email válido.");
      return;
    }

    setEmailStatus("Enviando confirmación...");
    const { error } = await supabase.auth.updateUser({ email: nextEmail });

    if (error) {
      setEmailStatus("Error: " + error.message);
      return;
    }

    setEmailStatus("Se envió un email de confirmación.");
  };

  const handleChangePassword = async () => {
    if (!supabase) return;

    if (!newPassword || newPassword.length < 6) {
      setPasswordStatus("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus("Las contraseñas no coinciden.");
      return;
    }

    setPasswordStatus("Actualizando...");
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setPasswordStatus("Error: " + error.message);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setPasswordStatus("Contraseña actualizada.");
  };

  const handleResetPassword = async () => {
    if (!supabase) return;
    const email = profileEmail.trim();

    if (!email) {
      setPasswordStatus("Ingresa tu email para recuperar la contraseña.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/login?reset=true",
    });

    if (error) {
      setPasswordStatus("Error: " + error.message);
      return;
    }

    setPasswordStatus("Se envió un email para restablecer la contraseña.");
  };

  const handleSaveTienda = async (event) => {
    event.preventDefault();
    setTiendaStatus("Guardando...");

    if (!supabase) {
      setTiendaStatus("Configura las variables de Supabase.");
      return;
    }

    if (!selectedTienda?.id) {
      setTiendaStatus("Primero crea una tienda.");
      return;
    }

    const { error } = await supabase
      .from("tiendas")
      .update({
        nombre_negocio: tiendaNombre,
        url_web: tiendaUrl,
        slug: tiendaSlug,
      })
      .eq("id", selectedTienda.id);

    if (error) {
      setTiendaStatus("No se pudo guardar: " + error.message);
      return;
    }

    // Update local state
    setTiendas((prev) =>
      prev.map((t) =>
        t.id === selectedTienda.id
          ? { ...t, nombre_negocio: tiendaNombre, url_web: tiendaUrl, slug: tiendaSlug }
          : t
      )
    );
    setSelectedTienda((prev) => ({
      ...prev,
      nombre_negocio: tiendaNombre,
      url_web: tiendaUrl,
      slug: tiendaSlug,
    }));

    setTiendaStatus("¡Guardado!");
    setTimeout(() => setTiendaStatus(""), 2000);
  };

  const handleCreateTienda = async () => {
    if (!supabase) return;
    setCreatingTienda(true);

    // Generate UUID client-side
    const newId = crypto.randomUUID();

    const { data, error } = await supabase
      .from("tiendas")
      .insert({
        id: newId,
        user_id: userId,
        nombre_negocio: "Nueva Tienda",
        url_web: "",
        slug: `tienda-${Date.now()}`,
        estado_pago: false,
        plan: "trial",
      })
      .select()
      .single();

    if (error) {
      alert("Error al crear tienda: " + error.message);
      setCreatingTienda(false);
      return;
    }

    setTiendas((prev) => [...prev, data]);
    setSelectedTienda(data);
    setCreatingTienda(false);
  };

  const handleSelectTienda = (tienda) => {
    setSelectedTienda(tienda);
  };

  const handleDeleteTienda = async (tiendaId) => {
    if (!confirm("¿Eliminar esta tienda y todos sus productos? Esta acción no se puede deshacer.")) return;

    setIsDeleting(tiendaId);

    try {
      const tiendaToDelete = tiendas.find((t) => t.id === tiendaId);
      const slug = tiendaToDelete?.slug;

      // 1. Borrar elements por site_id (slug) - siempre funciona
      if (slug) {
        try {
          await callEditApi({
            action: "delete",
            table: "elements",
            where: { site_id: slug },
          });
        } catch (e) {
          console.log("Elements delete:", e.message);
        }
      }

      // 2. Borrar productos - intentar por tienda_id, si falla intentar alternativas
      try {
        await callEditApi({
          action: "delete",
          table: "productos",
          where: { tienda_id: tiendaId },
        });
      } catch (e) {
        console.log("Productos tienda_id failed, trying alternatives...");
        // Intentar por site_id o tienda_slug si existen
        if (slug) {
          try {
            await callEditApi({ action: "delete", table: "productos", where: { site_id: slug } });
          } catch (e2) {
            try {
              await callEditApi({ action: "delete", table: "productos", where: { tienda_slug: slug } });
            } catch (e3) {
              console.log("Productos alternativas también fallaron, continuando...");
            }
          }
        }
      }

      // 3. Borrar testimonios - igual que productos
      try {
        await callEditApi({
          action: "delete",
          table: "testimonios",
          where: { tienda_id: tiendaId },
        });
      } catch (e) {
        console.log("Testimonios tienda_id failed, trying alternatives...");
        if (slug) {
          try {
            await callEditApi({ action: "delete", table: "testimonios", where: { site_id: slug } });
          } catch (e2) {
            console.log("Testimonios alternativas fallaron, continuando...");
          }
        }
      }

      // 4. Borrar la tienda - esto SIEMPRE debe funcionar (id es PK)
      await callEditApi({
        action: "delete",
        table: "tiendas",
        where: { id: tiendaId },
      });

      // Actualizar estado local
      setDeletedTiendaIds((prev) => new Set([...prev, tiendaId]));
      const remaining = tiendas.filter((t) => t.id !== tiendaId);
      setTiendas(remaining);
      setRecentChanges((prev) => prev.filter((c) => c.site_id !== slug));
      
      if (selectedTienda?.id === tiendaId) {
        setSelectedTienda(remaining[0] || null);
        if (remaining.length === 0) {
          setShowOnboarding(true);
        }
      }

      // Forzar recarga completa para sincronizar
      window.location.reload();
      
    } catch (err) {
      console.error("Error deleting tienda:", err);
      alert("Error al eliminar: " + err.message);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleClearChanges = async () => {
    if (!selectedTienda?.slug) return;

    const confirmed = confirm(
      "¿Eliminar el historial de cambios de esta tienda? Esta acción no se puede deshacer."
    );
    if (!confirmed) return;

    setIsClearingChanges(true);
    try {
      await callEditApi({
        action: "delete",
        table: "elements",
        where: { site_id: selectedTienda.slug },
      });

      setRecentChanges((prev) => prev.filter((c) => c.site_id !== selectedTienda.slug));
    } catch (err) {
      alert("No se pudo limpiar el historial: " + err.message);
    } finally {
      setIsClearingChanges(false);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  // Check if URL/slug already exists
  const [urlCheckStatus, setUrlCheckStatus] = useState(null); // null, 'checking', 'available', 'taken'
  const [urlOwnerEmail, setUrlOwnerEmail] = useState(null);

  const checkUrlAvailability = async (url) => {
    if (!url || !supabase) return;
    
    setUrlCheckStatus('checking');
    
    try {
      // Extract slug from URL
      let slug = url;
      if (url.includes('vercel.app')) {
        slug = url.replace('https://', '').replace('http://', '').replace('.vercel.app', '').replace(/\//g, '');
      } else if (url.includes('.')) {
        slug = url.replace('https://', '').replace('http://', '').split('.')[0].replace(/\//g, '');
      }
      slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      // Check if this URL/slug is already registered
      const { data: existingTienda } = await supabase
        .from("tiendas")
        .select("id, user_id, nombre_negocio, slug, url_web")
        .or(`slug.eq.${slug},url_web.ilike.%${url}%`)
        .maybeSingle();

      if (existingTienda) {
        // Check if it belongs to current user
        if (existingTienda.user_id === userId) {
          setUrlCheckStatus('owned');
          setUrlOwnerEmail(null);
        } else {
          setUrlCheckStatus('taken');
          // Don't reveal owner email for privacy
          setUrlOwnerEmail('otro usuario');
        }
      } else {
        setUrlCheckStatus('available');
        setUrlOwnerEmail(null);
      }
    } catch (err) {
      console.error('Error checking URL:', err);
      setUrlCheckStatus(null);
    }
  };

  // Debounced URL check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onboardingUrl && onboardingUrl.length > 5) {
        checkUrlAvailability(onboardingUrl);
      } else {
        setUrlCheckStatus(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [onboardingUrl]);

  // Onboarding: Create first store
  const handleOnboardingComplete = async () => {
    if (!supabase || !onboardingNombre) return;
    
    // Don't allow creation if URL is taken by another user
    if (urlCheckStatus === 'taken') {
      alert('Esta URL ya está registrada por otro usuario. Por favor usa una URL diferente.');
      return;
    }
    
    setCreatingTienda(true);

    const slug = onboardingNombre
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 30);

    // Generate UUID client-side
    const newId = crypto.randomUUID();

    const { data, error } = await supabase
      .from("tiendas")
      .insert({
        id: newId,
        user_id: userId,
        nombre_negocio: onboardingNombre,
        url_web: onboardingUrl || "",
        slug: slug || `tienda-${Date.now()}`,
        estado_pago: false,
        plan: "trial",
      })
      .select()
      .single();

    if (error) {
      alert("Error al crear tienda: " + error.message);
      setCreatingTienda(false);
      return;
    }

    setTiendas([data]);
    setSelectedTienda(data);
    setTiendaNombre(data.nombre_negocio);
    setTiendaUrl(data.url_web);
    setTiendaSlug(data.slug);
    setShowOnboarding(false);
    setCreatingTienda(false);
  };

  // Trial/Payment status
  const isPaid = selectedTienda?.estado_pago === true;
  const plan = selectedTienda?.plan || "trial";

  // Show onboarding for new users
  if (showOnboarding) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="relative isolate overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(124,58,237,0.18),_transparent_55%)]" />

          <div className="relative mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 py-16">
            <div className="w-full rounded-2xl border border-slate-800/60 bg-slate-900/60 p-8 shadow-2xl backdrop-blur">
              {/* Welcome */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center text-2xl">
                  🎉
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  ¡Bienvenido a Mineiro!
                </h1>
                <p className="text-slate-300">
                  Configura tu primera tienda para comenzar
                </p>
              </div>

              {/* Form */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">
                    ¿Cómo se llama tu negocio? *
                  </label>
                  <input
                    type="text"
                    value={onboardingNombre}
                    onChange={(e) => setOnboardingNombre(e.target.value)}
                    placeholder="Ej: Pizzería Don Luigi"
                    className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-500/30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">
                    URL de tu página web (opcional)
                  </label>
                  <input
                    type="text"
                    value={onboardingUrl}
                    onChange={(e) => setOnboardingUrl(e.target.value)}
                    placeholder="https://mi-negocio.vercel.app o https://minegocio.cl"
                    className={`w-full rounded-xl border bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition focus:ring-2 ${
                      urlCheckStatus === 'taken' 
                        ? 'border-red-500/70 focus:border-red-400/70 focus:ring-red-500/30' 
                        : urlCheckStatus === 'available' || urlCheckStatus === 'owned'
                        ? 'border-green-500/70 focus:border-green-400/70 focus:ring-green-500/30'
                        : 'border-slate-700/70 focus:border-violet-400/70 focus:ring-violet-500/30'
                    }`}
                  />
                  {/* URL status indicator */}
                  {urlCheckStatus === 'checking' && (
                    <p className="text-xs text-slate-400 flex items-center gap-2">
                      <span className="inline-block w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></span>
                      Verificando disponibilidad...
                    </p>
                  )}
                  {urlCheckStatus === 'available' && (
                    <p className="text-xs text-green-400 flex items-center gap-2">
                      ✅ URL disponible - puedes usarla
                    </p>
                  )}
                  {urlCheckStatus === 'owned' && (
                    <p className="text-xs text-green-400 flex items-center gap-2">
                      ✅ Ya tienes esta URL registrada
                    </p>
                  )}
                  {urlCheckStatus === 'taken' && (
                    <p className="text-xs text-red-400 flex items-center gap-2">
                      ❌ Esta URL ya está registrada por {urlOwnerEmail}. Usa una URL diferente.
                    </p>
                  )}
                  {!urlCheckStatus && (
                    <p className="text-xs text-slate-400">
                      Acepta cualquier URL: Vercel, .cl, .com, etc. Puedes cambiarla después.
                    </p>
                  )}
                </div>

                {/* Trial info */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">🎁</span>
                    <div>
                      <p className="font-medium text-amber-200">
                        Prueba gratuita de 5 días
                      </p>
                      <p className="text-sm text-amber-200/70 mt-1">
                        Acceso completo a todas las funciones. Sin compromiso.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleOnboardingComplete}
                  disabled={!onboardingNombre || creatingTienda || urlCheckStatus === 'taken' || urlCheckStatus === 'checking'}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingTienda ? "Creando tu tienda..." : urlCheckStatus === 'taken' ? "URL no disponible" : "Comenzar mi prueba gratuita →"}
                </button>

                <p className="text-center text-xs text-slate-400">
                  Al continuar, aceptas nuestros términos de servicio.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-400/80">
              Dashboard
            </p>
            <h1 className="text-3xl font-semibold text-white">
              Gestiona tus tiendas
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/pricing"
              className="rounded-xl border border-amber-500/50 px-4 py-2 text-sm font-medium text-amber-400 transition hover:bg-amber-500/10"
            >
              {isPaid ? `Plan: ${plan}` : "🎁 Activar Plan"}
            </a>
            {/* Profile Bubble Menu */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="rounded-full w-10 h-10 bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center text-white font-semibold shadow-lg hover:shadow-cyan-500/30 transition"
                title="Menú de perfil"
              >
                {userEmail?.charAt(0).toUpperCase() || "U"}
              </button>
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-700/70 bg-slate-900/95 backdrop-blur shadow-2xl z-50">
                  <div className="border-b border-slate-700/50 px-4 py-3">
                    <p className="text-xs text-slate-400">Cuenta</p>
                    <p className="text-sm font-medium text-white truncate">{userEmail}</p>
                  </div>
                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowProfilePanel(true);
                      }}
                      className="w-full text-left px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800/50 transition"
                    >
                      ⚙️ Editar perfil
                    </button>
                    <a
                      href="/pricing"
                      className="block w-full text-left px-4 py-2 rounded-lg text-sm text-amber-400 hover:bg-amber-500/10 transition"
                    >
                      💳 Suscripción
                    </a>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-4 py-2 rounded-lg text-sm text-rose-400 hover:bg-rose-500/10 transition"
                    >
                      🚪 Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Profile Panel Modal */}
        {showProfilePanel && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-lg rounded-2xl border border-slate-800/60 bg-slate-900/95 p-8 shadow-2xl">
              <button
                onClick={() => setShowProfilePanel(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl"
              >
                ✕
              </button>
              
              <div className="flex flex-col gap-2 mb-6">
                <h2 className="text-xl font-semibold text-white">⚙️ Perfil y Acceso</h2>
                <p className="text-sm text-slate-300">
                  Administra tu email y contraseña
                </p>
              </div>

              <div className="space-y-6">
                {/* Email Section */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-200">
                    Email de la cuenta
                  </label>
                  <input
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-500/30"
                  />
                  <button
                    type="button"
                    onClick={handleChangeEmail}
                    className="w-full rounded-xl border border-cyan-500/40 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/10"
                  >
                    📧 Cambiar Email
                  </button>
                  {emailStatus && (
                    <p className="text-xs text-slate-400">{emailStatus}</p>
                  )}
                </div>

                {/* Password Section */}
                <div className="space-y-3 border-t border-slate-700/50 pt-6">
                  <label className="text-sm font-medium text-slate-200">
                    Nueva contraseña
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nueva contraseña"
                    className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-violet-400/70 focus:ring-2 focus:ring-violet-500/30"
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirmar contraseña"
                    className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-violet-400/70 focus:ring-2 focus:ring-violet-500/30"
                  />
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    className="w-full rounded-xl border border-violet-500/40 px-4 py-3 text-sm font-semibold text-violet-200 transition hover:bg-violet-500/10"
                  >
                    🔑 Cambiar Contraseña
                  </button>
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    className="w-full text-center text-sm text-slate-400 hover:text-cyan-400 transition"
                  >
                    ¿Olvidaste tu contraseña? Recuperar por email
                  </button>
                  {passwordStatus && (
                    <p className="text-xs text-slate-400">{passwordStatus}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Store Selector */}
        <section className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-white">Mis Tiendas</h2>
            <button
              onClick={handleCreateTienda}
              disabled={creatingTienda}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {creatingTienda ? "Creando..." : "+ Nueva Tienda"}
            </button>
          </div>

          {tiendas.length === 0 ? (
            <p className="text-slate-400 text-sm">
              No tienes tiendas aún. Crea tu primera tienda para comenzar.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {tiendas.map((tienda) => (
                <div
                  key={tienda.id}
                  className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition ${
                    selectedTienda?.id === tienda.id
                      ? "bg-cyan-500/20 border-2 border-cyan-500 text-cyan-100"
                      : "bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <button
                    onClick={() => handleSelectTienda(tienda)}
                    className="flex items-center gap-2"
                  >
                    <span>{tienda.nombre_negocio || "Sin nombre"}</span>
                    {tienda.estado_pago ? (
                      <span className="text-xs text-emerald-400">✓</span>
                    ) : (
                      <span className="text-xs text-amber-400">Trial</span>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTienda(tienda.id);
                    }}
                    disabled={isDeleting === tienda.id}
                    className="ml-2 text-slate-500 hover:text-rose-400 transition disabled:opacity-50"
                    title="Eliminar tienda"
                  >
                    {isDeleting === tienda.id ? (
                      <span className="inline-block w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      "✕"
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Store Settings + Connection Script Combined */}
        {selectedTienda && (
          <section className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-8 shadow-xl backdrop-blur">
            <div className="flex items-start gap-3 mb-8">
              <span className="text-3xl">⚙️</span>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  Configuración y Conexión
                </h2>
                <p className="text-sm text-slate-300 mt-1">
                  Configura tu tienda y conecta el editor visual a tu sitio web.
                </p>
              </div>
            </div>

            {/* Configuration Form */}
            <form className="grid gap-5 md:grid-cols-3 mb-8 bg-slate-900/40 rounded-xl p-6 border border-slate-800/50" onSubmit={handleSaveTienda}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">
                  Nombre del Negocio
                </label>
                <input
                  value={tiendaNombre}
                  onChange={(e) => setTiendaNombre(e.target.value)}
                  placeholder="Mi Restaurante"
                  className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-amber-400/70 focus:ring-2 focus:ring-amber-500/30"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">
                  URL de tu Web
                </label>
                <input
                  value={tiendaUrl}
                  onChange={(e) => setTiendaUrl(e.target.value)}
                  placeholder="https://mirestaurante.com"
                  className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-orange-400/70 focus:ring-2 focus:ring-orange-500/30"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">
                  Slug (identificador único)
                </label>
                <input
                  value={tiendaSlug}
                  onChange={(e) => setTiendaSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  placeholder="mi-restaurante"
                  className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-amber-400/70 focus:ring-2 focus:ring-amber-500/30"
                />
              </div>

              <div className="md:col-span-3 flex justify-end">
                <button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/20 transition hover:brightness-110"
                >
                  {tiendaStatus || "Guardar Cambios"}
                </button>
              </div>
            </form>

            {/* Connection Script */}
            {tiendaSlug && (
              <div className="border-t border-slate-700/50 pt-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">⚡</span>
                      <h3 className="text-lg font-semibold text-amber-300">
                        Conectar con tu sitio web
                      </h3>
                    </div>
                    <p className="text-sm text-slate-300 mb-4">
                      Pega este script en <strong>{tiendaUrl || "tu sitio"}</strong> antes de cerrar el <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300">&lt;/body&gt;</code>
                    </p>
                    <div className="bg-slate-950 rounded-xl p-4 font-mono text-sm overflow-x-auto border border-slate-800">
                      <code className="text-slate-300">
                        <span className="text-slate-500">{"<!-- Mineiro Editor -->"}</span>
                        {"\n"}
                        <span className="text-violet-400">{"<script "}</span>
                        <span className="text-cyan-300">src</span>
                        <span className="text-white">{"="}</span>
                        <span className="text-amber-300">{`"${typeof window !== 'undefined' ? window.location.origin : 'https://mineiro-clientes.vercel.app'}/mineiro.js"`}</span>
                        {"\n"}
                        {"  "}
                        <span className="text-cyan-300">data-mineiro-site</span>
                        <span className="text-white">{"="}</span>
                        <span className="text-amber-300">{`"${tiendaSlug}"`}</span>
                        <span className="text-violet-400">{">"}</span>
                        <span className="text-violet-400">{"</script>"}</span>
                      </code>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {tiendaUrl ? (
                      <a
                        href={`${tiendaUrl}?mineiro-admin`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold shadow-lg shadow-amber-500/20 hover:brightness-110 transition"
                      >
                        🎨 Abrir Editor Visual
                      </a>
                    ) : (
                      <div className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-slate-700 text-slate-400">
                        ⚠️ Configura la URL para habilitar
                      </div>
                    )}
                    <a
                      href="https://mineiro-clientes.vercel.app/manual"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition"
                    >
                      📚 Ver Manual
                    </a>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Últimos cambios del editor */}
        {selectedTienda && (
          <section className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">🕒</span>
                <h3 className="text-lg font-semibold text-white">Últimos cambios</h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    if (!supabase || !selectedTienda?.slug) return;
                    const { data: changes } = await supabase
                      .from("elements")
                      .select("id, site_id, element_id, type, name, original_value, current_value, updated_at")
                      .eq("site_id", selectedTienda.slug)
                      .not("current_value", "is", null)
                      .order("updated_at", { ascending: false })
                      .limit(20);
                    setRecentChanges((prev) => {
                      const otherChanges = prev.filter(c => c.site_id !== selectedTienda.slug);
                      return [...(changes ?? []), ...otherChanges];
                    });
                  }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition"
                >
                  🔄 Actualizar
                </button>
                <button
                  onClick={handleClearChanges}
                  disabled={isClearingChanges}
                  className="text-xs text-rose-400 hover:text-rose-300 transition disabled:opacity-60"
                >
                  {isClearingChanges ? "🧹 Limpiando..." : "🧹 Limpiar"}
                </button>
              </div>
            </div>
            
            {(() => {
              const tiendaChanges = recentChanges.filter(
                (c) => c.site_id === selectedTienda.slug
              );
              
              if (tiendaChanges.length === 0) {
                return (
                  <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 px-4 py-4 text-sm text-slate-400">
                    Aún no hay cambios registrados para <strong>{selectedTienda.nombre_negocio}</strong>. Los cambios aparecerán aquí cuando edites tu sitio con el editor visual.
                  </div>
                );
              }
              
              return (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {tiendaChanges.map((change) => {
                    const timeAgo = formatTimeAgo(change.updated_at);
                    const truncate = (text, maxLen = 50) => {
                      if (!text) return "—";
                      return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
                    };
                    
                    return (
                      <div
                        key={change.id}
                        className="rounded-xl border border-slate-800/60 bg-slate-950/60 px-4 py-3"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-cyan-400">
                            {change.type === "text" ? "📝 Texto" : change.type === "image" ? "🖼️ Imagen" : "🔗 Enlace"}
                          </span>
                          <span className="text-xs text-slate-500">{timeAgo}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-slate-500 line-through">{truncate(change.original_value)}</span>
                          <span className="text-slate-600 mx-2">→</span>
                          <span className="text-emerald-400">{truncate(change.current_value)}</span>
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          {change.name || change.element_id}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </section>
        )}

      </div>
    </div>
  );
}

// Helper function to format time ago
function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "hace unos segundos";
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHour < 24) return `hace ${diffHour}h`;
  if (diffDay < 7) return `hace ${diffDay} día${diffDay > 1 ? "s" : ""}`;
  return date.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}
