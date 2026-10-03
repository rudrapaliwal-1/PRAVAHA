import React from 'react';
import {
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  X,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Cpu,
  CheckCircle2,
  Sliders,
  ShieldCheck,
  Bot,
  Zap,
} from 'lucide-react';
import { useDemoFlow, DEMO_STEPS } from '../context/DemoFlowContext';

export const HackathonDemoBar: React.FC = () => {
  const {
    isDemoActive,
    currentStep,
    currentStepDef,
    isPlaying,
    stepStatus,
    error,
    stopDemo,
    nextStep,
    prevStep,
    goToStep,
    toggleAutoPlay,
    executeCurrentStepAction,
  } = useDemoFlow();

  if (!isDemoActive) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-2 sm:p-3 bg-slate-950/95 border-t-2 border-cyan-500/80 shadow-[0_-10px_35px_rgba(6,182,212,0.25)] backdrop-blur-md font-mono text-xs">
      <div className="max-w-7xl mx-auto flex flex-col gap-2">
        {/* Top Header: Step Indicator, Title & Primary Action Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Stage Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-950 border border-cyan-500/60 text-cyan-300 font-bold text-[11px] shrink-0 shadow-glow-cyan">
              <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>STAGE {currentStep} / {DEMO_STEPS.length}</span>
            </div>

            {/* Title & Narrative */}
            <div className="min-w-0">
              <div className="text-white font-bold text-xs sm:text-sm truncate flex items-center gap-2">
                <span>{currentStepDef.title}</span>
                {stepStatus === 'executing' ? (
                  <span className="text-[10px] text-cyan-400 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>EXECUTING API...</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>READY</span>
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 truncate hidden sm:block">
                {currentStepDef.judgeNarrative}
              </div>
            </div>
          </div>

          {/* Action Buttons: Auto-Play, Step Controls, Exit */}
          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            {/* Auto-Play Toggle */}
            <button
              onClick={toggleAutoPlay}
              className={`px-3 py-1.5 rounded-lg border font-bold text-xs flex items-center gap-1.5 transition-all ${
                isPlaying
                  ? 'bg-amber-950/80 border-amber-500/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                  : 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300 hover:bg-cyan-900/80 shadow-glow-cyan'
              }`}
              title={isPlaying ? 'Pause 3-minute auto pacing' : 'Start 3-minute timed progression'}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>PAUSE AUTO</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>▶ AUTO-PLAY (3-MIN)</span>
                </>
              )}
            </button>

            {/* Prev Step */}
            <button
              onClick={prevStep}
              disabled={currentStep <= 1 || stepStatus === 'executing'}
              className="p-1.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 disabled:opacity-40"
              title="Previous Step"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Next Step */}
            <button
              onClick={nextStep}
              disabled={currentStep >= DEMO_STEPS.length || stepStatus === 'executing'}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all shadow-glow-green"
              title="Advance to next stage"
            >
              <span>NEXT STEP</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Exit Demo */}
            <button
              onClick={stopDemo}
              className="p-1.5 rounded bg-slate-900/90 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition-colors ml-1"
              title="Exit Demo Mode"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step Navigation Pills (1 to 13) */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
          {DEMO_STEPS.map((s) => {
            const isCurrent = s.step === currentStep;
            const isCompleted = s.step < currentStep;

            return (
              <button
                key={s.step}
                onClick={() => goToStep(s.step)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap transition-all flex items-center gap-1 border ${
                  isCurrent
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-glow-cyan'
                    : isCompleted
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30 hover:border-emerald-500/60'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
                title={s.title}
              >
                <span>{s.step}</span>
                <span className="hidden xl:inline truncate max-w-[90px]">{s.shortLabel.split(':')[1] || s.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Error notification if step failed */}
        {error && (
          <div className="p-2 rounded bg-rose-950/80 border border-rose-500/50 text-rose-300 text-[11px] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Step Execution Error: {error}</span>
            </div>
            <button
              onClick={executeCurrentStepAction}
              className="px-2 py-0.5 rounded bg-rose-900 text-rose-100 font-bold hover:bg-rose-800"
            >
              RETRY STEP
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
