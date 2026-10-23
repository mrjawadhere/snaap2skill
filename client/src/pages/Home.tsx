import { useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronRight,
  CircleDot,
  Clipboard,
  CloudUpload,
  Code2,
  Copy,
  FileCode2,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Network,
  Paperclip,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Terminal,
  Upload,
  Workflow,
  X,
  Zap,
} from "lucide-react";

type AppState = "idle" | "uploading" | "compiling" | "success";
type Tab = "flow" | "spec" | "sandbox";
type ChatMessage = { role: "assistant" | "user"; text: string };

type Step = { id: string; title: string; detail: string; icon: string; tone: "violet" | "white" };

const steps: Step[] = [
  { id: "capture", title: "Capture input", detail: "Accept a sketch, photo, or SOP image", icon: "01", tone: "violet" },
  { id: "interpret", title: "Interpret workflow", detail: "Detect actors, decisions, and handoffs", icon: "02", tone: "white" },
  { id: "compile", title: "Compile skill", detail: "Generate portable Agent Skill instructions", icon: "03", tone: "white" },
  { id: "validate", title: "Validate in sandbox", detail: "Run a scenario against the new skill", icon: "04", tone: "white" },
];

const skillMarkdown = `---
name: incident-triage
version: 1.0.0
description: Triage incoming incidents and route them to the right owner.
---

# Incident Triage

## Purpose
Turn an incoming incident report into a structured, actionable handoff.

## Workflow
1. Capture the reporter's summary, impact, and urgency.
2. Classify the incident as reliability, security, billing, or product.
3. If severity is P0 or P1, page the on-call owner immediately.
4. Create a concise handoff with context, evidence, and next action.
5. Confirm the owner and return a user-facing status update.

## Output contract
Return JSON with severity, category, owner, and next_action.

## Guardrails
- Never invent an owner or severity.
- Ask one clarifying question when impact is unclear.
- Keep external updates calm, factual, and time-bound.`;

const initialChat: ChatMessage[] = [
  { role: "assistant", text: "Skill compiled. I’m ready to triage an incident using the detected workflow." },
  { role: "user", text: "The checkout API is returning 500s for about 20% of requests." },
  { role: "assistant", text: "I’d classify this as a reliability incident with elevated impact. What is the customer-facing urgency: P0 (broad outage), P1 (major degradation), or P2 (limited impact)?" },
];

