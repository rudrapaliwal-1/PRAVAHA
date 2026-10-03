import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw, CheckCircle2, ArrowRight, Zap } from 'lucide-react';
import { useDemoFlow } from '../context/DemoFlowContext';

export const DemoReoptimizationStepper: React.FC = () => {
  const { isDemoActive, currentStep, stepStatus, nextStep } = useDemoFlow();
  const [subStep, setSubStep] = useState<number>(1); // 1 = ANALYZING, 2 = CP-SAT, 3 = NEW PLAN GENERATED

  useEffect(() => {
    if (isDemoActive && currentStep === 7) {
      setSubStep(1);
      const t1 = setTimeout(() => setSubStep(2), 1200);
      const t2 = setTimeout(() => setSubStep(3), 2800);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [isDemoActive, currentStep]);

  if (!isDemoActive || currentStep !== 7) {
    return null;
  }

  const steps = [
    { num: 1, label: 'ANALYZING', desc: 'Isolating compromised corridor & impact' },
    { num: 2, label: 'CP-SAT', desc: 'Solving multi-vehicle detour constraints' },
    { num: 3, label: 'NEW PLAN GENERATED', desc: 'Optimal alternative routes ready for review' },
  ];

  return (
    <div className="rounded-xl border border-cyan-500/60 bg-slate-900/90 p-4 sm:p-5 shadow-glow-cyan font-mono animate-fade-in backdrop-blur">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-glow-cyan">
            <Cpu className="w-4 h-4 animate-spin" />
          </div>
          <div>
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
              REAL-TIME RE-OPTIMIZATION SEQUENCE // STAGE 7
            </span>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>Google OR-Tools CP-SAT Dynamic Solver</span>
            </h3>
          </div>
        </div>

        {subStep === 3 && (
          <button
            onClick={() => nextStep()}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-glow-green shrink-0 animate-bounce"
          >
            <span>VIEW CANDIDATE PLANS (STEP 8)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Stepper Visual: ANALYZING → CP-SAT → NEW PLAN GENERATED */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-4">
        {steps.map((st) => {
          const isDone = subStep > st.num || subStep === 3;
          const isCurrent = subStep === st.num && subStep !== 3;

          return (
            <div
              key={st.num}
              className={`p-3.5 rounded-lg border flex items-center gap-3 transition-all ${
                isDone
                  ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300'
                  : isCurrent
                  ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200 shadow-glow-cyan'
                  : 'bg-slate-950/60 border-slate-800 text-slate-500'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                  isDone
                    ? 'bg-emerald-500 text-slate-950'
                    : isCurrent
                    ? 'bg-cyan-400 text-slate-950 animate-pulse'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isDone ? <CheckCircle2 className="w-4 h-4 stroke-[2.5]" /> : st.num}
              </div>

              <div className="min-w-0">
                <div className="font-bold text-xs uppercase tracking-wide">
                  {st.label}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {st.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
