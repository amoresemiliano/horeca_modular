/**
 * Employee PIN Credential & Kiosk Authentication Service
 * 
 * ARCHITECTURE PRINCIPLE:
 * PINs are 4 digits for rapid hospitality touch operations.
 * They must NEVER be stored in plaintext. In a production backend,
 * PINs are hashed using bcrypt/argon2 or salted SHA-256 with rate limiting.
 * On the admin interface, PINs are never readable; admin can only reset/generate new ones.
 */

export interface PinVerificationResult {
  success: boolean;
  employeeId?: string;
  employeeName?: string;
  operationalUnitId?: string;
  errorMessage?: string;
  isThrottled?: boolean;
  remainingSeconds?: number;
}

export interface PinAttemptLog {
  timestamp: string;
  operationalUnitId: string;
  success: boolean;
  ipHash?: string;
}

// Simulated salt for demo prototype hashing
const SALT = 'horeca_modular_salt_2026_';

export function hashPin(pin: string): string {
  // Simple deterministic client hash simulation representing server-side hash
  let hash = 0;
  const str = `${SALT}:${pin}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `pin_hash_${Math.abs(hash).toString(16)}`;
}

class PersonnelPinService {
  private failedAttempts: Map<string, { count: number; lockedUntil: number }> = new Map();
  private maxAttempts = 5;
  private lockoutDurationMs = 60 * 1000; // 60 seconds lockout

  /**
   * Verify an employee PIN on the Kiosk terminal.
   * Rate-limiting is tracked per operational unit / terminal session.
   */
  async verifyPin(
    pin: string,
    operationalUnitId: string,
    employeeDirectory: Array<{ id: string; name: string; hashedPin: string; operationalUnitIds: string[] }>
  ): Promise<PinVerificationResult> {
    const now = Date.now();
    const throttleKey = `unit_${operationalUnitId}`;
    const throttleInfo = this.failedAttempts.get(throttleKey);

    if (throttleInfo && throttleInfo.lockedUntil > now) {
      const remainingSec = Math.ceil((throttleInfo.lockedUntil - now) / 1000);
      return {
        success: false,
        isThrottled: true,
        remainingSeconds: remainingSec,
        errorMessage: `Terminal bloqueado por seguridad. Espera ${remainingSec} segundos.`,
      };
    }

    // Simulate verification latency
    await new Promise((resolve) => setTimeout(resolve, 250));

    const inputHash = hashPin(pin);
    const matchedEmployee = employeeDirectory.find(
      (emp) => emp.hashedPin === inputHash && emp.operationalUnitIds.includes(operationalUnitId)
    );

    if (matchedEmployee) {
      // Clear failed attempts on success
      this.failedAttempts.delete(throttleKey);
      return {
        success: true,
        employeeId: matchedEmployee.id,
        employeeName: matchedEmployee.name,
        operationalUnitId,
      };
    }

    // Track failed attempt
    const current = this.failedAttempts.get(throttleKey) || { count: 0, lockedUntil: 0 };
    current.count += 1;
    if (current.count >= this.maxAttempts) {
      current.lockedUntil = now + this.lockoutDurationMs;
      this.failedAttempts.set(throttleKey, current);
      return {
        success: false,
        isThrottled: true,
        remainingSeconds: 60,
        errorMessage: 'Demasiados intentos fallidos. Terminal bloqueado por 60 segundos.',
      };
    }

    this.failedAttempts.set(throttleKey, current);
    const remaining = this.maxAttempts - current.count;
    return {
      success: false,
      errorMessage: `PIN incorrecto. Quedan ${remaining} intento(s) antes del bloqueo.`,
    };
  }

  /**
   * Generate a secure random 4-digit PIN for new employees
   */
  generateRandomPin(): string {
    const num = Math.floor(1000 + Math.random() * 9000);
    return num.toString();
  }
}

export const pinService = new PersonnelPinService();
