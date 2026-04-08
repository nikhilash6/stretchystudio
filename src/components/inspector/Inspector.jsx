/**
 * Inspector panel — shown in the right sidebar.
 *
 * Sections:
 *  1. Overlay toggles (always visible): showImage, showWireframe, showVertices, showEdgeOutline
 *  2. Tool mode buttons: select / add_vertex / remove_vertex
 *  3. Selected-part details: name, opacity, visibility
 *  4. Mesh settings: sliders + Remesh button
 */
import React, { useCallback, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/* ── Small helpers ────────────────────────────────────────────────────────── */

function SectionTitle({ children }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
      {children}
    </p>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <Label className="text-xs text-muted-foreground shrink-0">{label}</Label>
      <div className="flex-1 flex items-center justify-end gap-2">{children}</div>
    </div>
  );
}

function HelpIcon({ tip }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1"
            className="text-muted-foreground/40 hover:text-muted-foreground/60 cursor-help flex-shrink-0">
            <circle cx="6" cy="6" r="5.5"/>
            <text x="6" y="8" fontSize="8" textAnchor="middle" fill="currentColor" fontWeight="bold">?</text>
          </svg>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs text-xs">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SliderRow({ label, value, min, max, step = 1, onChange, help }) {
  return (
    <div className="space-y-1 py-0.5">
      <div className="flex justify-between items-center gap-1">
        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          {help && <HelpIcon tip={help} />}
        </div>
        <span className="text-xs tabular-nums text-foreground">{value}</span>
      </div>
      <Slider
        min={min} max={max} step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
    </div>
  );
}

/* ── Overlay toggles ──────────────────────────────────────────────────────── */

function OverlayToggles() {
  const overlays    = useEditorStore(s => s.overlays);
  const setOverlays = useEditorStore(s => s.setOverlays);

  const toggle = (key) => setOverlays({ [key]: !overlays[key] });

  return (
    <div className="space-y-1">
      <SectionTitle>Overlays</SectionTitle>
      {[
        ['showImage',       'Image'],
        ['showWireframe',   'Wireframe'],
        ['showVertices',    'Vertices'],
        ['showEdgeOutline', 'Edge Outline'],
      ].map(([key, label]) => (
        <Row key={key} label={label}>
          <Switch
            checked={overlays[key] ?? true}
            onCheckedChange={() => toggle(key)}
            className="scale-75 origin-right"
          />
        </Row>
      ))}
    </div>
  );
}

/* ── Tool mode ────────────────────────────────────────────────────────────── */

