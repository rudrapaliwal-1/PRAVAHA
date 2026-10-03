import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Cpu,
  ArrowDown,
  ArrowRight,
  RefreshCw,
  Shield,
  Layers,
  Activity,
  Terminal,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Info,
  Trash2,
  Compass,
  Sliders,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { CopilotRequest, CopilotResponse } from '../types';
import { apiService } from '../services/api';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  referencedEntities?: string[];
  contextSummary?: string;
  provider?: string;
}

const EXAMPLE_QUESTIONS = [
  'Why was Vehicle V12 selected?',
  'Why did Route R4 change?',
  'Which locations are at risk?',
  'Why did the resilience score decrease?',
  'What changed after the disruption?',
];

const ADDITIONAL_QUESTIONS = [
  'Why was Vehicle VEH-01 selected?',
  'What is the quickest safe corridor for medical resupply?',
];

export const AICopilotPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'ai',
      text: 'MissionPath AI Logistics Copilot initialized and grounded in active CP-SAT optimization results, road graph states, and real-time telemetry. Ask any question regarding vehicle assignments, route changes, shortage forecasts, or disruption impacts.',
      timestamp: new Date().toLocaleTimeString(),
      provider: 'deterministic_grounded_engine',
      contextSummary: 'Live connection established to FastAPI backend and Google OR-Tools CP-SAT solver.',
    },
  ]);

  const [inputQuestion, setInputQuestion] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Grounding options sent with CopilotRequest
  const [includeOptimization, setIncludeOptimization] = useState<boolean>(true);
  const [includeResilience, setIncludeResilience] = useState<boolean>(true);
  const [includeShortages, setIncludeShortages] = useState<boolean>(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  // Transmit query to backend POST /api/copilot
  const handleSend = async (questionText?: string) => {
    const q = (questionText || inputQuestion).trim();
    if (!q || isProcessing) return;

    setError(null);
    const userMsgId = `usr-${Date.now()}`;
    const userTimestamp = new Date().toLocaleTimeString();

    // 1. Append User Question
    const userMessage: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: q,
      timestamp: userTimestamp,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuestion('');
    setIsProcessing(true);

    try {
      // 2. Call backend Copilot API (Zero frontend guessing or hallucination)
      const payload: CopilotRequest = {
        question: q,
        include_optimization: includeOptimization,
        include_resilience: includeResilience,
        include_shortages: includeShortages,
      };

      const response: CopilotResponse = await apiService.postCopilot(payload);

      // 3. Append Grounded AI Response
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: response.answer,
        timestamp: response.timestamp
          ? new Date(response.timestamp).toLocaleTimeString()
          : new Date().toLocaleTimeString(),
        referencedEntities: response.referenced_entities || [],
        contextSummary: response.context_summary || '',
        provider: response.provider || 'deterministic_grounded_engine',
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      console.error('Failed to query Copilot API:', err);
      const errMsg = err?.message || 'Unable to communicate with Copilot service.';
      setError(errMsg);

      const errorAiMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: `Error connecting to Copilot API: ${errMsg}. Please ensure the backend is active at port 8000.`,
        timestamp: new Date().toLocaleTimeString(),
        provider: 'system_error_handler',
      };
      setMessages((prev) => [...prev, errorAiMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `init-${Date.now()}`,
        sender: 'ai',
        text: 'Session reset. Connected to CP-SAT solver and active network state. Ask any operational question.',
        timestamp: new Date().toLocaleTimeString(),
        provider: 'deterministic_grounded_engine',
      },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-[10px] font-mono font-semibold text-cyan-400">
              AI-09 // LOGISTICS COPILOT
            </span>
            <span className="text-xs font-mono text-slate-500">
              ENDPOINT: POST /api/copilot (Grounded Explanation Engine)
            </span>
          </div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-white mt-1">
            MissionPath AI Logistics Copilot
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Natural language operational explanation layer strictly grounded in Google OR-Tools CP-SAT solver telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge label="COPILOT: ACTIVE" variant="success" pulse size="sm" />
          <button
            onClick={handleClearHistory}
            className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition flex items-center gap-1.5"
            title="Clear Chat History"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Suggested Question Chips (Requirement: Example questions) */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            Suggested Operational Questions:
          </span>
          <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
            Click any prompt to ask the copilot
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              disabled={isProcessing}
              className="text-left px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-700/80 hover:border-cyan-500/60 hover:bg-cyan-950/30 text-xs font-mono text-slate-300 hover:text-cyan-300 transition-all flex items-center gap-2 group disabled:opacity-50"
            >
              <span className="text-cyan-400 opacity-60 group-hover:opacity-100 font-bold">›</span>
              <span>"{q}"</span>
            </button>
          ))}

          {ADDITIONAL_QUESTIONS.map((q, idx) => (
            <button
              key={`add-${idx}`}
              onClick={() => handleSend(q)}
              disabled={isProcessing}
              className="text-left px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-cyan-500/40 hover:bg-cyan-950/20 text-xs font-mono text-slate-400 hover:text-cyan-300 transition-all flex items-center gap-2 group disabled:opacity-50 hidden md:flex"
            >
              <span className="text-cyan-400 opacity-40 group-hover:opacity-100">›</span>
              <span>"{q}"</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chat Conversation Area (lg:col-span-3) */}
        <div className="lg:col-span-3 flex flex-col h-[640px] rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur overflow-hidden shadow-xl">
          {/* Terminal Banner */}
          <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between font-mono text-xs">
            <div className="flex items-center gap-2 text-slate-200">
              <div className="p-1 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-400">
                <Bot className="h-4 w-4" />
              </div>
              <span className="font-bold tracking-wider">COPILOT INTERACTION LOG</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500 text-[11px]">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-semibold">GROUNDED STREAM ACTIVE</span>
            </div>
          </div>

          {/* Transcript Scroll Area (Displays: User question ↓ AI response) */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">
            {messages.map((msg, index) => {
              const isUser = msg.sender === 'user';

              return (
                <div key={msg.id} className="space-y-2">
                  {/* Message Bubble Container */}
                  <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`max-w-3xl rounded-xl p-4 md:p-5 text-xs font-mono leading-relaxed transition-all shadow-md ${
                        isUser
                          ? 'bg-gradient-to-r from-cyan-950/80 to-blue-950/80 border border-cyan-500/40 text-cyan-100'
                          : 'bg-slate-950/90 border border-slate-800 text-slate-200'
                      }`}
                    >
                      {/* Sender Tag Header */}
                      <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-slate-800/80">
                        <div className="flex items-center gap-1.5">
                          {isUser ? (
                            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                              OPERATOR INQUIRY
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                              <Cpu className="h-3 w-3" />
                              <span>AI LOGISTICS COPILOT</span>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {msg.timestamp}
                        </span>
                      </div>

                      {/* Message Content Text */}
                      <div className="whitespace-pre-line text-xs md:text-sm font-sans leading-relaxed text-slate-100">
                        {msg.text}
                      </div>

                      {/* Supporting Logistics Information (When Available) */}
                      {!isUser && (msg.referencedEntities?.length || msg.contextSummary) && (
                        <div className="mt-3.5 pt-3 border-t border-slate-800/80 space-y-2.5">
                          {/* Referenced Entities Badges */}
                          {msg.referencedEntities && msg.referencedEntities.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
                                Referenced Entities:
                              </span>
                              {msg.referencedEntities.map((entityId) => (
                                <span
                                  key={entityId}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950/80 border border-cyan-500/40 text-cyan-300"
                                >
                                  {entityId}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Context Grounding Snapshot Box */}
                          {msg.contextSummary && (
                            <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold uppercase">
                                <Info className="h-3 w-3 text-cyan-400" />
                                <span>Grounding Context Summary</span>
                              </div>
                              <p className="leading-snug text-slate-400">
                                {msg.contextSummary}
                              </p>
                            </div>
                          )}

                          {/* Model Provider */}
                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                            <span>Provider: {msg.provider || 'deterministic_grounded_engine'}</span>
                            <span className="text-emerald-400/80">✓ Strictly Non-Hallucinatory</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Flow Arrow indicating User question ↓ AI response */}
                  {isUser && index < messages.length - 1 && (
                    <div className="flex justify-center my-1 text-slate-600">
                      <div className="flex items-center gap-1 text-[10px] font-mono text-cyan-400/60 bg-slate-950/60 px-2 py-0.5 rounded-full border border-slate-800">
                        <ArrowDown className="h-3 w-3" />
                        <span>AI Response</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* In-Flight Processing Spinner */}
            {isProcessing && (
              <div className="flex flex-col items-start space-y-1.5 animate-pulse">
                <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/30 text-xs font-mono text-cyan-300 flex items-center gap-3">
                  <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />
                  <span>Consulting Google OR-Tools CP-SAT solver & synthesizing grounded response...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 md:p-4 bg-slate-950 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isProcessing}
                placeholder="Ask Copilot regarding vehicle selections, route changes, shortages, or disruptions..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-xs md:text-sm font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition shadow-inner"
              />
              <button
                onClick={() => handleSend()}
                disabled={!inputQuestion.trim() || isProcessing}
                className="px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-slate-950 font-mono text-xs md:text-sm font-bold flex items-center gap-2 transition shadow-md shadow-cyan-950/50 shrink-0"
              >
                <span>TRANSMIT</span>
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar: Guardrails & Context Tuning (lg:col-span-1) */}
        <div className="space-y-4">
          {/* Grounding Engine Info */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur space-y-3 font-mono text-xs">
            <div className="flex items-center gap-2 text-slate-200 font-bold uppercase tracking-wider text-xs">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>Grounding Guardrails</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              The AI Copilot does not hallucinate or invent vehicle routes. All explanations are strictly synthesized from mathematical CP-SAT solver results and current disaster telemetry.
            </p>
            <div className="p-2 rounded bg-slate-950 border border-slate-800/80 space-y-1 text-[10px] text-slate-400">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 className="h-3 w-3" />
                <span>Zero Hallucination Policy</span>
              </div>
              <p className="text-slate-500">
                Unknown or missing parameters are explicitly reported rather than guessed.
              </p>
            </div>
          </div>

          {/* Context Inclusion Toggles */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur space-y-3 font-mono text-xs">
            <div className="flex items-center gap-2 text-slate-200 font-bold uppercase tracking-wider text-xs">
              <Sliders className="h-4 w-4 text-cyan-400" />
              <span>Context Ingestion Toggles</span>
            </div>

            <div className="space-y-2">
              <label className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                <span className="text-[11px] text-slate-300">Optimization Plans</span>
                <input
                  type="checkbox"
                  checked={includeOptimization}
                  onChange={(e) => setIncludeOptimization(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                <span className="text-[11px] text-slate-300">Resilience Scores</span>
                <input
                  type="checkbox"
                  checked={includeResilience}
                  onChange={(e) => setIncludeResilience(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                <span className="text-[11px] text-slate-300">Shortage Forecasts</span>
                <input
                  type="checkbox"
                  checked={includeShortages}
                  onChange={(e) => setIncludeShortages(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AICopilotPage;