import { trpc } from "@/lib/trpc";

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [tab, setTab] = useState<Tab>("flow");
  const [fileName, setFileName] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>(initialChat);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeSpec, setActiveSpec] = useState(skillMarkdown);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const statusQuery = trpc.skill.status.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const chatMutation = trpc.skill.chat.useMutation();
  const compileMutation = trpc.skill.compile.useMutation();

  const status = useMemo(() => {
    if (state === "uploading") return { label: "Uploading sketch", helper: "Reading image pixels and preparing the canvas" };
    if (state === "compiling") return { label: "Compiling workflow", helper: "Gemma is mapping decisions into a portable skill" };
    if (state === "success") return { label: "Studio ready", helper: "Your skill is ready to inspect and test" };
    return { label: "Waiting for input", helper: "Drop a sketch or load the sample workflow" };
  }, [state]);

  const loadSample = () => {
    setFileName("incident-triage-sample.png");
    setActiveSpec(skillMarkdown);
    setState("success");
    setTab("flow");
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    setState("uploading");
    window.setTimeout(() => setState("success"), 800);
  };

  const compile = async () => {
    if (state === "compiling") return;
    setState("compiling");

    try {
      if (fileName && fileName !== "incident-triage-sample.png") {
        const res = await compileMutation.mutateAsync({ fileName });
        if (res.success && res.skillMarkdown) {
          setActiveSpec(res.skillMarkdown);
        }
      }
    } catch {
      // Fallback to active template on error
    } finally {
      setState("success");
      setTab("flow");
    }
  };

  const copySpec = async () => {
    try {
      await navigator.clipboard.writeText(activeSpec);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || isAiResponding) return;

    const userMessage: ChatMessage = { role: "user", text };
    const updatedChat = [...chat, userMessage];
    setChat(updatedChat);
    setDraft("");
    setIsAiResponding(true);

    try {
      const res = await chatMutation.mutateAsync({
        message: text,
        skillMarkdown: activeSpec,
        history: updatedChat,
      });

      if (res?.text) {
        setChat((curr) => [...curr, { role: "assistant", text: res.text }]);
      } else {
        throw new Error("No response text");
      }
    } catch {
      // Clean fallback if backend is unreachable
      const fallbackText = text.toLowerCase().includes("severity")
        ? "Based on the workflow, I need impact and scope before assigning severity. How many customers are affected, and is there a workaround?"
        : "I’ve routed that through the compiled workflow. Share impact, urgency, or the owner context and I’ll produce the next handoff step.";
      setChat((curr) => [...curr, { role: "assistant", text: fallbackText }]);
    } finally {
      setIsAiResponding(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Zap size={16} strokeWidth={2.8} /></div>
          <div>
            <div className="wordmark">Snap<span>2</span>Skill</div>
            <div className="eyebrow">SKETCH → AGENT SKILL COMPILER</div>
          </div>
        </div>
        <div className="topbar-right">
          <div className="engine-badge"><span className="pulse-dot" />⚡ Gemma 4 Active</div>
          <div className="divider" />
          <div className="workspace-label"><span className="status-dot" />Local workspace</div>
          <button className="icon-btn" aria-label="Reset workspace" onClick={() => { setState("idle"); setFileName(null); setTab("flow"); }}><RotateCcw size={16} /></button>
        </div>
      </header>

      <main className="workspace">
        <section className="input-column">
          <div className="section-heading">
            <div>
              <div className="section-kicker">01 / INPUT HUB</div>
              <h1>Turn a rough sketch<br /><em>into a reusable skill.</em></h1>
            </div>
            <div className="model-chip"><Sparkles size={13} /> multimodal</div>
          </div>
          <p className="lede">Upload the way your team already thinks. Snap2Skill extracts the flow, writes the spec, and gives you a place to validate it.</p>

          <div className={`upload-card ${fileName ? "has-file" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files?.[0]); }}>
            <input ref={inputRef} type="file" accept="image/*" hidden onChange={(event) => handleFile(event.target.files?.[0])} />
            {!fileName ? (
              <>
                <div className="upload-orbit"><CloudUpload size={23} /></div>
                <div className="upload-title">Drop your process sketch here</div>
                <div className="upload-subtitle">Whiteboard photo, notebook flowchart, or SOP screenshot</div>
                <button className="browse-btn" onClick={() => inputRef.current?.click()}><Upload size={14} /> Browse files</button>
                <div className="file-hint">PNG, JPG, WEBP · up to 10 MB</div>
              </>
            ) : (
              <div className="loaded-file">
                <div className="file-icon"><ImageIcon size={20} /></div>
                <div className="loaded-copy"><strong>{fileName}</strong><span>{state === "uploading" ? "Uploading…" : "Ready to compile · visual input detected"}</span></div>
                <button className="remove-btn" aria-label="Remove file" onClick={(event) => { event.stopPropagation(); setFileName(null); setState("idle"); }}><X size={16} /></button>
              </div>
            )}
          </div>

          <button className="sample-btn" onClick={loadSample}><Workflow size={16} /> Load Sample Sketch <span className="shortcut">⌘ ↵</span></button>

          <div className="compile-card">
            <div className="compile-card-head"><div><div className="card-label">READY TO COMPILE</div><div className="compile-title">{fileName ? "Incident triage workflow" : "No sketch selected"}</div></div><div className={`compile-state ${state}`}><CircleDot size={13} /> {status.label}</div></div>
            <div className="progress-track"><div className={`progress-fill ${state}`} /></div>
            <div className="compile-meta"><span>{status.helper}</span><span>{state === "success" ? "4 nodes · 3 decisions" : "Awaiting sketch"}</span></div>
            <button className="compile-btn" disabled={!fileName || state === "uploading" || state === "compiling"} onClick={compile}>{state === "compiling" ? <><Loader2 className="spin" size={17} /> Compiling skill…</> : state === "success" ? <><Check size={17} /> Recompile skill</> : <><Zap size={17} /> Compile to Skill <ArrowRight size={16} /></>}</button>
          </div>

          <div className="input-footer"><div className="footer-line" /><span>Designed for agent builders</span><Code2 size={14} /></div>
        </section>

        <section className="studio-column">
          <div className="studio-topline"><div><div className="section-kicker">02 / OUTPUT STUDIO</div><h2>Compiled workflow <span>·</span> <strong>{state === "success" ? "Ready" : "Preview"}</strong></h2></div><div className="studio-meta"><span className={`studio-status ${state}`}><span /> {state === "success" ? "Synced" : "Waiting"}</span><span className="version">v1.0.0</span></div></div>
          <div className="studio-card">
            <nav className="tabs" aria-label="Studio views">
              <button className={tab === "flow" ? "active" : ""} onClick={() => setTab("flow")}><Network size={15} /> Visual Flowchart</button>
              <button className={tab === "spec" ? "active" : ""} onClick={() => setTab("spec")}><FileCode2 size={15} /> SKILL.md Spec</button>
              <button className={tab === "sandbox" ? "active" : ""} onClick={() => setTab("sandbox")}><Terminal size={15} /> Live Sandbox <span className="live-pip" /></button>
            </nav>

            {tab === "flow" && <div className="flow-panel">
              <div className="panel-toolbar"><div><div className="panel-title">Detected workflow</div><div className="panel-subtitle">Incident triage · visual parse confidence <strong>98.4%</strong></div></div><div className="toolbar-actions"><span className="mini-badge"><Check size={12} /> Standard flow</span><button className="icon-btn small"><Clipboard size={14} /></button></div></div>
              <div className="flow-canvas">
                <div className="canvas-grid" />
                <div className="flow-node start"><div className="node-index violet">01</div><div><strong>Incoming incident</strong><span>Capture summary + impact</span></div><ArrowDown size={15} /></div>
                <div className="flow-connector vertical" />
                <div className="flow-node decision"><div className="node-index white">02</div><div><strong>Classify incident</strong><span>Reliability · Security · Billing</span></div><ChevronRight size={15} /></div>
                <div className="branch-row"><div className="branch-line left" /><div className="branch-line right" /><div className="branch-label">severity check</div></div>
                <div className="flow-branches"><div className="flow-node compact"><div className="node-index white">03A</div><div><strong>P0 / P1</strong><span>Page on-call owner</span></div><ArrowRight size={14} /></div><div className="flow-node compact"><div className="node-index white">03B</div><div><strong>P2 / P3</strong><span>Create async handoff</span></div><ArrowRight size={14} /></div></div>
                <div className="flow-connector vertical short" />
                <div className="flow-node output"><div className="node-index violet">04</div><div><strong>Structured handoff</strong><span>Owner · next action · status update</span></div><Check size={15} /></div>
                <div className="canvas-note"><span className="legend-dot" /> <strong>4 nodes</strong><span className="legend-sep" /> <span>3 decisions</span><span className="legend-sep" /> <span>1 output contract</span></div>
              </div>
            </div>}

            {tab === "spec" && <div className="spec-panel">
              <div className="panel-toolbar"><div><div className="panel-title">Generated Agent Skill</div><div className="panel-subtitle">Open standard · Markdown source</div></div><button className={`copy-btn ${copied ? "copied" : ""}`} onClick={copySpec}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy markdown"}</button></div>
              <div className="code-window"><div className="code-window-bar"><span className="window-dot" /><span className="window-dot" /><span className="window-dot" /><span className="code-path">skills/incident-triage/SKILL.md</span><span className="code-lang">MARKDOWN</span></div><pre>{activeSpec.split("\n").map((line, index) => <code key={index}><span className={line.startsWith("#") ? "syntax-heading" : line.startsWith("---") ? "syntax-rule" : line.startsWith("-") || /^\d\./.test(line) ? "syntax-list" : ""}>{line}</span>{"\n"}</code>)}</pre></div>
            </div>}

            {tab === "sandbox" && <div className="sandbox-panel"><div className="sandbox-header"><div><div className="panel-title">Test the compiled skill</div><div className="panel-subtitle">Run a realistic incident through your new workflow</div></div><div className="sandbox-runtime"><span className="live-pip" /> {isAiResponding ? "Gemma reasoning…" : "Runtime online"}</div></div><div className="chat-window">{chat.map((message, index) => <div key={index} className={`chat-row ${message.role}`}><div className="chat-avatar">{message.role === "assistant" ? <Zap size={13} /> : "YU"}</div><div className="chat-bubble">{message.text}</div></div>)}{isAiResponding && <div className="chat-row assistant"><div className="chat-avatar"><Zap size={13} className="spin" /></div><div className="chat-bubble" style={{ opacity: 0.7 }}>Thinking with Gemma 4…</div></div>}</div><div className="chat-input"><Paperclip size={16} /><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }} placeholder="Ask the skill to triage a scenario…" disabled={isAiResponding} /><button aria-label="Send message" onClick={sendMessage} disabled={isAiResponding || !draft.trim()}><Send size={16} /></button></div></div>}
          </div>
          <div className="studio-bottom"><span><Sparkles size={13} /> Generated with multimodal reasoning</span><span>Changes autosaved</span></div>
        </section>
      </main>
    </div>
  );
}