function ToolModeButtons() {
  const toolMode    = useEditorStore(s => s.toolMode);
  const setToolMode = useEditorStore(s => s.setToolMode);

  const tools = [
    { mode: 'select',        label: 'Select' },
    { mode: 'add_vertex',    label: '+ Vertex' },
    { mode: 'remove_vertex', label: '− Vertex' },
  ];

  return (
    <div className="space-y-1">
      <SectionTitle>Tool</SectionTitle>
      <div className="flex gap-1">
        {tools.map(({ mode, label }) => (
          <Button
            key={mode}
            size="sm"
            variant={toolMode === mode ? 'default' : 'outline'}
            className="flex-1 text-xs h-7 px-1"
            onClick={() => setToolMode(mode)}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/* ── Part details ─────────────────────────────────────────────────────────── */

function PartDetails({ node }) {
  const updateProject = useProjectStore(s => s.updateProject);

  const setOpacity = useCallback((v) => {
    updateProject((proj) => {
      const n = proj.nodes.find(x => x.id === node.id);
      if (n) n.opacity = v;
    });
  }, [node.id, updateProject]);

  const setVisible = useCallback((checked) => {
    updateProject((proj) => {
      const n = proj.nodes.find(x => x.id === node.id);
      if (n) n.visible = checked;
    });
  }, [node.id, updateProject]);

  return (
    <div className="space-y-1">
      <SectionTitle>Part</SectionTitle>
      <Row label="Name">
        <span className="text-xs font-mono truncate max-w-[100px] text-right" title={node.name}>
          {node.name || node.id}
        </span>
      </Row>
      <Row label="Visible">
        <Switch
          checked={node.visible !== false}
          onCheckedChange={setVisible}
          className="scale-75 origin-right"
        />
      </Row>
      <SliderRow
        label="Opacity"
        value={Math.round((node.opacity ?? 1) * 100)}
        min={0} max={100}
        onChange={(v) => setOpacity(v / 100)}
      />
      <Row label="Vertices">
        <span className="text-xs tabular-nums">{node.mesh?.vertices?.length ?? '—'}</span>
      </Row>
      <Row label="Triangles">
        <span className="text-xs tabular-nums">{node.mesh?.triangles?.length ?? '—'}</span>
      </Row>
    </div>
  );
}

/* ── Mesh settings ────────────────────────────────────────────────────────── */

function MeshPanel({ node, onRemesh }) {
  const meshDefaults    = useEditorStore(s => s.meshDefaults);
  const setMeshDefaults = useEditorStore(s => s.setMeshDefaults);
  const updateProject   = useProjectStore(s => s.updateProject);

  // Effective opts: per-part override or global defaults
  const opts = node.meshOpts ?? meshDefaults;

  const setOpt = useCallback((key, value) => {
    if (node.meshOpts) {
      // Update per-part override
      updateProject((proj) => {
        const n = proj.nodes.find(x => x.id === node.id);
        if (n?.meshOpts) n.meshOpts[key] = value;
      });
    } else {
      // Update global defaults
      setMeshDefaults({ [key]: value });
    }
  }, [node.id, node.meshOpts, updateProject, setMeshDefaults]);

  const enablePerPart = useCallback(() => {
    updateProject((proj) => {
      const n = proj.nodes.find(x => x.id === node.id);
      if (n) n.meshOpts = { ...meshDefaults };
    });
  }, [node.id, meshDefaults, updateProject]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <SectionTitle>Mesh Generation</SectionTitle>
        {!node.meshOpts && (
          <button
            onClick={enablePerPart}
            className="text-[10px] text-primary underline-offset-2 hover:underline"
          >
            override
          </button>
        )}
      </div>

      <SliderRow
        label="Alpha Threshold"
        value={opts.alphaThreshold}
        min={1} max={254}
        onChange={(v) => setOpt('alphaThreshold', v)}
        help="Pixel opacity threshold (0–255). Higher = stricter boundary detection."
      />
      <SliderRow
        label="Smooth Passes"
        value={opts.smoothPasses}
        min={0} max={10}
        onChange={(v) => setOpt('smoothPasses', v)}
        help="Laplacian smoothing iterations on the contour. Smooths jagged edges."
      />
      <SliderRow
        label="Grid Spacing"
        value={opts.gridSpacing}
        min={6} max={100}
        onChange={(v) => setOpt('gridSpacing', v)}
        help="Distance between interior sample points. Lower = more vertices, higher detail."
      />
      <SliderRow
        label="Edge Padding"
        value={opts.edgePadding}
        min={0} max={40}
        onChange={(v) => setOpt('edgePadding', v)}
        help="Minimum distance interior points must be from the boundary. Prevents clustering."
      />
      <SliderRow
        label="Edge Points"
        value={opts.numEdgePoints}
        min={8} max={300}
        onChange={(v) => setOpt('numEdgePoints', v)}
        help="Number of points sampled along the contour. More = smoother outline."
      />

      <Button
        size="sm"
        className="w-full h-7 text-xs mt-1"
        onClick={() => onRemesh(node.id, opts)}
      >
        Remesh
      </Button>
    </div>
  );
}

/* ── Root Inspector ───────────────────────────────────────────────────────── */

export function Inspector({ onRemesh }) {
  const selection  = useEditorStore(s => s.selection);
  const nodes      = useProjectStore(s => s.project.nodes);

  const selectedNode = nodes.find(n => n.id === selection[0]) ?? null;

  return (
    <div className="flex flex-col gap-4 p-3 h-full overflow-y-auto">
      <OverlayToggles />
      <Separator />
      <ToolModeButtons />

      {selectedNode ? (
        <>
          <Separator />
          <PartDetails node={selectedNode} />
          <Separator />
          <MeshPanel node={selectedNode} onRemesh={onRemesh} />
        </>
      ) : (
        <p className="text-xs text-muted-foreground text-center mt-4">
          Select a layer to inspect it.
        </p>
      )}
    </div>
  );
}
