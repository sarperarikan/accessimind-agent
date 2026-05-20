import { create } from "zustand";
import type { ToolEntry } from "@/components/ToolCall";
import type { ConnectionState } from "@/lib/gatewayClient";

// MessageEntry type - defined inline (MessageBubble is in SessionsPage.tsx)
export interface MessageEntry {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  reasoning?: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

interface SessionInfo {
  cwd?: string;
  model?: string;
  provider?: string;
  credential_warning?: string;
}

interface ChatState {
  // Connection
  connectionState: ConnectionState;
  sessionId: string | null;
  info: SessionInfo;
  error: string | null;

  // Data
  messages: MessageEntry[];
  tools: ToolEntry[];
  thinking: string;
  progressLabel: string | null;
  approvalRequest: { question: string; choices?: string[] } | null;

  // UI
  inputText: string;
  attachedFiles: File[];
  showReasoning: boolean;
  modelOpen: boolean;

  // Actions
  setConnectionState: (s: ConnectionState) => void;
  setSessionId: (id: string | null) => void;
  setInfo: (info: Partial<SessionInfo>) => void;
  setError: (err: string | null) => void;

  setMessages: (fn: (prev: MessageEntry[]) => MessageEntry[]) => void;
  addMessage: (msg: MessageEntry) => void;
  updateLastAssistantMessage: (fn: (msg: MessageEntry) => MessageEntry) => void;

  setTools: (fn: (prev: ToolEntry[]) => ToolEntry[]) => void;
  addTool: (tool: ToolEntry) => void;
  updateTool: (toolId: string, fn: (tool: ToolEntry) => ToolEntry) => void;

  setThinking: (t: string) => void;
  setProgressLabel: (l: string | null) => void;
  setApprovalRequest: (a: { question: string; choices?: string[] } | null) => void;

  setInputText: (t: string) => void;
  setAttachedFiles: (fn: (prev: File[]) => File[]) => void;
  setShowReasoning: (v: boolean) => void;
  setModelOpen: (v: boolean) => void;

  clearAll: () => void;
}

const MSG_LIMIT = 200;
const TOOL_LIMIT = 20;

export const useChatStore = create<ChatState>((set) => ({
  connectionState: "idle",
  sessionId: null,
  info: {},
  error: null,
  messages: [],
  tools: [],
  thinking: "",
  progressLabel: null,
  approvalRequest: null,
  inputText: "",
  attachedFiles: [],
  showReasoning: false,
  modelOpen: false,

  setConnectionState: (connectionState) => set({ connectionState }),
  setSessionId: (sessionId) => set({ sessionId }),
  setInfo: (patch) => set((s) => ({ info: { ...s.info, ...patch } })),
  setError: (error) => set({ error }),

  setMessages: (fn) => set((s) => ({ messages: fn(s.messages).slice(-MSG_LIMIT) })),
  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg].slice(-MSG_LIMIT) })),
  updateLastAssistantMessage: (fn) =>
    set((s) => {
      const last = s.messages[s.messages.length - 1];
      if (!last || last.role !== "assistant") return s;
      const next = [...s.messages];
      next[next.length - 1] = fn(last);
      return { messages: next };
    }),

  setTools: (fn) => set((s) => ({ tools: fn(s.tools).slice(-TOOL_LIMIT) })),
  addTool: (tool) =>
    set((s) => ({ tools: [...s.tools, tool].slice(-TOOL_LIMIT) })),
  updateTool: (toolId, fn) =>
    set((s) => ({
      tools: s.tools.map((t) => (t.tool_id === toolId ? fn(t) : t)),
    })),

  setThinking: (thinking) => set({ thinking }),
  setProgressLabel: (progressLabel) => set({ progressLabel }),
  setApprovalRequest: (approvalRequest) => set({ approvalRequest }),

  setInputText: (inputText) => set({ inputText }),
  setAttachedFiles: (fn) =>
    set((s) => ({ attachedFiles: fn(s.attachedFiles).slice(0, 5) })),
  setShowReasoning: (showReasoning) => set({ showReasoning }),
  setModelOpen: (modelOpen) => set({ modelOpen }),

  clearAll: () =>
    set({
      messages: [],
      tools: [],
      thinking: "",
      progressLabel: null,
      error: null,
      approvalRequest: null,
      inputText: "",
      attachedFiles: [],
    }),
}));
