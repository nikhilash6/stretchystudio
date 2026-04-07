import React from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import CanvasViewport from '@/components/canvas/CanvasViewport';
import { LayerPanel } from '@/components/layers/LayerPanel';

export default function EditorLayout() {
  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground overflow-hidden">
      {/* Top bar */}
      <header className="h-10 border-b flex items-center px-4 shrink-0 bg-card gap-3">
        <span className="font-semibold text-sm select-none tracking-tight">Stretchy Studio</span>
        <span className="text-xs text-muted-foreground border border-border/50 px-1.5 py-0.5 font-mono">v0.1</span>
        <span className="flex-1" />
        <span className="text-xs text-muted-foreground hidden sm:block">Drop a PNG onto the canvas to start</span>
      </header>

      {/* Workspace */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Layers */}
          <ResizablePanel defaultSize={18} minSize={12} maxSize={28}>
            <div className="flex h-full flex-col border-r">
              <div className="px-3 py-2 border-b shrink-0">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Layers</h2>
              </div>
              <div className="flex-1 overflow-hidden">
                <LayerPanel />
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle />

          {/* Center: Canvas + Timeline */}
          <ResizablePanel defaultSize={62}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={85}>
                <CanvasViewport />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={15} minSize={8} collapsible>
                <div className="flex h-full flex-col border-t">
                  <div className="px-3 py-2 border-b shrink-0">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timeline</h2>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">Add parameters to unlock the timeline (M5)</p>
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle />

          {/* Inspector */}
          <ResizablePanel defaultSize={20} minSize={14} maxSize={30}>
            <div className="flex h-full flex-col border-l">
              <div className="px-3 py-2 border-b shrink-0">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inspector</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <p className="text-xs text-muted-foreground">Select a layer to inspect it.</p>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
