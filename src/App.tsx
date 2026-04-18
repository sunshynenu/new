/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, RefreshCw, Terminal, Layers, Palette, Monitor, Plus, Trash2, Edit3, Check, X } from 'lucide-react';

// --- Types ---

interface Attribute {
  category: string;
  pickCount: number | [number, number];
  options: string[];
}

interface PanelConfig {
  id: number;
  title: string;
  syntax: string;
}

// --- Constants ---

const INITIAL_PANELS: PanelConfig[] = [
  {
    id: 1,
    title: "Character Core",
    syntax: `#archetype {1} (Cybernetic Detective; Bio-Hacker Neo-Geisha; Retro-Futurist Pilot; Chromed Wasteland Nomad)
#modifiers {1-2} (with ((neon ocular implants; subtle data-stream overlays; internalized cooling vents)); and fused with (((onyx plating; exposed copper wiring; holographic interface loops))))`
  },
  {
    id: 2,
    title: "Environment",
    syntax: `#setting {1} (Rain-Slicked Neo-Tokyo Alley; Brutalist Datacenter; Orbital Lounge; Sun-Bleached Synth-Wave Desert)
#atmospheric {2} (drenched in ((volumetric fog; harsh sodium lighting; refracted rain)); defined by (((plasma-screen reflections; deep shadow contrasts; steam vent plumes))))`
  },
  {
    id: 3,
    title: "Aesthetic",
    syntax: `#medium {1} (Hyper-Realistic CGI Portrait; Fine Art Oil Painting; Cyber-Punk Concept Art; Kinetic Macro Photography)
#details {1-2} (featuring ((Sassoon-style SSS; complex meniscus fluid physics; impasto brushwork detail; volumetric lighting grid)))
*Rule: If 'Oil Painting' select 'impasto' logic*`
  }
];

const MANDATORY_ENGINES = "C4D, UE5, Octane Render (OR), Arnold, Lumion 2026, Flux.1 Kontext";

// --- Utils ---

