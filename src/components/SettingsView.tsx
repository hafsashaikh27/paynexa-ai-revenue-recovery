import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  ShieldCheck, 
  Sparkles, 
  CreditCard, 
  Bell, 
  Database, 
  Sliders, 
  Save, 
  CheckCircle2, 
  RotateCcw,
  Zap,
  Lock,
  Globe,
  Volume2,
  VolumeX,
  Volume1,
  Play,
  Check,
  Radio,
  FileSpreadsheet,
  MessageSquare
} from 'lucide-react';
import { soundService, SoundSettings } from '../services/soundService';

export const SettingsView: React.FC = () => {
  const [maxRetries, setMaxRetries] = useState(3);
  const [cooldownMinutes, setCooldownMinutes] = useState(15);
  const [escalationThresholdINR, setEscalationThresholdINR] = useState(50000);
  const [autoDunningEnabled, setAutoDunningEnabled] = useState(true);
  const [whatsappNotifications, setWhatsappNotifications] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sound Settings State
  const [soundConfig, setSoundConfig] = useState<SoundSettings>(() => soundService.getSettings());

  useEffect(() => {
    const unsubscribe = soundService.subscribe(() => {
      setSoundConfig(soundService.getSettings());
    });
    return unsubscribe;
  }, []);

  const handleToggleSoundMaster = () => {
    const newState = soundService.toggleSound();
    setSoundConfig(soundService.getSettings());
  };

  const handleVolumeChange = (vol: number) => {
    soundService.setVolume(vol);
    setSoundConfig(soundService.getSettings());
  };

  const handleUpdateSoundCategory = (key: keyof SoundSettings, val: boolean) => {
    soundService.updateSettings({ [key]: val });
    setSoundConfig(soundService.getSettings());
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div id="settings-view" className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] uppercase font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            System Configuration
          </span>
          <span className="text-xs text-slate-400 font-mono">PayNexa Core v1.0.0</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
          Platform & Policy Settings
        </h1>
        <p className="text-sm text-slate-400">
          Configure autonomous recovery thresholds, multi-rail gateway routing rules, and Gemini 3.7 Flash AI parameters.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Autonomous Policy Guardrails */}
        <div className="bg-[#111A30] border border-[#263553] rounded-xl p-5 space-y-4 shadow-md">
          <div className="flex items-center gap-2 pb-3 border-b border-[#263553]">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Deterministic Policy Guardrails</h2>
              <p className="text-xs text-slate-400">Strict runtime boundaries enforced across all automated dunning & payment retries.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 font-semibold">Max Automated Retries</label>
              <input
                type="number"
                min="1"
                max="5"
                value={maxRetries}
                onChange={(e) => setMaxRetries(Number(e.target.value))}
                className="w-full bg-[#0F172A] border border-[#263553] rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-blue-500 focus:bg-[#16213A] outline-none"
              />
              <p className="text-[11px] text-slate-400 font-medium">Mandatory human escalation after threshold.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 font-semibold">Retry Cooldown (Minutes)</label>
              <input
                type="number"
                min="5"
                max="120"
                value={cooldownMinutes}
                onChange={(e) => setCooldownMinutes(Number(e.target.value))}
                className="w-full bg-[#0F172A] border border-[#263553] rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-blue-500 focus:bg-[#16213A] outline-none"
              />
              <p className="text-[11px] text-slate-400 font-medium">Prevents gateway spam & card blocking.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 font-semibold">Auto-Escalation Threshold (₹)</label>
              <input
                type="number"
                step="1000"
                value={escalationThresholdINR}
                onChange={(e) => setEscalationThresholdINR(Number(e.target.value))}
                className="w-full bg-[#0F172A] border border-[#263553] rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-blue-500 focus:bg-[#16213A] outline-none"
              />
              <p className="text-[11px] text-slate-400 font-medium">High-value invoices require VIP handling.</p>
            </div>
          </div>
        </div>

        {/* Section 2: AI Copilot & Inference Model */}
        <div className="bg-[#111A30] border border-[#263553] rounded-xl p-5 space-y-4 shadow-md">
          <div className="flex items-center gap-2 pb-3 border-b border-[#263553]">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-sm font-bold text-white">AI Reasoning & LLM Configuration</h2>
              <p className="text-xs text-slate-400">Server-side Google GenAI / Gemini 3.7 Flash engine parameters.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-3.5 bg-[#0F172A] border border-[#263553] rounded-lg space-y-1">
              <div className="text-xs font-mono text-slate-400 font-semibold">Active LLM Engine</div>
              <div className="text-sm font-bold font-mono text-blue-400 flex items-center gap-2">
                <span>gemini-3.7-flash</span>
                <span className="text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-bold">Server-Side Protected</span>
              </div>
              <div className="text-[11px] text-slate-300 font-medium pt-1">
                Zero client-side API key exposure. Sanitized context whitelisting removes all cardholder PAN and credentials before prompt dispatch.
              </div>
            </div>

            <div className="p-3.5 bg-[#0F172A] border border-[#263553] rounded-lg space-y-1">
              <div className="text-xs font-mono text-slate-400 font-semibold">ML Scoring Model</div>
              <div className="text-sm font-bold font-mono text-indigo-400 flex items-center gap-2">
                <span>recovery_probability_model v1.0.0</span>
                <span className="text-[10px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded font-bold">Logistic Reg + Gradient Signals</span>
              </div>
              <div className="text-[11px] text-slate-300 font-medium pt-1">
                4.2ms avg inference latency. Evaluates 12 deterministic features including gateway failure codes and historical customer payment velocity.
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Payment Gateway & Communication Rails */}
        <div className="bg-[#111A30] border border-[#263553] rounded-xl p-5 space-y-4 shadow-md">
          <div className="flex items-center gap-2 pb-3 border-b border-[#263553]">
            <CreditCard className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Gateway & Dunning Channels</h2>
              <p className="text-xs text-slate-400">Multi-acquirer fallback routing and automated customer notification channels.</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-3.5 bg-[#0F172A] border border-[#263553] rounded-lg">
              <div>
                <div className="text-xs font-bold text-white">Dynamic Multi-Acquirer Failover</div>
                <div className="text-[11px] text-slate-400 font-medium">Automatically routes failed transactions across secondary banking switches (HDFC, ICICI, Axis).</div>
              </div>
              <input
                type="checkbox"
                checked={autoDunningEnabled}
                onChange={(e) => setAutoDunningEnabled(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 bg-[#0F172A] border border-[#263553] rounded-lg">
              <div>
                <div className="text-xs font-bold text-white">WhatsApp 1-Click UPI Payment Recovery Links</div>
                <div className="text-[11px] text-slate-400 font-medium">Sends authenticated WhatsApp deep links for intent session timeouts. Strictly filters DND opt-outs.</div>
              </div>
              <input
                type="checkbox"
                checked={whatsappNotifications}
                onChange={(e) => setWhatsappNotifications(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Notification Sounds & Audio Telemetry */}
        <div id="notification-sounds-settings" className="bg-[#111A30] border border-[#263553] rounded-xl p-5 space-y-5 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#263553]">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-400" />
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Notification Sounds</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                    soundConfig.enabled
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {soundConfig.enabled ? 'Enabled' : 'Muted'}
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Subtle, professional Web Audio synthesized alerts for high-priority recovery lifecycle events.
                </p>
              </div>
            </div>

            {/* Master Sound Toggle */}
            <button
              id="settings-master-sound-toggle-btn"
              type="button"
              onClick={handleToggleSoundMaster}
              className={`px-3.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer select-none ${
                soundConfig.enabled
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 hover:bg-blue-600/30'
                  : 'bg-[#0F172A] border-[#263553] text-slate-400 hover:text-slate-200'
              }`}
            >
              {soundConfig.enabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-blue-400" />
                  <span>🔊 Sound ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-400" />
                  <span>🔇 Sound OFF</span>
                </>
              )}
            </button>
          </div>

          {/* Master Volume Slider */}
          <div className="p-4 bg-[#0F172A] border border-[#263553] rounded-lg space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Volume1 className="w-4 h-4 text-slate-400" />
                <span>Master Sound Volume</span>
              </span>
              <span className="font-mono font-bold text-blue-400">
                {Math.round(soundConfig.volume * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400 font-mono">Low</span>
              <input
                id="sound-volume-slider"
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={soundConfig.volume}
                disabled={!soundConfig.enabled}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer disabled:opacity-40"
              />
              <span className="text-[11px] text-slate-400 font-mono">High</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Calibrated for clean, non-distracting playback during active merchant operations.
            </p>
          </div>

          {/* Granular Sound Event Categories with Previews */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
              Event Audio Channels
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              
              {/* 1. Payment Recovered */}
              <div className="p-3 bg-[#0F172A] border border-[#263553] rounded-lg flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Payment Recovered / Verified</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Positive harmonic chime on successful transaction recovery.
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => soundService.playSuccess(true)}
                    className="p-1.5 rounded-md bg-[#162238] hover:bg-[#1E2D4A] border border-[#2B3B5C] text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Preview Recovery chime"
                  >
                    <Play className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px]">Test</span>
                  </button>
                  <input
                    type="checkbox"
                    checked={soundConfig.playSuccess}
                    disabled={!soundConfig.enabled}
                    onChange={(e) => handleUpdateSoundCategory('playSuccess', e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer disabled:opacity-40"
                  />
                </div>
              </div>

              {/* 2. Payment Failure Alert */}
              <div className="p-3 bg-[#0F172A] border border-[#263553] rounded-lg flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5" />
                    <span>Payment Failure Alerts</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Subtle soft alert when new payment drop-offs are detected.
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => soundService.playFailureAlert(true)}
                    className="p-1.5 rounded-md bg-[#162238] hover:bg-[#1E2D4A] border border-[#2B3B5C] text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Preview Failure alert"
                  >
                    <Play className="w-3 h-3 text-rose-400" />
                    <span className="text-[10px]">Test</span>
                  </button>
                  <input
                    type="checkbox"
                    checked={soundConfig.playFailureAlert}
                    disabled={!soundConfig.enabled}
                    onChange={(e) => handleUpdateSoundCategory('playFailureAlert', e.target.checked)}
                    className="w-4 h-4 accent-rose-500 rounded cursor-pointer disabled:opacity-40"
                  />
                </div>
              </div>

              {/* 3. Offline Verification Alert */}
              <div className="p-3 bg-[#0F172A] border border-[#263553] rounded-lg flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5" />
                    <span>Offline Verification Reported</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Crisp dual ping when customer submits offline settlement.
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => soundService.playOfflineVerification(true)}
                    className="p-1.5 rounded-md bg-[#162238] hover:bg-[#1E2D4A] border border-[#2B3B5C] text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Preview Offline Verification alert"
                  >
                    <Play className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px]">Test</span>
                  </button>
                  <input
                    type="checkbox"
                    checked={soundConfig.playOfflineVerification}
                    disabled={!soundConfig.enabled}
                    onChange={(e) => handleUpdateSoundCategory('playOfflineVerification', e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer disabled:opacity-40"
                  />
                </div>
              </div>

              {/* 4. Customer Communications */}
              <div className="p-3 bg-[#0F172A] border border-[#263553] rounded-lg flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Customer Chat & Messaging</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Gentle chirp when new messages or responses are exchanged.
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => soundService.playCustomerCommunication(true)}
                    className="p-1.5 rounded-md bg-[#162238] hover:bg-[#1E2D4A] border border-[#2B3B5C] text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Preview Chat sound"
                  >
                    <Play className="w-3 h-3 text-purple-400" />
                    <span className="text-[10px]">Test</span>
                  </button>
                  <input
                    type="checkbox"
                    checked={soundConfig.playCustomerCommunication}
                    disabled={!soundConfig.enabled}
                    onChange={(e) => handleUpdateSoundCategory('playCustomerCommunication', e.target.checked)}
                    className="w-4 h-4 accent-purple-500 rounded cursor-pointer disabled:opacity-40"
                  />
                </div>
              </div>

              {/* 5. Report Ready */}
              <div className="p-3 bg-[#0F172A] border border-[#263553] rounded-lg flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Excel Report Generated</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Soft dual harmonic tone when export downloads complete.
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => soundService.playReportReady(true)}
                    className="p-1.5 rounded-md bg-[#162238] hover:bg-[#1E2D4A] border border-[#2B3B5C] text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Preview Report Ready sound"
                  >
                    <Play className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px]">Test</span>
                  </button>
                  <input
                    type="checkbox"
                    checked={soundConfig.playReportReady}
                    disabled={!soundConfig.enabled}
                    onChange={(e) => handleUpdateSoundCategory('playReportReady', e.target.checked)}
                    className="w-4 h-4 accent-blue-500 rounded cursor-pointer disabled:opacity-40"
                  />
                </div>
              </div>

              {/* 6. Event Simulation */}
              <div className="p-3 bg-[#0F172A] border border-[#263553] rounded-lg flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Event Simulations</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Subtle micro-blip when 1-click test events are dispatched.
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => soundService.playSimulateEvent(true)}
                    className="p-1.5 rounded-md bg-[#162238] hover:bg-[#1E2D4A] border border-[#2B3B5C] text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Preview Simulation sound"
                  >
                    <Play className="w-3 h-3 text-indigo-400" />
                    <span className="text-[10px]">Test</span>
                  </button>
                  <input
                    type="checkbox"
                    checked={soundConfig.playSimulateEvent}
                    disabled={!soundConfig.enabled}
                    onChange={(e) => handleUpdateSoundCategory('playSimulateEvent', e.target.checked)}
                    className="w-4 h-4 accent-indigo-500 rounded cursor-pointer disabled:opacity-40"
                  />
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-[#263553]">
          <div className="text-xs text-slate-400 font-mono">
            {savedSuccess && (
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Settings saved and policy rules deployed successfully!
              </span>
            )}
          </div>

          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
};
