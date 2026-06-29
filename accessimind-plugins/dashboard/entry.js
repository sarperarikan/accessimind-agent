/**
 * AccessiMind Chat — Modern chat UI plugin for the Hermes dashboard.
 *
 * Uses the /api/ws JSON-RPC WebSocket for structured communication:
 * - prompt.submit to send messages
 * - message.start/delta/complete for streaming responses
 * - thinking.delta for reasoning/thinking display
 * - tool.start/complete for tool call indicators
 *
 * Accessibility features:
 * - Full ARIA labelling (roles, labels, live regions)
 * - Screen-reader announcements for all state changes
 * - Skip link for keyboard navigation
 * - Focus management on connect/disconnect
 * - Keyboard shortcuts (Enter, Shift+Enter, Escape)
 * - High-contrast and reduced-motion support
 * - Character counter with warnings
 * - Message copy functionality
 * - Scroll-to-bottom with visibility detection
 *
 * Update-safe: lives in ~/.hermes/plugins/ which `hermes update` never touches.
 */
(function () {
  const SDK = window.__HERMES_PLUGIN_SDK__ ?? {};
  const React = SDK.React ?? window.React;
  const { useState, useEffect, useRef, useCallback, useMemo } = React;
  const { buildWsAuthParam } = {
    buildWsAuthParam: SDK.buildWsAuthParam,
  };

  // ── Icon Library (expanded, consistent stroke-based) ───────────────
  const Icon = ({ name, className = "h-4 w-4", title, desc }) => {
    const icons = {
      // Communication
      send: { d: "M2.01 21L23 12 2.01 3 2 10l15 2-15 2z", fill: true },
      refresh: { d: "M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z", fill: true },
      stop: { d: "M6 6h12v12H6z", fill: true },
      // Users
      user: { d: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z", fill: true },
      bot: { d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z", fill: true },
      // Brand / status
      sparkles: { d: "M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2z", fill: true },
      brain: { d: "M12 2c-4.97 0-9 4.03-9 9 0 4.97 4.03 9 9 9s9-4.03 9-9c0-4.97-4.03-9-9-9zm-1 5h2v4h-2V7zm0 6h2v2h-2v-2z", fill: true },
      tool: { d: "M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z", fill: true },
      // Actions
      copy: { d: "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z", fill: true },
      check: { d: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z", fill: true },
      trash: { d: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z", fill: true },
      // Navigation
      chevronDown: { d: "M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z", fill: true },
      chevronUp: { d: "M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z", fill: true },
      arrowDown: { d: "M7 10l5 5 5-5z", fill: true },
      // Feedback
      alertCircle: { d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z", fill: true },
      info: { d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z", fill: true },
      // Misc
      message: { d: "M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z", fill: true },
      lightning: { d: "M7 2v11h3v9l7-12h-4l4-8z", fill: true },
      keyboard: { d: "M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-3 0h2v2H5v-2zm0-3h2v2H5V8zm3 7H5v-2h3v2zm10 0h-3v-2h3v2zm-3-4h2v2h-2v-2zm0-3h2v2h-2V8zm-3 3h2v2h-2v-2zm0-3h2v2h-2V8z", fill: true },
      zap: { d: "M13 2L3 14h7l-1 8 10-12h-7l1-8z", fill: true },
    };
    const icon = icons[name] || icons.send;
    const svgProps = {
      className, viewBox: "0 0 24 24",
      "aria-hidden": title ? "false" : "true",
      focusable: title ? "true" : "false",
      role: title ? "img" : undefined,
    };
    if (title) {
      svgProps["aria-labelledby"] = `icon-${name}-title`;
    }
    const children = [];
    if (title) {
      children.push(React.createElement("title", { id: `icon-${name}-title` }, title));
    }
    if (desc) {
      children.push(React.createElement("desc", null, desc));
    }
    children.push(React.createElement("path", { d: icon.d, fill: "currentColor" }));
    return React.createElement("svg", svgProps, ...children);
  };

  // ── Markdown renderer ──────────────────────────────────────────────
  function renderMarkdown(text) {
    if (!text) return "";
    let html = text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, l, c) => `<pre class="am-chat-code"><code>${c.trim()}</code></pre>`)
      .replace(/`([^`]+)`/g, '<code class="am-chat-inline-code">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
      .replace(/^### (.+)$/gm, '<h4 class="am-chat-h4">$1</h4>')
      .replace(/^## (.+)$/gm, '<h3 class="am-chat-h3">$1</h3>')
      .replace(/^# (.+)$/gm, '<h2 class="am-chat-h2">$1</h2>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/^- (.+)$/gm, '<li class="am-chat-li">$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li class="am-chat-li">$2</li>')
      .replace(/^---$/gm, '<hr class="am-chat-hr"/>')
      .replace(/\n/g, "<br/>")
      .replace(/(<li[^>]*>.*?<\/li>(<br\/>)?)+/g, (m) => `<ul class="am-chat-ul">${m.replace(/<br\/>/g, "")}</ul>`);
    return html;
  }

  function formatTime(ts) {
    try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  }

  // ── Thinking Indicator ─────────────────────────────────────────────
  function ThinkingIndicator({ text }) {
    return React.createElement("div", {
      className: "am-chat-thinking", role: "status", "aria-live": "polite",
      "aria-label": text || "Asistan düşünüyor",
    },
      React.createElement(Icon, { name: "brain", className: "h-4 w-4 am-chat-thinking-icon", title: "Düşünme" }),
      React.createElement("span", { className: "am-chat-thinking-text" }, text || "Düşünüyor…"),
    );
  }

  // ── Tool Call Indicator ─────────────────────────────────────────────
  function ToolCallIndicator({ name }) {
    return React.createElement("div", {
      className: "am-chat-tool-call", role: "status", "aria-live": "polite",
      "aria-label": name ? `Araç çalışıyor: ${name}` : "Araç çalışıyor",
    },
      React.createElement(Icon, { name: "tool", className: "h-3.5 w-3.5", title: "Araç" }),
      React.createElement("span", null, name ? `Araç: ${name}` : "Araç çalışıyor…"),
    );
  }

  // ── Message Component ──────────────────────────────────────────────
  function ChatMessage({ msg, isStreaming, showThinking, toolCallName, onCopy }) {
    const [copied, setCopied] = useState(false);
    const isUser = msg.role === "user";
    const isSystem = msg.role === "system";

    const handleCopy = useCallback(() => {
      const text = msg.content || "";
      navigator.clipboard?.writeText(text).then(() => {
        setCopied(true);
        onCopy?.();
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }, [msg.content, onCopy]);

    if (isSystem) {
      return React.createElement("div", { className: "am-chat-msg am-chat-system", role: "status" },
        React.createElement("div", { className: "am-chat-system-content",
          dangerouslySetInnerHTML: { __html: renderMarkdown(msg.content) } }));
    }

    const showThink = !isUser && isStreaming && showThinking && !msg.content;
    const showTool = !isUser && isStreaming && toolCallName && !showThink;
    const roleLabel = isUser ? "Kullanıcı" : "Asistan";
    const ariaLabel = `${roleLabel} mesajı`;

    return React.createElement("div", {
      className: `am-chat-msg ${isUser ? "am-chat-user" : "am-chat-assistant"}`,
      "data-role": isUser ? "user" : "assistant",
      role: "article",
      "aria-label": `${ariaLabel}${msg.timestamp ? ", " + formatTime(msg.timestamp) : ""}`,
    },
      React.createElement("div", {
        className: "am-chat-avatar", "aria-hidden": "true",
      },
        React.createElement(Icon, { name: isUser ? "user" : "bot", className: "h-5 w-5" })),
      React.createElement("div", { className: "am-chat-bubble-wrap" },
        React.createElement("div", {
          className: `am-chat-bubble ${isUser ? "am-chat-bubble-user" : "am-chat-bubble-assistant"}`,
        },
          showThink
            ? React.createElement(ThinkingIndicator, { text: msg.thinkingText })
            : showTool
              ? React.createElement(ToolCallIndicator, { name: toolCallName })
              : React.createElement("div", {
                  className: "am-chat-content",
                  dangerouslySetInnerHTML: { __html: renderMarkdown(msg.content) },
                }),
          isStreaming && !showThink && !showTool && !isUser && msg.content
            ? React.createElement("span", { className: "am-chat-cursor", "aria-hidden": "true" }, "▋")
            : null,
        ),
        // Meta row: role label + timestamp + copy button
        React.createElement("div", {
          className: "am-chat-msg-meta",
          style: { display: "flex", alignItems: "center", gap: "0.25rem" },
        },
          React.createElement("span", {
            className: `am-chat-role-label ${isUser ? "am-chat-role-label-user" : ""}`,
            "aria-hidden": "true",
          }, roleLabel),
          msg.timestamp && React.createElement("span", {
            className: "am-chat-time", "aria-hidden": "true",
          }, formatTime(msg.timestamp)),
          !isStreaming && msg.content && React.createElement("button", {
            className: `am-chat-action-btn ${copied ? "copied" : ""}`,
            onClick: handleCopy,
            "aria-label": copied ? "Kopyalandı" : "Mesajı kopyala",
            title: copied ? "Kopyalandı" : "Kopyala",
          }, React.createElement(Icon, {
            name: copied ? "check" : "copy",
            className: "h-3.5 w-3.5",
            title: copied ? "Kopyalandı" : "Mesajı kopyala",
          })),
        ),
      ),
    );
  }

  // ── Main Chat Component ─────────────────────────────────────────────
  function AccessiMindChat() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [connected, setConnected] = useState(false);
    const [streaming, setStreaming] = useState(false);
    const [thinking, setThinking] = useState(false);
    const [toolCallName, setToolCallName] = useState(null);
    const [error, setError] = useState(null);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [copyNotice, setCopyNotice] = useState(null);
    const wsRef = useRef(null);
    const msgIdRef = useRef(0);
    const reqIdRef = useRef(1);
    const currentAssistantRef = useRef(null);
    const assistantContentRef = useRef("");
    const assistantThinkingRef = useRef("");
    const reconnectTimerRef = useRef(null);
    const reconnectAttemptRef = useRef(0);
    const [reconnectNonce, setReconnectNonce] = useState(0);
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const inputRef = useRef(null);
    const skipLinkRef = useRef(null);

    const MAX_INPUT = 4000;

    // Auto-scroll
    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, thinking, toolCallName]);

    // Scroll detection
    useEffect(() => {
      const container = messagesContainerRef.current;
      if (!container) return;
      const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 80;
        setShowScrollBtn(!isNearBottom && scrollHeight > clientHeight + 100);
      };
      container.addEventListener("scroll", handleScroll, { passive: true });
      return () => container.removeEventListener("scroll", handleScroll);
    }, []);

    // Generate channel ID
    const channel = useMemo(() => {
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
      return `chat-${id}`;
    }, [reconnectNonce]);

    // Session management
    const sessionIdRef = useRef(null);

    // Connect to /api/ws JSON-RPC WebSocket
    useEffect(() => {
      let unmounting = false;
      async function connect() {
        try {
          if (!buildWsAuthParam) { setError("Plugin SDK yüklenemedi."); return; }
          const authParam = await buildWsAuthParam();
          if (unmounting) return;
          const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
          const basePath = window.__HERMES_BASE_PATH__ ?? "";
          const qs = new URLSearchParams({ [authParam[0]]: authParam[1], channel });
          const wsUrl = `${proto}//${window.location.host}${basePath}/api/ws?${qs.toString()}`;
          const ws = new WebSocket(wsUrl);
          wsRef.current = ws;

          ws.onopen = () => {
            setConnected(true); setError(null); reconnectAttemptRef.current = 0;
            ws.send(JSON.stringify({ jsonrpc: "2.0", id: ++reqIdRef.current, method: "session.create", params: { cols: 80 } }));
          };

          ws.onmessage = (ev) => {
            try {
              const frame = JSON.parse(ev.data);
              handleWsFrame(frame);
            } catch (e) { /* ignore parse errors */ }
          };

          ws.onclose = (ev) => {
            if (unmounting) return;
            setConnected(false); wsRef.current = null;
            if (ev.code === 4401) { setError("Oturum süresi doldu."); return; }
            if (ev.code === 4403) { setError("Erişim reddedildi."); return; }
            if (ev.code === 4404) { setError("Sohbet devre dışı."); return; }
            if (ev.code === 1000 || ev.code === 1001) {
              setStreaming(false); setThinking(false); setToolCallName(null); return;
            }
            const attempt = Math.min(reconnectAttemptRef.current + 1, 5);
            reconnectAttemptRef.current = attempt;
            const delay = Math.min(250 * Math.pow(2, attempt - 1), 3000);
            setError(`Bağlantı koptu. Yeniden bağlanıyor…`);
            reconnectTimerRef.current = setTimeout(() => setReconnectNonce((n) => n + 1), delay);
          };

          ws.onerror = () => { setError("WebSocket hatası."); };
        } catch (err) { setError("Bağlantı kurulamadı: " + (err?.message || String(err))); }
      }
      connect();
      return () => {
        unmounting = true;
        if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
        wsRef.current?.close(); wsRef.current = null;
      };
    }, [channel]);

    // Handle JSON-RPC frames
    function handleWsFrame(frame) {
      if (frame.method === "event" && frame.params) {
        const { type, payload } = frame.params;
        switch (type) {
          case "gateway.ready":
            break;

          case "message.start":
            setThinking(false);
            setToolCallName(null);
            assistantContentRef.current = "";
            assistantThinkingRef.current = "";
            break;

          case "message.delta":
            if (payload && payload.text) {
              assistantContentRef.current += payload.text;
              setThinking(false);
              updateAssistantMessage();
            }
            break;

          case "message.complete":
            if (payload && payload.text && !assistantContentRef.current) {
              assistantContentRef.current = payload.text;
              updateAssistantMessage();
            }
            setStreaming(false);
            setThinking(false);
            setToolCallName(null);
            currentAssistantRef.current = null;
            break;

          case "thinking.delta":
            if (payload && payload.text) {
              assistantThinkingRef.current += payload.text;
              setThinking(true);
              updateAssistantMessage(true);
            }
            break;

          case "reasoning.available":
            if (payload && payload.preview) {
              assistantThinkingRef.current = payload.preview;
              setThinking(true);
              updateAssistantMessage(true);
            }
            break;

          case "tool.start":
            setThinking(false);
            if (payload && payload.name) setToolCallName(payload.name);
            break;

          case "tool.complete":
            setToolCallName(null);
            break;

          case "tool.generating":
            if (payload && payload.name) setToolCallName(payload.name);
            break;

          case "status.update":
            if (payload && payload.text) {
              setThinking(true);
              assistantThinkingRef.current = payload.text;
              updateAssistantMessage(true);
            }
            break;

          case "error":
            if (payload && payload.message) {
              setError(payload.message);
              setStreaming(false); setThinking(false); setToolCallName(null);
              currentAssistantRef.current = null;
            }
            break;

          case "session.info":
            break;
        }
      }
      if (frame.id && frame.result !== undefined) {
        if (frame.result && frame.result.session_id) {
          sessionIdRef.current = frame.result.session_id;
        }
      }
      if (frame.id && frame.error) {
        if (frame.error.message) {
          setError(frame.error.message);
          setStreaming(false); setThinking(false); setToolCallName(null);
          currentAssistantRef.current = null;
        }
      }
    }

    function updateAssistantMessage(isThinking) {
      if (!currentAssistantRef.current) return;
      const content = assistantContentRef.current;
      const thinkText = isThinking ? assistantThinkingRef.current : "";
      setMessages((prev) => {
        const next = [...prev];
        const idx = next.findIndex((m) => m.id === currentAssistantRef.current);
        if (idx >= 0) {
          next[idx] = { ...next[idx], content: content, thinkingText: thinkText };
        }
        return next;
      });
    }

    // Focus input on connect
    useEffect(() => { if (connected) inputRef.current?.focus(); }, [connected]);

    // Copy notice auto-dismiss
    useEffect(() => {
      if (copyNotice) {
        const t = setTimeout(() => setCopyNotice(null), 2000);
        return () => clearTimeout(t);
      }
    }, [copyNotice]);

    // Send message via JSON-RPC prompt.submit
    const sendMessage = useCallback(() => {
      const text = input.trim();
      if (!text || !connected || streaming) return;

      const userMsg = { id: `u-${++msgIdRef.current}`, role: "user", content: text, timestamp: Date.now() };
      setMessages((prev) => [...prev, userMsg]);

      const assistantId = `a-${++msgIdRef.current}`;
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", timestamp: Date.now() }]);
      currentAssistantRef.current = assistantId;
      assistantContentRef.current = "";
      assistantThinkingRef.current = "";
      setStreaming(true);
      setThinking(true);
      setToolCallName(null);

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const params = { text: text };
        if (sessionIdRef.current) params.session_id = sessionIdRef.current;
        const req = { jsonrpc: "2.0", id: ++reqIdRef.current, method: "prompt.submit", params };
        ws.send(JSON.stringify(req));
      }

      setInput("");
    }, [input, connected, streaming]);

    const handleKeyDown = useCallback((e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    }, [sendMessage]);

    const clearChat = useCallback(() => {
      setMessages([]); setStreaming(false); setThinking(false); setToolCallName(null);
      currentAssistantRef.current = null;
      assistantContentRef.current = ""; assistantThinkingRef.current = "";
      setReconnectNonce((n) => n + 1);
    }, []);

    const stopGeneration = useCallback(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ jsonrpc: "2.0", id: ++reqIdRef.current, method: "prompt.cancel", params: {} }));
      }
      setStreaming(false); setThinking(false); setToolCallName(null);
      currentAssistantRef.current = null;
    }, []);

    const scrollToBottom = useCallback(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    const handleCopyNotice = useCallback(() => {
      setCopyNotice("Mesaj panoya kopyalandı");
    }, []);

    // Suggestion chips for empty state
    const suggestions = useMemo(() => [
      { icon: "zap", text: "Bugünkü AI haberleri" },
      { icon: "brain", text: "Bana bir şey açıkla" },
      { icon: "tool", text: "Kod yaz" },
      { icon: "sparkles", text: "Yaratıcı bir fikir ver" },
    ], []);

    const handleSuggestion = useCallback((text) => {
      setInput(text);
      inputRef.current?.focus();
    }, []);

    // Screen-reader status string
    const srStatus = error ? "Hata: " + error
      : thinking ? "Asistan düşünüyor"
      : toolCallName ? "Araç çalışıyor: " + toolCallName
      : streaming ? "Asistan yanıt veriyor"
      : connected ? `Bağlı, ${messages.length} mesaj, mesaj gönderebilirsiniz`
      : "Bağlanıyor";

    // Character counter state
    const charCount = input.length;
    const charWarn = charCount > MAX_INPUT * 0.8 && charCount <= MAX_INPUT;
    const charLimit = charCount > MAX_INPUT;

    return React.createElement("div", { className: "am-chat-container" },
      // Skip link
      React.createElement("a", {
        ref: skipLinkRef, href: "#am-chat-input",
        className: "am-chat-skip-link",
      }, "Sohbet girişine geç"),

      // SR-only live status
      React.createElement("div", {
        className: "am-chat-sr-status", role: "status", "aria-live": "assertive", "aria-atomic": true,
      }, srStatus),

      // SR-only copy notice
      copyNotice && React.createElement("div", {
        className: "am-chat-sr-status", role: "status", "aria-live": "polite",
      }, copyNotice),

      // Header
      React.createElement("div", { className: "am-chat-header", role: "banner" },
        React.createElement("div", { className: "am-chat-header-left" },
          React.createElement(Icon, { name: "sparkles", className: "h-5 w-5 am-chat-logo", title: "AccessiMind", desc: "AccessiMind logosu" }),
          React.createElement("span", { className: "am-chat-title" }, "AccessiMind"),
          React.createElement("span", {
            className: `am-chat-status ${connected ? "am-chat-online" : "am-chat-offline"}`,
            "aria-label": connected ? "Çevrimiçi" : "Çevrimdışı",
            role: "status",
          }, connected ? "Çevrimiçi" : "Çevrimdışı"),
        ),
        React.createElement("div", { className: "am-chat-header-right", role: "toolbar", "aria-label": "Sohbet araçları" },
          streaming && React.createElement("button", {
            className: "am-chat-btn am-chat-btn-stop", onClick: stopGeneration,
            "aria-label": "Yanıtı durdur",
          }, React.createElement(Icon, { name: "stop", className: "h-4 w-4", title: "Durdur" }),
            React.createElement("span", null, "Durdur")),
          React.createElement("button", {
            className: "am-chat-btn", onClick: clearChat,
            "aria-label": "Yeni sohbet başlat, mevcut mesajları temizle",
          }, React.createElement(Icon, { name: "refresh", className: "h-4 w-4", title: "Yeni sohbet" }),
            React.createElement("span", { className: "am-chat-sr-only" }, "Yeni sohbet")),
        ),
      ),

      // Error
      error && React.createElement("div", {
        className: "am-chat-error", role: "alert", "aria-live": "assertive",
      },
        React.createElement(Icon, { name: "alertCircle", className: "h-4 w-4 am-chat-error-icon", title: "Hata" }),
        React.createElement("span", null, error),
      ),

      // Messages
      React.createElement("div", {
        ref: messagesContainerRef,
        className: "am-chat-messages",
        role: "log",
        "aria-label": `Sohbet mesajları, ${messages.length} mesaj`,
        "aria-live": "off",
        "aria-relevant": "additions",
      },
        messages.length === 0 && !error && React.createElement("div", { className: "am-chat-empty", role: "status" },
          React.createElement(Icon, { name: "sparkles", className: "h-12 w-12 am-chat-empty-icon", "aria-hidden": "true" }),
          React.createElement("h3", null, "AccessiMind Sohbete Hazır"),
          React.createElement("p", null, "Bir mesaj yazın ve Enter'a basın. Shift+Enter ile yeni satır ekleyin."),
          React.createElement("div", { className: "am-chat-empty-hints", role: "list", "aria-label": "Hızlı başlangıç önerileri" },
            suggestions.map((s) =>
              React.createElement("button", {
                key: s.text,
                className: "am-chat-hint-chip",
                onClick: () => handleSuggestion(s.text),
                role: "listitem",
                "aria-label": `Öneri: ${s.text}`,
              },
                React.createElement(Icon, { name: s.icon, className: "h-3.5 w-3.5", "aria-hidden": "true" }),
                React.createElement("span", null, s.text),
              ),
            ),
          ),
        ),
        messages.map((msg) =>
          React.createElement(ChatMessage, {
            key: msg.id, msg,
            isStreaming: streaming && msg.id === currentAssistantRef.current,
            showThinking: thinking && msg.id === currentAssistantRef.current,
            toolCallName: toolCallName && msg.id === currentAssistantRef.current ? toolCallName : null,
            onCopy: handleCopyNotice,
          }),
        ),
        React.createElement("div", { ref: messagesEndRef, "aria-hidden": "true" }),
      ),

      // Scroll-to-bottom button
      showScrollBtn && React.createElement("button", {
        className: "am-chat-scroll-btn am-chat-scroll-btn-visible",
        onClick: scrollToBottom,
        "aria-label": "En son mesaja kay",
        title: "Aşağı kay",
      }, React.createElement(Icon, { name: "arrowDown", className: "h-5 w-5", title: "Aşağı kay" })),

      // Input
      React.createElement("div", { className: "am-chat-input-wrap" },
        React.createElement("textarea", {
          ref: inputRef, id: "am-chat-input", className: "am-chat-input",
          value: input, onChange: (e) => setInput(e.target.value),
          onKeyDown: handleKeyDown,
          placeholder: connected ? "Mesajınızı yazın…" : "Bağlanıyor…",
          disabled: !connected, rows: 1,
          maxLength: MAX_INPUT,
          "aria-label": "Sohbet mesajı yazın",
          "aria-describedby": "am-chat-hint am-chat-char-count",
        }),
        charCount > 0 && React.createElement("span", {
          id: "am-chat-char-count",
          className: `am-chat-char-counter ${charWarn ? "am-chat-char-warn" : ""} ${charLimit ? "am-chat-char-limit" : ""}`,
          "aria-live": "polite",
        }, `${charCount} / ${MAX_INPUT}`),
        React.createElement("button", {
          className: "am-chat-send", onClick: sendMessage,
          disabled: !connected || !input.trim() || streaming,
          "aria-label": "Mesajı gönder",
        }, React.createElement(Icon, { name: "send", className: "h-5 w-5", title: "Gönder" })),
      ),

      // Footer
      React.createElement("div", { className: "am-chat-footer", role: "contentinfo" },
        React.createElement("div", { className: "am-chat-footer-left" },
          React.createElement("span", { className: "am-chat-footer-count" },
            React.createElement(Icon, { name: "message", className: "h-3 w-3", "aria-hidden": "true" }),
            React.createElement("span", { "aria-label": `${messages.length} mesaj` }, `${messages.length} mesaj`),
          ),
          React.createElement("span", { id: "am-chat-hint" }, "AccessiMind · WCAG 2.2 AA"),
        ),
        React.createElement("div", { className: "am-chat-footer-shortcuts", "aria-label": "Klavye kısayolları" },
          React.createElement("span", null,
            React.createElement("kbd", { className: "am-chat-kbd" }, "Enter"), " gönder"),
          React.createElement("span", null,
            React.createElement("kbd", { className: "am-chat-kbd" }, "⇧+Enter"), " yeni satır"),
        ),
      ),
    );
  }

  if (window.__HERMES_PLUGINS__ && window.__HERMES_PLUGINS__.register) {
    window.__HERMES_PLUGINS__.register("accessimind-chat", AccessiMindChat);
  } else {
    console.error("[AccessiMind Chat] Plugin SDK not found.");
  }
})();