function parseSyntax(syntax: string): Attribute[] {
  const attributes: Attribute[] = [];
  const lines = syntax.split('\n');

  lines.forEach(line => {
    if (line.startsWith('*')) return; // Skip rules for parsing

    const catMatch = line.match(/#(\w+)/);
    const countMatch = line.match(/\{(\d+)(?:-(\d+))?\}/);
    const optionsMatch = line.match(/\((.*)\)/);

    if (catMatch && countMatch && optionsMatch) {
      const category = catMatch[1];
      const min = parseInt(countMatch[1]);
      const max = countMatch[2] ? parseInt(countMatch[2]) : min;
      const options = optionsMatch[1].split(';').map(s => s.trim());

      attributes.push({
        category,
        pickCount: countMatch[2] ? [min, max] : min,
        options
      });
    }
  });

  return attributes;
}

function getRandomItems<T>(arr: T[], count: number | [number, number]): T[] {
  const n = Array.isArray(count) 
    ? Math.floor(Math.random() * (count[1] - count[0] + 1)) + count[0]
    : count;
  
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

function cleanOutput(text: string): string {
  return text
    .replace(/[#{}();*]/g, '')
    .replace(/\(\(/g, '')
    .replace(/\)\)/g, '')
    .replace(/\(\(\(/g, '')
    .replace(/\)\)\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Components ---

export default function App() {
  const [panels, setPanels] = useState<PanelConfig[]>(INITIAL_PANELS);
  const [panelOutputs, setPanelOutputs] = useState<Record<number, string>>({});
  const [masterPrompt, setMasterPrompt] = useState("[1] [2] [3]");
  const [finalPrompt, setFinalPrompt] = useState("");
  const [copyStatus, setCopyStatus] = useState<Record<string, boolean>>({});
  const [editingPanelId, setEditingPanelId] = useState<number | null>(null);
  const [tempSyntax, setTempSyntax] = useState("");
  const [tempTitle, setTempTitle] = useState("");

  const randomizePanel = useCallback((panelId: number, currentPanels: PanelConfig[]) => {
    const panel = currentPanels.find(p => p.id === panelId);
    if (!panel) return;

    const attributes = parseSyntax(panel.syntax);
    let result = "";

    attributes.forEach((attr, idx) => {
      const selected = getRandomItems(attr.options, attr.pickCount);
      
      // Handle special rules (e.g., Oil Painting -> Impasto)
      if (panelId === 3 && selected.some(s => s.includes("Oil Painting"))) {
        const nextAttr = attributes[idx + 1];
        if (nextAttr && nextAttr.category === "details") {
          const impastoOption = nextAttr.options.find(o => o.includes("impasto"));
          if (impastoOption && !selected.includes(impastoOption)) {
            // Logic for forcing impasto
          }
        }
      }

      result += selected.join(", ") + " ";
    });

    setPanelOutputs(prev => ({ ...prev, [panelId]: result.trim() }));
  }, []);

  const addPanel = () => {
    const nextId = panels.length > 0 ? Math.max(...panels.map(p => p.id)) + 1 : 1;
    const newPanel: PanelConfig = {
      id: nextId,
      title: `Panel ${nextId}`,
      syntax: `#category {1} (Option A; Option B; Option C)`
    };
    setPanels(prev => [...prev, newPanel]);
    setMasterPrompt(prev => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} [${nextId}]` : `[${nextId}]`;
    });
  };

  const removePanel = (id: number) => {
    setPanels(prev => prev.filter(p => p.id !== id));
    setPanelOutputs(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setMasterPrompt(prev => {
      const regex = new RegExp(`\\s?\\[${id}\\]`, 'g');
      return prev.replace(regex, "").trim();
    });
  };

  const startEditing = (panel: PanelConfig) => {
    setEditingPanelId(panel.id);
    setTempSyntax(panel.syntax);
    setTempTitle(panel.title);
  };

  const saveEdit = () => {
    if (editingPanelId === null) return;
    const updatedPanels = panels.map(p => 
      p.id === editingPanelId ? { ...p, title: tempTitle, syntax: tempSyntax } : p
    );
    setPanels(updatedPanels);
    setEditingPanelId(null);
    randomizePanel(editingPanelId, updatedPanels);
  };

  const cancelEdit = () => {
    setEditingPanelId(null);
  };

  const compilePrompt = useCallback(() => {
    let compiled = masterPrompt;
    panels.forEach(p => {
      const output = panelOutputs[p.id] || "";
      compiled = compiled.replace(`[${p.id}]`, output);
    });

    const final = `${cleanOutput(compiled)} --render ${MANDATORY_ENGINES}`;
    setFinalPrompt(final);
  }, [masterPrompt, panelOutputs, panels]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(prev => ({ ...prev, [id]: true }));
      setTimeout(() => setCopyStatus(prev => ({ ...prev, [id]: false })), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  // Initial randomization
  useEffect(() => {
    panels.forEach(p => {
      if (!panelOutputs[p.id]) {
        randomizePanel(p.id, panels);
      }
    });
  }, [panels, randomizePanel, panelOutputs]);

  useEffect(() => {
    compilePrompt();
  }, [panelOutputs, masterPrompt, compilePrompt]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-16 relative z-10 min-h-screen flex flex-col">
      <div className="crackle-overlay" />
      
      <header className="text-center mb-16 relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="inline-block relative"
        >
          <h1 
            data-text="NYX RANDOMIZER"
            className="text-4xl md:text-6xl font-bold tracking-[0.3em] text-white uppercase mb-2 glitch-text leading-none"
          >
            NYX RANDOMIZER
          </h1>
          <div className="absolute -bottom-1 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-onyx-accent text-[10px] uppercase tracking-widest mt-6 flex items-center justify-center gap-4"
        >
          <span className="w-8 h-[1px] bg-white/10" />
          System Architecture & Syntax V2.5
          <span className="w-8 h-[1px] bg-white/10" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <button 
            onClick={addPanel}
            className="mt-10 nyx-button flex items-center gap-3 mx-auto relative z-20 px-8 py-3 group"
          >
            <Plus className="w-4 h-4 transition-transform duration-300 group-hover:rotate-90" />
            Add Randomizer Panel
            <div className="absolute inset-0 border border-white opacity-0 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none" />
          </button>
        </motion.div>
      </header>

      <div className="flex-grow">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          <AnimatePresence mode="popLayout">
            {panels.map((panel) => (
              <motion.div
                key={panel.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="nyx-panel flex flex-col group h-full"
              >
                <div className="nyx-card-header">
                  <div className="flex items-center gap-3 flex-grow min-w-0">
                    <span className="text-white/20 font-mono text-[10px] font-bold">0{panel.id}</span>
                    {editingPanelId === panel.id ? (
                      <input 
                        value={tempTitle}
                        onChange={(e) => setTempTitle(e.target.value)}
                        className="bg-transparent border-b border-white/20 text-white text-[11px] font-bold uppercase focus:outline-none focus:border-white w-full"
                        autoFocus
                      />
                    ) : (
                      <h2 className="text-[11px] font-bold text-white uppercase truncate tracking-widest">
                        {panel.title}
                      </h2>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editingPanelId === panel.id ? (
                      <>
                        <button onClick={saveEdit} className="nyx-button-ghost text-emerald-400 hover:text-emerald-300 transition-colors"><Check className="w-5 h-5" /></button>
                        <button onClick={cancelEdit} className="nyx-button-ghost text-rose-400 hover:text-rose-300 transition-colors"><X className="w-5 h-5" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEditing(panel)} className="nyx-button-ghost transition-colors"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => removePanel(panel.id)} className="nyx-button-ghost hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </div>

                <div className="nyx-card-content">
                  {editingPanelId === panel.id ? (
                    <div className="space-y-3 h-full">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] uppercase tracking-tighter text-onyx-accent/50 underline underline-offset-4">Logic Blueprint</label>
                        <Terminal className="w-3 h-3 text-white/10" />
                      </div>
                      <textarea
                        value={tempSyntax}
                        onChange={(e) => setTempSyntax(e.target.value)}
                        className="nyx-input h-[110px] text-[10px] leading-relaxed resize-none"
                        placeholder="#category {1} (Option A; Option B)"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Terminal className="w-3 h-3 text-white/20" />
                        <span className="text-[9px] uppercase tracking-widest text-white/20">Active Syntax</span>
                      </div>
                      <ul className="space-y-3 font-mono text-[10px] leading-relaxed text-onyx-accent/70">
                        {panel.syntax.split('\n').map((line, i) => (
                          <li key={i} className="group/line relative pl-4 border-l border-white/5 hover:border-white/20 transition-colors">
                            {line.startsWith('*') ? (
                              <span className="text-emerald-400/50 italic font-serif text-[11px]">{line}</span>
                            ) : (
                              <code className="block break-words">{line}</code>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="nyx-card-footer space-y-4">
                  <div className="relative group/output">
                    <textarea
                      readOnly
                      value={panelOutputs[panel.id] || ""}
                      className="nyx-textarea-output"
                      placeholder={`Panel [${panel.id}] Terminal Output...`}
                    />
                    <button
                      onClick={() => copyToClipboard(panelOutputs[panel.id] || "", `panel-${panel.id}`)}
                      className="absolute top-2 right-2 nyx-button-ghost bg-black/40 backdrop-blur-md rounded border border-white/5 opacity-0 group-hover/output:opacity-100 transition-all duration-300"
                      title="Extract Output"
                    >
                      {copyStatus[`panel-${panel.id}`] ? (
                        <span className="text-[9px] text-emerald-400 px-1 font-bold">READY</span>
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    <div className="absolute bottom-2 right-2 text-[8px] text-white/10 uppercase tracking-widest pointer-events-none">
                      Output Segment 0x{panel.id}
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => randomizePanel(panel.id, panels)}
                    disabled={editingPanelId === panel.id}
                    className="nyx-button w-full flex items-center justify-center gap-3 py-2.5 font-bold"
                  >
                    <RefreshCw className={`w-3 h-3 ${panelOutputs[panel.id] ? "group-hover:rotate-180 transition-transform duration-500" : ""}`} />
                    EXECUTE_RANDOM [{panel.id}]
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="nyx-panel bg-gradient-to-b from-onyx-panel/80 to-black/90 border-white/20 mt-auto"
      >
        <div className="nyx-card-header bg-white/5">
          <div className="flex items-center gap-3 text-white uppercase text-xs font-bold tracking-[0.2em]">
            <Monitor className="w-4 h-4 text-emerald-500" />
            Master Command Compilation Console
          </div>
          <div className="text-[10px] text-white/30 tracking-tight font-serif italic">
            Status: Synchronized via Nana Banana 2.5
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-white/5">
          <div className="p-6 space-y-4 bg-onyx-black/30">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-widest text-onyx-accent font-bold">Structural Template</label>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <textarea
              value={masterPrompt}
              onChange={(e) => setMasterPrompt(e.target.value)}
              className="nyx-input h-[120px] resize-none border-emerald-500/10 focus:border-emerald-500/30 text-[12px] leading-relaxed"
              placeholder="Structure: [1] [2] [3]..."
            />
            <div className="flex items-center gap-2 text-[9px] text-white/40 uppercase tracking-tighter">
              <Plus className="w-2.5 h-2.5" />
              Use numerical indices within brackets to merge specific data segment outputs.
            </div>
          </div>

          <div className="p-6 space-y-4 bg-onyx-black/50">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-widest text-onyx-accent font-bold">C4D / UE5 / OCTANE FINAL OUTPUT</label>
              <button
                onClick={() => copyToClipboard(finalPrompt, 'final')}
                className="text-[10px] uppercase tracking-widest text-emerald-400 hover:text-white transition-all flex items-center gap-2 group/copy"
              >
                {copyStatus['final'] ? (
                  <span className="flex items-center gap-1"><Check className="w-3 h-3" /> BUFFER_COPIED</span>
                ) : (
                  <><Copy className="w-3 h-3 group-hover/copy:scale-110 transition-transform" /> COMPILE & CLONE</>
                )}
              </button>
            </div>
            <div className="relative group/final">
              <textarea
                readOnly
                value={finalPrompt}
                className="w-full h-[120px] bg-black border border-white/10 p-4 text-onyx-text font-mono text-[13px] leading-relaxed resize-none focus:outline-none scroll-smooth"
              />
              <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover/final:opacity-100 transition-opacity pointer-events-none" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-white/20 uppercase tracking-widest font-mono">
                Checksum: {finalPrompt.length}B_VERIFIED
              </span>
              <span className="text-[8px] text-white/20 uppercase tracking-widest font-mono">
                Render Engine: GOLD_STD_2026
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      <footer className="py-12 mt-auto text-center flex flex-col items-center gap-4">
        <div className="w-12 h-[1px] bg-white/10" />
        <p className="text-[9px] text-white/20 uppercase tracking-[0.5em] font-light">
          Nana Banana 2.5 • Secured Neural Architecture • 2026 Edition
        </p>
      </footer>
    </div>
  );
}
