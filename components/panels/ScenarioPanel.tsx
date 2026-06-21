"use client";

import { useEffect, useState } from "react";
import { usePlanningStore } from "@/store/usePlanningStore";
import { Panel, Button } from "@/components/ui/Controls";
import {
  listScenarios,
  deleteScenario,
  duplicateScenario,
  renameScenario,
} from "@/lib/storage/scenarioStorage";
import type { PlanningScenario } from "@/lib/types";
import { Save, FolderOpen, Copy, Trash2, Pencil, FilePlus2, Database } from "lucide-react";

export function ScenarioPanel() {
  const [scenarios, setScenarios] = useState<PlanningScenario[]>([]);
  const saveCurrent = usePlanningStore((s) => s.saveCurrent);
  const loadScenario = usePlanningStore((s) => s.loadScenario);
  const newScenario = usePlanningStore((s) => s.newScenario);
  const pushToast = usePlanningStore((s) => s.pushToast);
  const scenarioId = usePlanningStore((s) => s.scenarioId);
  const features = usePlanningStore((s) => s.features);

  const refresh = () => setScenarios(listScenarios());
  useEffect(() => {
    refresh();
  }, [scenarioId, features]);

  return (
    <Panel title="Scenarios" icon={<Database className="h-3.5 w-3.5" />}>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="primary"
          onClick={() => {
            saveCurrent();
            refresh();
          }}
        >
          <Save className="h-4 w-4" /> Save
        </Button>
        <Button onClick={() => newScenario()}>
          <FilePlus2 className="h-4 w-4" /> New
        </Button>
      </div>

      <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
        {scenarios.length === 0 && (
          <p className="text-[11px] text-slate-500">
            No saved scenarios yet. Save the current plan to store it in this
            browser.
          </p>
        )}
        {scenarios.map((s) => (
          <div
            key={s.id}
            className="rounded-md border border-white/10 bg-slate-800/50 px-2 py-1.5"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs text-slate-200 truncate" title={s.name}>
                {s.name}
              </span>
              <span className="text-[10px] text-slate-500">
                {new Date(s.updatedAt).toLocaleDateString()}
              </span>
            </div>
            <div className="mt-1 flex gap-1">
              <IconBtn title="Load" onClick={() => { loadScenario(s); pushToast("Scenario loaded.", "success"); }}>
                <FolderOpen className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn
                title="Rename"
                onClick={() => {
                  const name = window.prompt("New name", s.name);
                  if (name) {
                    renameScenario(s.id, name);
                    refresh();
                  }
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn
                title="Duplicate"
                onClick={() => {
                  duplicateScenario(s.id);
                  refresh();
                  pushToast("Scenario duplicated.", "info");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn
                title="Delete"
                danger
                onClick={() => {
                  deleteScenario(s.id);
                  refresh();
                  pushToast("Scenario deleted.", "info");
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </IconBtn>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex-1 flex items-center justify-center rounded py-1 border border-white/10 transition-colors ${
        danger
          ? "text-red-300 hover:bg-red-500/20"
          : "text-slate-300 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
