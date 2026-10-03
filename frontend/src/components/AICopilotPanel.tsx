import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Cpu,
  ArrowDown,
  ArrowRight,
  RefreshCw,
  Info,
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { apiService } from '../services/api';
import { CopilotResponse } from '../types';
import { useConnectivity } from '../context/ConnectivityContext';

interface PanelMessage {
  id: string;
  sender: 'operator' | 'copilot';
  time: string;
  text: string;
  referencedEntities?: string[];
  contextSummary?: string;
  provider?: string;
}

export const AICopilotPanel: React.FC = () => {
  const { isOffline } = useConnectivity();
  const [messages, setMessages] = useState<PanelMessage[]>([
    {
      id: '1',
      sender: 'copilot',
      time: new Date().toISOString().substring(11, 16) + ' UTC',
      text: 'MissionPath Copilot online. Connected to FastAPI backend and Google OR-Tools CP-SAT engine. Ask any operational logistics question.',
      provider: 'deterministic_grounded_engine',
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedPrompts = [
    'Why was Vehicle V12 selected?',
    'Why did Route R4 change?',
    'Which locations are at risk?',
    'Why did the resilience score decrease?',
    'What changed after the disruption?',
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  const handleSend = async (textToSend?: string) => {
    const prompt = (textToSend || inputVal).trim();
    if (!prompt || isProcessing) return;

    const userMsg: PanelMessage = {
      id: String(Date.now()),
      sender: 'operator',
      time: new Date().toISOString().substring(11, 16) + ' UTC',
      text: prompt,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');
    setIsProcessing(true);

    try {
      // Backend API call to POST /api/copilot (Single source of truth)
      const response: CopilotResponse = await apiService.postCopilot({ question: prompt });

      const copilotResponse: PanelMessage = {
        id: String(Date.now() + 1),
        sender: 'copilot',
        time: new Date().toISOString().substring(11, 16) + ' UTC',
        text: response.answer,
        referencedEntities: response.referenced_entities || [],
        contextSummary: response.context_summary || '',
        provider: response.provider || 'deterministic_grounded_engine',
      };
      setMessages((prev) => [...prev, copilotResponse]);
    } catch (err: any) {
      console.error('Copilot API call failed:', err);
      const errorResponse: PanelMessage = {
        id: String(Date.now() + 1),
        sender: 'copilot',
        time: new Date().toISOString().substring(11, 16) + ' UTC',
        text: `Error contacting Copilot API: ${err?.message || 'Connection failed'}. Check backend service.`,
        provider: 'system_error_handler',
      };
      setMessages((prev) => [...prev, errorResponse]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col h-[520px] xl:h-[560px] overflow-hidden shadow-sm backdrop-blur relative">
      {/* Top Corner HUD Accent */}
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-500/50 pointer-events-none" />

      {/* Header */}
      <div className="px-3.5 py-2.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shadow-glow-cyan">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-bold tracking-wider text-slate-100 uppercase">
                AI Logistics Copilot
              </span>
              <StatusBadge label="Grounded" variant="success" pulse size="sm" />
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              POST /api/copilot
            </span>
          </div>
        </div>

        <div className="text-[10px] font-mono text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/50 border border-cyan-500/30">
          CP-SAT INTEL
        </div>
      </div>

      {/* Quick Prompt Chips (Suggested Questions) */}
      <div className="px-3 py-2 bg-slate-950/40 border-b border-slate-800/80 shrink-0">
        <div className="text-[10px] font-mono text-slate-400 font-semibold mb-1.5 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          Suggested Operational Queries:
        </div>
        <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto pr-1">
          {suggestedPrompts.slice(0, 3).map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt)}
              disabled={isProcessing}
              className="text-left px-2 py-1 rounded bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 hover:text-cyan-300 text-[10px] font-mono text-slate-300 transition-colors truncate flex items-center justify-between group disabled:opacity-50"
            >
              <span className="truncate">"{prompt}"</span>
              <ArrowRight className="w-3 h-3 shrink-0 ml-1 opacity-60 group-hover:opacity-100 text-cyan-400" />
            </button>
          ))}
        </div>
      </div>

      {/* Message Chat Feed */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 font-mono text-xs">
        {messages.map((m, index) => {
          const isUser = m.sender === 'operator';
          return (
            <div key={m.id} className="space-y-1">
              <div
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] p-2.5 rounded-lg text-[11px] leading-relaxed shadow-sm ${
                    isUser
                      ? 'bg-cyan-950/70 border border-cyan-500/40 text-cyan-100'
                      : 'bg-slate-950/90 border border-slate-800 text-slate-300'
                  }`}
                >
                  {!isUser && (
                    <div className="flex items-center gap-1 text-[10px] text-cyan-400 font-bold mb-1">
                      <Cpu className="w-3 h-3" />
                      <span>Grounded Intel Core</span>
                    </div>
                  )}
                  <div className="whitespace-pre-line font-sans leading-relaxed">
                    {m.text}
                  </div>

                  {/* Supporting Logistics Information when available */}
                  {!isUser && (m.referencedEntities?.length || m.contextSummary) && (
                    <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1.5 font-mono">
                      {m.referencedEntities && m.referencedEntities.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[9px] text-slate-500 uppercase">Referenced:</span>
                          {m.referencedEntities.map((ent) => (
                            <span
                              key={ent}
                              className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-[9px] font-bold"
                            >
                              {ent}
                            </span>
                          ))}
                        </div>
                      )}
                      {m.contextSummary && (
                        <div className="text-[10px] text-slate-400 bg-slate-900/60 p-1.5 rounded border border-slate-800/60">
                          <span className="text-slate-500 block uppercase text-[8px]">Context:</span>
                          {m.contextSummary}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <span className="text-[9px] text-slate-500 mt-1 px-1">
                  {isUser ? 'OPERATOR-01' : 'MISSIONPATH COPILOT'} • {m.time}
                </span>
              </div>

              {/* Downward indicator: User question ↓ AI response */}
              {isUser && index < messages.length - 1 && (
                <div className="flex justify-center text-cyan-500/40 py-0.5">
                  <ArrowDown className="w-3 h-3" />
                </div>
              )}
            </div>
          );
        })}

        {isProcessing && (
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-[11px] py-1">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Consulting OR-Tools state & synthesizing answer...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-2.5 bg-slate-950 border-t border-slate-800 shrink-0">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing || isOffline}
            placeholder={
              isOffline
                ? '🔴 Copilot locked: Live backend connection required...'
                : 'Ask Copilot regarding fleet, routes, or disruptions...'
            }
            className={`flex-1 bg-slate-900 border border-slate-700/80 rounded px-2.5 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors ${
              isOffline ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputVal.trim() || isProcessing || isOffline}
            className="px-2.5 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-slate-950 font-mono text-xs font-bold flex items-center gap-1 transition-colors shadow-glow-cyan"
            title={isOffline ? 'Disabled in offline mode' : 'Transmit Query'}
          >
            <span>SEND</span>
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AICopilotPanel;
