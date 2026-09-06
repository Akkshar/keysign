import React, { useState } from 'react';
import { PrivacyBadge } from '../components/common/PrivacyBadge';

export const SettingsView: React.FC = () => {
  const [sampleHz, setSampleHz] = useState('1000');
  const [stepUpKeystrokes, setStepUpKeystrokes] = useState(15);
  const [lockoutThreshold, setLockoutThreshold] = useState(40);
  const [localRamOnly, setLocalRamOnly] = useState(true);

  return (
    <div className="flex flex-col w-full gap-space-2xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md p-space-md bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container">
        <div className="flex items-center gap-space-md">
          <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary flex-shrink-0 border border-surface-container">
            <span className="material-symbols-outlined text-[24px]">tune</span>
          </div>
          <div>
            <span className="font-headline text-sm font-bold text-on-surface">Zero-Trust Local Engine Settings</span>
            <p className="font-body text-xs text-on-surface-variant">
              Manage on-device inference sensitivity, sensor frequency, and biometric security boundaries.
            </p>
          </div>
        </div>
        <PrivacyBadge variant="pill" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl">
        <div className="lg:col-span-8 bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-surface-container flex flex-col gap-space-lg">
          <h2 className="font-headline text-base font-bold text-on-surface">Biometric Sensitivity &amp; Thresholds</h2>

          <div className="flex flex-col gap-space-md">
            <div className="flex flex-col gap-space-xs p-space-md bg-surface-container-low rounded-lg border border-surface-container">
              <div className="flex justify-between items-center text-xs font-headline font-semibold text-on-surface">
                <span>Step-Up Evaluation Grace Window</span>
                <span className="font-telemetry text-primary">{stepUpKeystrokes} Keystrokes</span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                value={stepUpKeystrokes}
                onChange={(e) => setStepUpKeystrokes(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <span className="font-body text-[11px] text-on-surface-variant">
                Minimum consecutive anomalous keystrokes required before triggering an interactive FIDO2 verification prompt.
              </span>
            </div>

            <div className="flex flex-col gap-space-xs p-space-md bg-surface-container-low rounded-lg border border-surface-container">
              <div className="flex justify-between items-center text-xs font-headline font-semibold text-on-surface">
                <span>Lockout Confidence Margin</span>
                <span className="font-telemetry text-error font-bold">&lt; {lockoutThreshold}% Match</span>
              </div>
              <input
                type="range"
                min="20"
                max="60"
                value={lockoutThreshold}
                onChange={(e) => setLockoutThreshold(Number(e.target.value))}
                className="w-full accent-error"
              />
              <span className="font-body text-[11px] text-on-surface-variant">
                Threshold below which the operating system session is instantly secured and token memory zeroed.
              </span>
            </div>

            <div className="flex items-center justify-between p-space-md bg-surface-container-low rounded-lg border border-surface-container">
              <div>
                <span className="font-headline text-xs font-semibold text-on-surface">Zero-Disk Ephemeral Enclave</span>
                <p className="font-body text-[11px] text-on-surface-variant">
                  Enforces strict RAM-only vector operations. Tensors are scrubbed upon process termination.
                </p>
              </div>
              <input
                type="checkbox"
                checked={localRamOnly}
                onChange={(e) => setLocalRamOnly(e.target.checked)}
                className="w-5 h-5 accent-primary cursor-pointer rounded"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-space-sm pt-space-xs">
            <button
              onClick={() => alert('Settings saved to local Secure Enclave.')}
              className="px-space-lg py-space-sm rounded-lg bg-primary hover:bg-primary-dark text-white font-headline text-xs font-bold transition-all shadow-sm"
            >
              Save Configuration
            </button>
          </div>
        </div>

        <div className="lg:col-span-4 bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-surface-container flex flex-col justify-between">
          <div className="flex flex-col gap-space-sm">
            <h3 className="font-headline text-base font-bold text-on-surface">Cryptographic Model Info</h3>
            <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container text-xs font-telemetry flex flex-col gap-1">
              <div><span className="text-on-surface-variant">Engine:</span> KeySign Neural Enclave v2.4a</div>
              <div><span className="text-on-surface-variant">HID Interface:</span> CoreHID Monotonic (1,000Hz)</div>
              <div><span className="text-on-surface-variant">Hash Function:</span> SHA-256 Vector Digest</div>
              <div><span className="text-on-surface-variant">Outbound Traffic:</span> <span className="text-secondary font-bold">DISABLED (0 bytes/s)</span></div>
            </div>
            <p className="font-body text-xs text-on-surface-variant mt-2">
              All neural inference computations occur inside host processor registers without leaving the operating system boundary.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
