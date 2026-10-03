import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../services/api';
import {
  LogisticsState,
  OptimizationResult,
  DisruptionResult,
  ReoptimizationResult,
  CourseOfActionPlan,
  PlanDecisionResponse,
  ResilienceScore,
  CopilotResponse,
  NavigationTab,
} from '../types';
import { useOperationalMode } from './OperationalModeContext';

export interface DemoStepDefinition {
  step: number;
  title: string;
  shortLabel: string;
  instruction: string;
  judgeNarrative: string;
  targetTab: NavigationTab;
  durationMs: number;
}

export const DEMO_STEPS: DemoStepDefinition[] = [
  {
    step: 1,
    title: 'Open MissionPath Command Center',
    shortLabel: 'STEP 1: INITIALIZE',
    instruction: 'Initialize single-source-of-truth logistics state snapshot on port 8000.',
    judgeNarrative: 'MissionPath boots up instantly, pulling verified live telemetry across forward operating sectors.',
    targetTab: 'dashboard',
    durationMs: 9000,
  },
  {
    step: 2,
    title: 'Select: 🚨 DISASTER RESPONSE Mode',
    shortLabel: 'STEP 2: DISASTER MODE',
    instruction: 'Set active operational theater to civilian Disaster Relief & Medical Evacuation.',
    judgeNarrative: 'Context adapts seamlessly to hospitals, evacuation camps, medical payloads, and disaster triage.',
    targetTab: 'dashboard',
    durationMs: 8000,
  },
  {
    step: 3,
    title: 'Showcase Real-Time Operational Infrastructure',
    shortLabel: 'STEP 3: LIVE INFRASTRUCTURE',
    instruction: 'Inspect live logistics map, fleet convoys, supply depots, demand points, and resilience score.',
    judgeNarrative: 'Comprehensive visibility: 10 tracked carrier units, 3 strategic relief depots, 6 critical demand hubs.',
    targetTab: 'dashboard',
    durationMs: 12000,
  },
  {
    step: 4,
    title: 'Run Initial CP-SAT Network Optimization',
    shortLabel: 'STEP 4: CP-SAT DISPATCH',
    instruction: 'Execute Google OR-Tools CP-SAT optimizer to determine optimal vehicle allocations.',
    judgeNarrative: 'CP-SAT calculates optimal multi-commodity vehicle-to-node dispatches with minimal travel time.',
    targetTab: 'dashboard',
    durationMs: 12000,
  },
  {
    step: 5,
    title: 'Trigger Disruption: 🚧 BLOCK ROUTE',
    shortLabel: 'STEP 5: INJECT DISRUPTION',
    instruction: 'Inject real-time mountain corridor blockage on primary transit route ROUTE-03.',
    judgeNarrative: 'Simulating landslide or bridge breach. Backend disruption engine mutates road graph in real time.',
    targetTab: 'dashboard',
    durationMs: 10000,
  },
  {
    step: 6,
    title: '⚠ ROUTE DISRUPTION DETECTED',
    shortLabel: 'STEP 6: DISRUPTION ALERT',
    instruction: 'Immediate impact analysis: isolated vehicles, compromised deliveries, and schedule delay.',
    judgeNarrative: 'Automated hazard telemetry detects compromised shipments, halted vehicles, and severe ETA delays.',
    targetTab: 'dashboard',
    durationMs: 12000,
  },
  {
    step: 7,
    title: 'Execute Dynamic Re-Optimization',
    shortLabel: 'STEP 7: RE-OPTIMIZE',
    instruction: 'Click RE-OPTIMIZE: ANALYZING → CP-SAT → NEW PLAN GENERATED.',
    judgeNarrative: 'CP-SAT re-solves the constrained road network in under 2 seconds, finding bypass mountain passes.',
    targetTab: 'optimization',
    durationMs: 14000,
  },
  {
    step: 8,
    title: 'Display Courses of Action (COA) Candidates',
    shortLabel: 'STEP 8: COA EVALUATION',
    instruction: 'Compare three feasible plans: FASTEST, LOWEST RISK, and RESOURCE EFFICIENT.',
    judgeNarrative: 'Multi-objective Pareto optimization: human operators choose trade-offs between speed, risk, and fuel.',
    targetTab: 'optimization',
    durationMs: 14000,
  },
  {
    step: 9,
    title: 'Operator Selects Operational Plan',
    shortLabel: 'STEP 9: PLAN SELECTION',
    instruction: 'Human commander selects LOWEST RISK strategy to avoid hazardous mountain terrain.',
    judgeNarrative: 'Human-in-the-loop: autonomous execution is prohibited; commander retains command authority.',
    targetTab: 'optimization',
    durationMs: 9000,
  },
  {
    step: 10,
    title: 'Click: APPROVE PLAN',
    shortLabel: 'STEP 10: APPROVE PLAN',
    instruction: 'Authorize plan decision via POST /api/plans/{id}/approve.',
    judgeNarrative: 'Formal decision logged with audit trail; plan state transitions to APPROVED and broadcasts coordinates.',
    targetTab: 'optimization',
    durationMs: 10000,
  },
  {
    step: 11,
    title: 'Update Global Fleet Telemetry & Resilience',
    shortLabel: 'STEP 11: FIELD TELEMETRY UPDATE',
    instruction: 'Verified updates across Map, Routes, Vehicle Assignments, ETA, and Resilience Score.',
    judgeNarrative: 'Network resilience score updates dynamically; convoy routes re-render with bypass vectors.',
    targetTab: 'dashboard',
    durationMs: 12000,
  },
  {
    step: 12,
    title: 'Ask AI Logistics Copilot: "Why did the route change?"',
    shortLabel: 'STEP 12: AI COPILOT QUERY',
    instruction: 'Query grounded natural language explanation layer via POST /api/copilot.',
    judgeNarrative: 'Zero hallucination: AI Copilot provides an explanation strictly grounded in CP-SAT solver results.',
    targetTab: 'ai-copilot',
    durationMs: 16000,
  },
  {
    step: 13,
    title: 'Switch to: 🪖 MILITARY LOGISTICS SUPPORT Mode',
    shortLabel: 'STEP 13: MILITARY THEATER',
    instruction: 'Demonstrate the exact same optimization platform handling a military forward sustainment scenario.',
    judgeNarrative: 'Dual-use capability: Same mathematical solver powers tactical convoy sustainment with zero weapons.',
    targetTab: 'dashboard',
    durationMs: 14000,
  },
];

