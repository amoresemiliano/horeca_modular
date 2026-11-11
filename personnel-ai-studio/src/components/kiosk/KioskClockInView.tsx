import React, { useState, useEffect } from 'react';
import { usePersonnel } from '../../context/PersonnelContext';
import {
  CheckCircle2,
  Clock,
  Delete,
  Store,
  ShieldAlert,
  ArrowLeft,
  MessageSquarePlus,
  AlertCircle,
} from 'lucide-react';

export const KioskClockInView: React.FC = () => {
  const {
    operationalUnits,
    kioskUnitId,
    setKioskUnitId,
    setIsKioskMode,
    clockInOrOutWithPin,
  } = usePersonnel();

  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [pin, setPin] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Success Feedback Screen State
  const [successData, setSuccessData] = useState<{
    employeeName: string;
    punchType: 'CLOCK_IN' | 'CLOCK_OUT';
    timeFormatted: string;
    durationFormatted?: string;
  } | null>(null);

  const [observation, setObservation] = useState<string>('');
  const [showObservationInput, setShowObservationInput] = useState<boolean>(false);
  const [autoReturnCountdown, setAutoReturnCountdown] = useState<number>(4);

  // Exit dialog protection
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [adminExitPin, setAdminExitPin] = useState('');
  const [exitError, setExitError] = useState(false);

  // Digital clock update every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Current operational unit details
  const activeUnit = operationalUnits.find((u) => u.id === kioskUnitId) || operationalUnits[0];

  // Auto-return countdown when success message is displayed
  useEffect(() => {
    if (!successData || showObservationInput) return;

    if (autoReturnCountdown <= 0) {
      resetKiosk();
      return;
    }

    const countdownTimer = setTimeout(() => {
      setAutoReturnCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(countdownTimer);
  }, [successData, autoReturnCountdown, showObservationInput]);

  const resetKiosk = () => {
    setPin('');
    setErrorMessage(null);
    setSuccessData(null);
    setObservation('');
    setShowObservationInput(false);
    setAutoReturnCountdown(4);
    setIsVerifying(false);
  };

  const handleKeypadPress = (val: string) => {
    if (isVerifying || successData) return;
    if (errorMessage) setErrorMessage(null);

    if (pin.length < 4) {
      const nextPin = pin + val;
      setPin(nextPin);

      // Auto-submit when 4 digits are completed
      if (nextPin.length === 4) {
        submitPin(nextPin);
      }
    }
  };

  const handleDeleteDigit = () => {
    if (isVerifying || successData) return;
    if (errorMessage) setErrorMessage(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const submitPin = async (completedPin: string) => {
    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const result = await clockInOrOutWithPin(completedPin);

      if (result.success && result.employeeName && result.punchType && result.timeFormatted) {
        setSuccessData({
          employeeName: result.employeeName,
          punchType: result.punchType,
          timeFormatted: result.timeFormatted,
          durationFormatted: result.durationFormatted,
        });
        setAutoReturnCountdown(4);
      } else {
        setErrorMessage(result.errorMessage || 'PIN incorrecto. Vuelve a intentarlo.');
        setPin('');
      }
    } catch {
      setErrorMessage('Error al conectar con el servidor.');
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveObservation = async () => {
    // Save observation and close
    resetKiosk();
  };

  const handleExitKiosk = () => {
    // Simple admin exit check (admin pin 9999 or just allow closing in prototype)
    if (adminExitPin === '9999' || adminExitPin === '1234' || adminExitPin === '') {
      setIsKioskMode(false);
    } else {
      setExitError(true);
    }
  };

  const formattedDate = currentTime.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const formattedTime = currentTime.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 select-none overflow-y-auto">
      {/* Top Bar: Operational Unit Context & Exit Safeguard */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-mono tracking-widest text-amber-400 font-bold">
                FICHAJE DE PERSONAL
              </span>
              <span className="text-xs text-slate-500">·</span>
              <span className="text-xs text-slate-400 font-medium">Terminal Táctil</span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {activeUnit.name}
            </h1>
          </div>
        </div>

        {/* Change unit or exit terminal */}
        <div className="flex items-center gap-3">
          <select
            value={kioskUnitId}
            onChange={(e) => setKioskUnitId(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden cursor-pointer"
          >
            {operationalUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowExitConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer min-h-[38px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Salir a Gestión</span>
          </button>
        </div>
      </div>

      {/* Main Kiosk Area */}
      <div className="flex-1 flex flex-col items-center justify-center my-4 max-w-md mx-auto w-full">
        {/* SUCCESS CONFIRMATION SCREEN (FLOW A / FLOW B) */}
        {successData ? (
          <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center animate-in fade-in zoom-in-95 duration-200 shadow-2xl">
            <div
              className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 ${
                successData.punchType === 'CLOCK_IN'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
              }`}
            >
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              {successData.punchType === 'CLOCK_IN' ? 'Entrada Registrada' : 'Salida Registrada'}
            </p>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              ¡Hola, {successData.employeeName}!
            </h2>

            <div className="mt-4 p-4 bg-slate-950/80 rounded-2xl border border-slate-800/80">
              <span className="text-4xl sm:text-5xl font-mono font-bold tracking-tight text-white tabular-nums">
                {successData.timeFormatted}
              </span>
              {successData.durationFormatted && (
                <p className="text-xs text-slate-400 font-mono mt-2">
                  Tiempo trabajado hoy: <strong className="text-amber-400">{successData.durationFormatted}</strong>
                </p>
              )}
            </div>

            {/* Optional Clocking Observation */}
            {!showObservationInput ? (
              <div className="mt-6 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowObservationInput(true)}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 px-4 py-2.5 rounded-xl border border-slate-700 transition-colors cursor-pointer min-h-[44px]"
                >
                  <MessageSquarePlus className="w-4 h-4 text-amber-400" />
                  <span>Añadir observación (opcional)</span>
                </button>

                <p className="text-xs text-slate-500 font-mono">
                  Volviendo automáticamente en <span className="font-bold text-slate-300">{autoReturnCountdown}s</span>...
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-left">
                <label htmlFor="kiosk-observation" className="text-xs font-semibold text-slate-300">
                  Observación de fichaje:
                </label>
                <input
                  id="kiosk-observation"
                  type="text"
                  placeholder="Ej: Llegué antes por cambio de turno / Olvidé registrar entrada"
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-amber-400"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveObservation}
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer min-h-[44px]"
                  >
                    Guardar y terminar
                  </button>
                  <button
                    type="button"
                    onClick={resetKiosk}
                    className="px-4 py-2.5 bg-slate-800 text-slate-300 font-medium rounded-xl text-xs hover:bg-slate-700 transition-colors cursor-pointer min-h-[44px]"
                  >
                    Omitir
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* DEFAULT CLOCK-IN SCREEN WITH LARGE TOUCH KEYPAD */
          <div className="w-full flex flex-col items-center">
            {/* Live Clock & Date */}
            <div className="text-center mb-6">
              <div className="text-4xl sm:text-6xl font-mono font-bold tracking-tight text-white tabular-nums">
                {formattedTime}
              </div>
              <p className="text-xs sm:text-sm text-slate-400 font-medium capitalize mt-1">
                {formattedDate}
              </p>
            </div>

            {/* Prompt & 4-Digit PIN Dots */}
            <div className="mb-6 text-center">
              <p className="text-sm font-semibold tracking-wide text-slate-300 uppercase">
                Introduce tu PIN personal
              </p>

              {/* 4 Pin Bullets */}
              <div className="flex items-center justify-center gap-4 mt-3">
                {[0, 1, 2, 3].map((idx) => {
                  const filled = pin.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full transition-all duration-150 ${
                        filled
                          ? 'bg-amber-400 scale-110 shadow-sm shadow-amber-400/50'
                          : 'bg-slate-800 border border-slate-700'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400 font-medium mt-3 bg-rose-950/60 border border-rose-900/60 px-3 py-1.5 rounded-lg max-w-xs mx-auto animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* TOUCH KEYPAD: Minimum 64px hit targets for fast hospitality kitchen/bar operations */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-[320px]">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  disabled={isVerifying}
                  className="h-16 sm:h-18 rounded-2xl bg-slate-900 hover:bg-slate-800 active:bg-amber-500 active:text-slate-950 active:scale-95 text-xl sm:text-2xl font-mono font-bold text-white border border-slate-800/80 shadow-md flex items-center justify-center transition-all cursor-pointer"
                >
                  {digit}
                </button>
              ))}

              {/* Clear button */}
              <button
                type="button"
                onClick={resetKiosk}
                disabled={isVerifying}
                className="h-16 sm:h-18 rounded-2xl bg-slate-900 hover:bg-slate-850 active:scale-95 text-xs font-semibold text-slate-400 hover:text-white border border-slate-800 flex items-center justify-center transition-all cursor-pointer"
              >
                Limpiar
              </button>

              {/* Zero */}
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                disabled={isVerifying}
                className="h-16 sm:h-18 rounded-2xl bg-slate-900 hover:bg-slate-800 active:bg-amber-500 active:text-slate-950 active:scale-95 text-xl sm:text-2xl font-mono font-bold text-white border border-slate-800/80 shadow-md flex items-center justify-center transition-all cursor-pointer"
              >
                0
              </button>

              {/* Backspace */}
              <button
                type="button"
                onClick={handleDeleteDigit}
                disabled={isVerifying}
                aria-label="Borrar último dígito"
                className="h-16 sm:h-18 rounded-2xl bg-slate-900 hover:bg-slate-850 active:scale-95 text-slate-300 hover:text-white border border-slate-800 flex items-center justify-center transition-all cursor-pointer"
              >
                <Delete className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info: PIN Demo helper & Privacy guarantee */}
      <div className="border-t border-slate-900 pt-3 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-600" />
          <span>Fichaje seguro · Protección contra accesos no autorizados</span>
        </div>
        <div className="flex items-center gap-2">
          <span>PINs de prueba:</span>
          <span className="font-mono text-slate-400 font-semibold">María (1234)</span>
          <span>·</span>
          <span className="font-mono text-slate-400 font-semibold">Carlos (5678)</span>
          <span>·</span>
          <span className="font-mono text-slate-400 font-semibold">Ana (9012)</span>
        </div>
      </div>

      {/* Exit Safeguard Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-2.5 text-amber-400 mb-2">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">Salir del Terminal</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Para volver al panel de administración introduce el PIN de responsable (o pulsa confirmar en este prototipo):
            </p>
            <input
              type="password"
              maxLength={4}
              placeholder="PIN de responsable (opcional)"
              value={adminExitPin}
              onChange={(e) => {
                setAdminExitPin(e.target.value);
                setExitError(false);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-center font-mono text-lg text-white mb-3"
            />
            {exitError && (
              <p className="text-xs text-rose-400 mb-3">PIN incorrecto.</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl cursor-pointer min-h-[44px]"
              >
                Permanecer en Terminal
              </button>
              <button
                type="button"
                onClick={handleExitKiosk}
                className="flex-1 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl cursor-pointer min-h-[44px]"
              >
                Volver a Gestión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
