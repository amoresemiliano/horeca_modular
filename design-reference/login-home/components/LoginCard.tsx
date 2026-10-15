import React, { useState } from 'react';
import { VegenLogo } from './VegenLogo.tsx';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  KeyRound,
} from 'lucide-react';

interface LoginCardProps {
  className?: string;
  onSuccess?: (userEmail: string) => void;
}

export function LoginCard({ className = '', onSuccess }: LoginCardProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Basic client validation
    if (!email.trim()) {
      setErrorMessage('Por favor, ingresa tu correo electrónico.');
      return;
    }
    if (!password) {
      setErrorMessage('Por favor, ingresa tu contraseña de acceso.');
      return;
    }

    setIsLoading(true);

    // Simulate authentic authentication request
    setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);
      if (onSuccess) {
        onSuccess(email);
      }
    }, 900);
  };

  const handleFillDemo = (demoEmail = 'gerencia@vegendigital.com') => {
    setEmail(demoEmail);
    setPassword('Horeca2026!');
    setErrorMessage(null);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotSent(true);
  };

  return (
    <div className={`w-full max-w-[340px] mx-auto ${className}`}>
      {/* Brand Header on light panel - leaf mark */}
      <div className="flex flex-col items-center justify-center mb-5">
        <div className="p-2.5 rounded-2xl bg-white shadow-xs border border-slate-200/80 mb-2.5 flex items-center justify-center">
          <VegenLogo variant="leaf-only" size="md" />
        </div>
        
        {/* Centered required heading */}
        <h2 className="text-xl font-bold tracking-tight text-slate-800 text-center">
          Iniciá sesión para continuar
        </h2>
        <p className="text-xs text-slate-500 text-center mt-1">
          Ingresa tus credenciales del portal de gestión
        </p>
      </div>

      {/* Main Login Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5 sm:p-6 transition-all">
        {isSuccess ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50/50">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                ¡Acceso verificado!
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Conectando con el panel de control de HORECA Modular...
              </p>
            </div>
            <div className="pt-2">
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full animate-pulse w-3/4" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSuccess(false)}
              className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2 pt-2 cursor-pointer"
            >
              Cerrar sesión de prueba
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-4.5" noValidate>
            {/* Error Banner */}
            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="flex-1 leading-snug">{errorMessage}</span>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent focus:bg-white transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 rounded"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent focus:bg-white transition-all placeholder:text-slate-400 tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span>Recordar sesión</span>
              </label>
            </div>

            {/* Main Action CTA */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm shadow-sm hover:shadow transition-all duration-200 cursor-pointer disabled:opacity-75 disabled:cursor-wait active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Accediendo...</span>
                </>
              ) : (
                <>
                  <span>Iniciar sesión</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Quick Demo Credentials Helper */}
            <div className="pt-1.5 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => handleFillDemo()}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-700 transition-colors py-0.5 cursor-pointer"
                title="Completar formulario con cuenta demo para probar el acceso"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Usar credenciales de demo</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Security & System Info footer note */}
      <div className="mt-5 text-center text-xs text-slate-500 space-y-0.5">
        <p className="flex items-center justify-center gap-1.5 font-medium text-xs text-slate-500">
          <span>HORECA Modular</span>
          <span>·</span>
          <span>Portal Seguro</span>
        </p>
        <p className="text-[11px] text-slate-400">
          Uso restringido a operadores y personal autorizado
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">
                  Recuperar acceso
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(false);
                  setForgotSent(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                aria-label="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {forgotSent ? (
              <div className="text-center py-3 space-y-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-xs text-slate-600">
                  Si la cuenta existe, hemos enviado un enlace de restablecimiento a <strong>{forgotEmail}</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotSent(false);
                  }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Entendido
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-xs text-slate-600">
                  Introduce tu correo electrónico corporativo registrado para recibir instrucciones de recuperación de contraseña.
                </p>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-medium cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Enviar enlace
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