export interface DemoStepData {
  initialState?: LogisticsState | null;
  optResult?: OptimizationResult | null;
  disruptionResult?: DisruptionResult | null;
  reoptResult?: ReoptimizationResult | null;
  coaPlans?: CourseOfActionPlan[];
  selectedPlanId?: string | null;
  approvedPlan?: PlanDecisionResponse | null;
  resilienceScore?: ResilienceScore | null;
  copilotResponse?: CopilotResponse | null;
}

interface DemoFlowContextType {
  isDemoActive: boolean;
  currentStep: number;
  currentStepDef: DemoStepDefinition;
  isPlaying: boolean;
  stepStatus: 'idle' | 'executing' | 'completed' | 'error';
  stepData: DemoStepData;
  error: string | null;
  startDemo: () => Promise<void>;
  stopDemo: () => void;
  nextStep: () => Promise<void>;
  prevStep: () => Promise<void>;
  goToStep: (stepNumber: number) => Promise<void>;
  toggleAutoPlay: () => void;
  executeCurrentStepAction: () => Promise<void>;
}

const DemoFlowContext = createContext<DemoFlowContextType | undefined>(undefined);

export const DemoFlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setMode } = useOperationalMode();
  const [isDemoActive, setIsDemoActive] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [stepStatus, setStepStatus] = useState<'idle' | 'executing' | 'completed' | 'error'>('idle');
  const [stepData, setStepData] = useState<DemoStepData>({});
  const [error, setError] = useState<string | null>(null);

  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentStepDef = DEMO_STEPS[currentStep - 1] || DEMO_STEPS[0];

  // Navigate application view when step changes
  const navigateToTab = useCallback((tab: NavigationTab) => {
    window.dispatchEvent(new CustomEvent('missionpath:navigate', { detail: tab }));
  }, []);

  // Execute the concrete actions required for the active step
  const executeStep = useCallback(
    async (stepNum: number) => {
      setStepStatus('executing');
      setError(null);

      const def = DEMO_STEPS[stepNum - 1];
      if (def) {
        navigateToTab(def.targetTab);
      }

      try {
        switch (stepNum) {
          case 1: {
            // STEP 1: Reset & Open Command Center
            await apiService.postDemoRun().catch(() => null);
            const state = await apiService.getLogisticsState();
            const res = await apiService.getResilience().catch(() => null);
            setStepData((prev) => ({
              ...prev,
              initialState: state,
              resilienceScore: res,
            }));
            break;
          }

          case 2: {
            // STEP 2: Select 🚨 DISASTER RESPONSE Mode
            setMode('DISASTER_RESPONSE');
            break;
          }

          case 3: {
            // STEP 3: Show Infrastructure
            const state = await apiService.getLogisticsState();
            const res = await apiService.getResilience().catch(() => null);
            setStepData((prev) => ({
              ...prev,
              initialState: state,
              resilienceScore: res,
            }));
            break;
          }

          case 4: {
            // STEP 4: Run initial CP-SAT optimization
            const opt = await apiService.postOptimize({});
            const state = await apiService.getLogisticsState();
            setStepData((prev) => ({
              ...prev,
              optResult: opt,
              initialState: state,
            }));
            break;
          }

          case 5: {
            // STEP 5: Trigger BLOCK ROUTE on ROUTE-03
            const disrupt = await apiService.postDisruption({
              type: 'BLOCK_ROUTE',
              target_id: 'ROUTE-03',
              parameters: {},
            });
            const state = await apiService.getLogisticsState();
            setStepData((prev) => ({
              ...prev,
              disruptionResult: disrupt,
              initialState: state,
            }));
            break;
          }

          case 6: {
            // STEP 6: Show ROUTE DISRUPTION DETECTED
            // Handled via visual highlight of disruption alert banner
            const state = await apiService.getLogisticsState();
            setStepData((prev) => ({
              ...prev,
              initialState: state,
            }));
            break;
          }

          case 7: {
            // STEP 7: Click RE-OPTIMIZE (ANALYZING -> CP-SAT -> NEW PLAN GENERATED)
            const reopt = await apiService.postReoptimize({
              disruption: {
                type: 'BLOCK_ROUTE',
                target_id: 'ROUTE-03',
              },
            });
            const state = await apiService.getLogisticsState();
            setStepData((prev) => ({
              ...prev,
              reoptResult: reopt,
              initialState: state,
            }));
            window.dispatchEvent(new CustomEvent('missionpath:reoptimize', { detail: reopt }));
            break;
          }

          case 8: {
            // STEP 8: Display Courses of Action (FASTEST, LOWEST RISK, RESOURCE EFFICIENT)
            const coa = await apiService.postCoursesOfAction({});
            const candidatePlans = coa.plans || [];
            setStepData((prev) => ({
              ...prev,
              coaPlans: candidatePlans,
            }));
            break;
          }

          case 9: {
            // STEP 9: Operator selects LOWEST RISK plan
            setStepData((prev) => {
              const plans = prev.coaPlans || [];
              const lowestRisk =
                plans.find((p) => p.name === 'LOWEST_RISK') ||
                plans[1] ||
                plans[0];
              return {
                ...prev,
                selectedPlanId: lowestRisk ? lowestRisk.id : 'COA-LOWEST_RISK-01',
              };
            });
            break;
          }

          case 10: {
            // STEP 10: Click APPROVE PLAN
            setStepData((prev) => {
              const planId = prev.selectedPlanId || 'COA-LOWEST_RISK-01';
              apiService
                .postApprovePlan(planId, 'Authorized by Logistics Commander for lowest risk detour')
                .then((decision) => {
                  setStepData((curr) => ({ ...curr, approvedPlan: decision }));
                  window.dispatchEvent(
                    new CustomEvent('missionpath:plan_decision', {
                      detail: { plan_id: planId, status: 'APPROVED' },
                    })
                  );
                })
                .catch((e) => console.warn('Plan approve simulation response:', e));
              return prev;
            });
            break;
          }

          case 11: {
            // STEP 11: Update Map, Routes, Vehicle Assignments, ETA, Resilience Score
            const state = await apiService.getLogisticsState();
            const res = await apiService.getResilience().catch(() => null);
            setStepData((prev) => ({
              ...prev,
              initialState: state,
              resilienceScore: res,
            }));
            break;
          }

          case 12: {
            // STEP 12: Ask AI Copilot "Why did the route change?"
            const cop = await apiService.postCopilot({
              question: 'Why did the route change?',
              include_optimization: true,
              include_resilience: true,
              include_shortages: true,
            });
            setStepData((prev) => ({
              ...prev,
              copilotResponse: cop,
            }));
            break;
          }

          case 13: {
            // STEP 13: Switch to 🪖 MILITARY LOGISTICS SUPPORT Mode
            setMode('MILITARY_LOGISTICS');
            const state = await apiService.getLogisticsState();
            setStepData((prev) => ({
              ...prev,
              initialState: state,
            }));
            break;
          }

          default:
            break;
        }

        setStepStatus('completed');
      } catch (err: any) {
        console.error(`Demo step ${stepNum} failed:`, err);
        setError(err?.message || `Execution error on stage ${stepNum}`);
        setStepStatus('error');
      }
    },
    [navigateToTab, setMode]
  );

  // Start Demo Flow
  const startDemo = useCallback(async () => {
    setIsDemoActive(true);
    setCurrentStep(1);
    setIsPlaying(false);
    await executeStep(1);
  }, [executeStep]);

  // Stop Demo Flow
  const stopDemo = useCallback(() => {
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    setIsDemoActive(false);
    setIsPlaying(false);
    setCurrentStep(1);
    setStepStatus('idle');
    setError(null);
  }, []);

  // Advance to Next Step
  const nextStep = useCallback(async () => {
    if (currentStep < DEMO_STEPS.length) {
      const next = currentStep + 1;
      setCurrentStep(next);
      await executeStep(next);
    } else {
      setIsPlaying(false);
    }
  }, [currentStep, executeStep]);

  // Step backwards
  const prevStep = useCallback(async () => {
    if (currentStep > 1) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      await executeStep(prev);
    }
  }, [currentStep, executeStep]);

  // Jump directly to specific step
  const goToStep = useCallback(
    async (stepNumber: number) => {
      if (stepNumber >= 1 && stepNumber <= DEMO_STEPS.length) {
        setCurrentStep(stepNumber);
        await executeStep(stepNumber);
      }
    },
    [executeStep]
  );

  // Toggle Auto-Play pacing
  const toggleAutoPlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Handle auto-play timing loop
  useEffect(() => {
    if (!isDemoActive || !isPlaying) {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      return;
    }

    const duration = currentStepDef.durationMs || 10000;
    autoPlayTimerRef.current = setTimeout(() => {
      if (currentStep < DEMO_STEPS.length) {
        nextStep();
      } else {
        setIsPlaying(false);
      }
    }, duration);

    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
      }
    };
  }, [isDemoActive, isPlaying, currentStep, currentStepDef, nextStep]);

  return (
    <DemoFlowContext.Provider
      value={{
        isDemoActive,
        currentStep,
        currentStepDef,
        isPlaying,
        stepStatus,
        stepData,
        error,
        startDemo,
        stopDemo,
        nextStep,
        prevStep,
        goToStep,
        toggleAutoPlay,
        executeCurrentStepAction: () => executeStep(currentStep),
      }}
    >
      {children}
    </DemoFlowContext.Provider>
  );
};

export const useDemoFlow = (): DemoFlowContextType => {
  const context = useContext(DemoFlowContext);
  if (!context) {
    throw new Error('useDemoFlow must be used within a DemoFlowProvider');
  }
  return context;
};
