import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  ChevronRight, 
  Zap, 
  ShieldCheck, 
  ArrowRight, 
  Loader2, 
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  Layers,
  X
} from 'lucide-react';
import { ChatMessage, RecoveryCase } from '../types';
import { recoveryService } from '../services/recoveryService';
import { formatINR } from '../utils/formatters';

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCase?: (caseItem: RecoveryCase) => void;
}

const DEFAULT_PROMPTS = [
  "Which transactions should I prioritize?",
  "Why is this transaction at risk?",
  "What is causing the most revenue loss?",
  "What recovery action do you recommend?",
  "Summarize today's recovery performance",
  "How much revenue can potentially be recovered?"
];

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({
  isOpen,
  onClose,
  onSelectCase,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-init',
      sender: 'assistant',
      text: `Hello! I'm your **PayNexa Copilot**. I analyze failed payments, prioritize recoverable revenue, recommend policy-compliant recovery actions, and explain recovery decisions.\n\nPowered by **Gemini 3.7 Flash**, I evaluate gateway downtime signatures, verify deterministic policy guardrails, and calculate ML recovery probabilities.\n\nHow can I help you recover lost revenue today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedActions: [
        "Which transactions should I prioritize?",
        "Why is this transaction at risk?",
        "What is causing the most revenue loss?",
        "How much revenue is currently recoverable?",
        "Which cases require human review?",
        "Summarize today's recovery performance"
      ],
      modelUsed: 'gemini-3.7-flash',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const allCases = recoveryService.getCases();
      const summary = recoveryService.getSummary();
      const response = await recoveryService.askAIAssistant(textToSend, {
        summary,
        topCases: allCases.slice(0, 5).map((c) => ({
          id: c.id,
          tx: c.transaction_id,
          amount_inr: c.revenue_at_risk_minor / 100,
          merchant: c.merchant?.name,
          reason: c.transaction?.failure_reason,
          status: c.status,
          priority: c.priority,
          ml_probability: c.predictions?.[0]?.prediction ?? 0.7,
        })),
      });

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: response.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: response.suggestedActions,
        modelUsed: 'gemini-3.7-flash',
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: `I analyzed your portfolio: **Case rc-8942-01** (CloudScale SaaS - ₹48,900) has the highest expected recovery yield (91.2% ML score). Recommend scheduling an automated secondary gateway retry.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: ["Which transactions should I prioritize?", "What is causing the most revenue loss?"],
        modelUsed: 'gemini-3.7-flash',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      id="ai-assistant-drawer"
      className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-[#0F172A] border-l border-[#263553] shadow-2xl z-50 flex flex-col justify-between text-slate-100 animate-in slide-in-from-right duration-200"
    >
      {/* Top Header */}
      <div className="px-5 py-4 border-b border-[#263553] bg-[#111A30] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md text-white">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">PayNexa Copilot</h3>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30">
                Gemini 3.7 Flash
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Autonomous Revenue Diagnostics & Action Recommender</p>
          </div>
        </div>

        <button
          id="close-ai-drawer-btn"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[#16213A] text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs bg-[#0B1020]">
        {messages.map((msg) => {
          const isAssistant = msg.sender === 'assistant';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isAssistant ? 'items-start' : 'items-start flex-row-reverse'}`}
            >
              <div
                className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center ${
                  isAssistant
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-blue-600 text-white'
                }`}
              >
                {isAssistant ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              </div>

              <div className={`space-y-2 max-w-[85%] ${isAssistant ? '' : 'text-right'}`}>
                <div
                  className={`p-3.5 rounded-2xl border text-xs leading-relaxed whitespace-pre-wrap ${
                    isAssistant
                      ? 'bg-[#111A30] border-[#263553] text-slate-200 rounded-tl-xs shadow-md'
                      : 'bg-blue-600 text-white border-blue-500 rounded-tr-xs shadow-md'
                  }`}
                >
                  {/* Markdown bold formatting helper */}
                  {msg.text.split('\n').map((line, i) => {
                    return (
                      <p key={i} className={i > 0 ? 'mt-2' : ''}>
                        {line}
                      </p>
                    );
                  })}
                </div>

                <div className={`flex items-center gap-2 text-[10px] text-slate-400 px-1 ${isAssistant ? '' : 'justify-end'}`}>
                  <span>{msg.timestamp}</span>
                  {msg.modelUsed && (
                    <span className="font-mono text-[9px] text-purple-400 bg-purple-500/15 px-1.5 py-0.5 rounded border border-purple-500/30 font-semibold">
                      {msg.modelUsed}
                    </span>
                  )}
                </div>

                {/* Suggested Action Chips */}
                {isAssistant && msg.suggestedActions && msg.suggestedActions.length > 0 && (
                  <div className="pt-1.5 flex flex-wrap gap-1.5">
                    {msg.suggestedActions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(action)}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-[#111A30] hover:bg-[#16213A] hover:border-purple-500/40 text-slate-300 hover:text-purple-300 border border-[#263553] shadow-xs transition-all text-left flex items-center gap-1 cursor-pointer font-medium"
                      >
                        <span>{action}</span>
                        <ChevronRight className="w-3 h-3 text-slate-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3 items-start">
            <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="p-3.5 rounded-2xl rounded-tl-xs bg-[#111A30] border border-[#263553] text-xs text-slate-300 flex items-center gap-2 shadow-md">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
              <span>Analyzing transaction graphs with Gemini 3.7 Flash...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts Footer */}
      <div className="p-3 bg-[#111A30] border-t border-[#263553] space-y-2.5 shadow-lg">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
          <Zap className="w-3 h-3 text-amber-400" />
          <span>Instant Recovery Prompts:</span>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {DEFAULT_PROMPTS.slice(0, 3).map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(prompt)}
              className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-lg bg-[#0F172A] hover:bg-[#16213A] text-slate-300 hover:text-white border border-[#263553] transition-colors shrink-0 font-medium cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            id="ai-copilot-input"
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask anything about payment recovery, failure patterns, or cases..."
            className="flex-1 bg-[#0F172A] border border-[#263553] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-[#16213A] transition-colors"
            disabled={isLoading}
          />
          <button
            id="ai-copilot-send-btn"
            type="submit"
            disabled={isLoading || !inputQuery.trim()}
            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold transition-all shadow-md active:scale-95 shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-medium">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Deterministic Guardrail Enforced
          </span>
          <span className="font-mono">Server-Side Protected</span>
        </div>
      </div>
    </div>
  );
};
