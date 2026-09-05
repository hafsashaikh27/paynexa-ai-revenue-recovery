import React, { useState } from 'react';
import { 
  FlaskConical, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Zap, 
  Layers, 
  ArrowUpRight, 
  Play, 
  Plus, 
  BarChart3, 
  Percent, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { Experiment } from '../types';
import { recoveryService } from '../services/recoveryService';
import { formatINR } from '../utils/formatters';

interface ExperimentsViewProps {
  onOpenAssistant: (initialPrompt?: string) => void;
}

export const ExperimentsView: React.FC<ExperimentsViewProps> = ({ onOpenAssistant }) => {
  const [experiments, setExperiments] = useState<Experiment[]>(() => recoveryService.getExperiments());
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'RUNNING' | 'CONCLUDED'>('ALL');
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);

  const filteredExperiments = experiments.filter((exp) => {
    if (activeFilter === 'ALL') return true;
    return exp.status === activeFilter;
  });

  const totalIncrementalRecoveredINR = experiments.reduce((acc, exp) => acc + exp.incrementalRecoveredINR, 0);
  const avgLift = Math.round(
    (experiments.reduce((acc, exp) => acc + exp.liftPercentage, 0) / experiments.length) * 10
  ) / 10;
  const totalEligible = experiments.reduce((acc, exp) => acc + exp.eligibleTransactionsCount, 0);

  return (
    <div id="experiments-view" className="space-y-6 max-w-7xl mx-auto p-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111A30] border border-[#263553] p-6 rounded-2xl shadow-md">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm">
              <FlaskConical className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white">Recovery Strategy Experiments (A/B)</h2>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
              Simulation Dataset · 8,420 Events Batch
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            PayNexa was evaluated against a static baseline recovery strategy using the same payment-event batch to measure statistical lift across retry timing, UPI failovers, and salary cycles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onOpenAssistant("How can I optimize our current recovery experiments for higher lift?")}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0F172A] hover:bg-[#16213A] text-xs font-bold text-slate-200 hover:text-white border border-[#263553] transition-colors shadow-sm cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Ask AI Strategy Optimizer</span>
          </button>
        </div>
      </div>

      {/* Top Aggregated Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111A30] border border-[#263553] p-5 rounded-xl space-y-2 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Total Incremental Lift</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {formatINR(totalIncrementalRecoveredINR * 100)}
          </div>
          <p className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            +{avgLift}% avg lift across cohort
          </p>
        </div>

        <div className="bg-[#111A30] border border-[#263553] p-5 rounded-xl space-y-2 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Active Strategies</span>
            <Zap className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {experiments.filter((e) => e.status === 'RUNNING').length} Running
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            1 concluded with verified statistical significance
          </p>
        </div>

        <div className="bg-[#111A30] border border-[#263553] p-5 rounded-xl space-y-2 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Transactions Tested</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {totalEligible.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            Sample split 50% Control / 50% Variant
          </p>
        </div>

        <div className="bg-[#111A30] border border-[#263553] p-5 rounded-xl space-y-2 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Confidence Level</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            99.6% Avg
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            p &lt; 0.005 (Statistically significant)
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#263553] pb-3">
        {(['ALL', 'RUNNING', 'CONCLUDED'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeFilter === filter
                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-white hover:bg-[#16213A]'
            }`}
          >
            {filter === 'ALL' ? 'All Experiments' : filter === 'RUNNING' ? 'Active Strategies' : 'Concluded Benchmarks'}
          </button>
        ))}
      </div>

      {/* Experiments List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredExperiments.map((exp) => {
          const isRunning = exp.status === 'RUNNING';
          return (
            <div
              key={exp.id}
              className="bg-[#111A30] border border-[#263553] hover:border-blue-500/40 rounded-2xl p-5 space-y-4 transition-all shadow-md"
            >
              {/* Header info */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        isRunning
                          ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                          : 'bg-[#16213A] text-slate-400 border-[#263553]'
                      }`}
                    >
                      {exp.status}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 font-medium">
                      Started {exp.startDate}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white leading-snug">{exp.title}</h3>
                  <p className="text-xs text-slate-300 font-medium">{exp.description}</p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-0.5 justify-end">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    +{exp.liftPercentage}% Lift
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    {exp.statisticalSignificance}% conf
                  </span>
                </div>
              </div>

              {/* Strategies Comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#0F172A] border border-[#263553] space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-mono font-semibold">
                    <span>Control (Baseline)</span>
                    <span className="text-slate-200 font-bold">{(exp.controlRecoveryRate * 100).toFixed(1)}%</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium">{exp.controlStrategy}</p>
                  <div className="w-full h-1.5 bg-[#16213A] rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-slate-500 rounded-full"
                      style={{ width: `${exp.controlRecoveryRate * 100}%` }}
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/30 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-blue-400 uppercase font-mono font-bold">
                    <span>PayNexa Variant</span>
                    <span>{(exp.variantRecoveryRate * 100).toFixed(1)}%</span>
                  </div>
                  <p className="text-[11px] text-slate-200 font-medium">{exp.variantStrategy}</p>
                  <div className="w-full h-1.5 bg-[#0F172A] rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${exp.variantRecoveryRate * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Bottom stats & CTA */}
              <div className="flex items-center justify-between pt-2 border-t border-[#263553] text-xs">
                <div className="flex items-center gap-4 text-slate-400">
                  <div>
                    <span className="text-[10px] block font-semibold">Eligible Cases</span>
                    <span className="font-mono text-white font-bold">{exp.eligibleTransactionsCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] block font-semibold">Incremental Revenue</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {formatINR(exp.incrementalRecoveredINR * 100)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onOpenAssistant(`Explain experiment '${exp.title}' and how to scale it.`)}
                  className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 font-bold px-3 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 transition-colors cursor-pointer"
                >
                  <span>AI Breakdown</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
