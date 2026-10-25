import ShopPanel from './shop/ShopPanel';
import { shopBalance } from './shop/inventory';
import { useRef, useState } from "react";
import TitleScreen from "./components/TitleScreen";
import Hud from "./components/Hud";
import SelfCarePanel from "./components/SelfCarePanel";
import PaintPalette from "./components/PaintPalette";
import JournalBook from "./components/JournalBook";
import RelicsPanel from "./components/RelicsPanel";
import SettingsPanel from "./components/SettingsPanel";
import SpiritBubble from "./components/SpiritBubble";
import DemoControls from "./components/DemoControls";
import GrowBoost from "./components/GrowBoost";
import TreeCanvas, { type TreeCanvasHandle } from "./world/TreeCanvas";
import { useGame } from "./state/GameProvider";
import type { CanvasSelection, LeafColor } from "./types";
import "./App.css";

type Screen = "title" | "tree";
export type PanelId = "selfCare" | "journal" | "relics" | "settings" | "shop";

/** One paint action, remembered so Undo can put the previous colour back. */
type PaintStep = { segmentId: string; previous: LeafColor | null };

const DEMO_MODE = new URLSearchParams(window.location.search).has("demo");

export default function App() {
  const game = useGame();
  const { state } = game;
  const canvas = useRef<TreeCanvasHandle>(null);

  const [screen, setScreen] = useState<Screen>("title");
  const [openPanel, setOpenPanel] = useState<PanelId | null>(null);
  const [paintMode, setPaintMode] = useState(false);
  const [paintColor, setPaintColor] = useState<LeafColor>("base");
  const [paintHistory, setPaintHistory] = useState<PaintStep[]>([]);

  const [placingItem, setPlacingItem] = useState<string | null>(null);
  const purchases = state.shopPurchases ?? [];
  const balance = shopBalance(game.totalLP, purchases);

  const closePanel = () => setOpenPanel(null);

  function handleCanvasSelect(selection: CanvasSelection) {
    if (placingItem && selection.kind === "segment") {
      game.dispatch({ type: "placeItem", purchaseId: placingItem, segmentId: selection.id });
      setPlacingItem(null);
      return;
    }
    if (paintMode && selection.kind === "segment") {
      const previous = state.leafPaint[selection.id] ?? null;
      setPaintHistory((steps) => [...steps, { segmentId: selection.id, previous }]);
      game.paintLeaves(selection.id, paintColor);
      return;
    }
    if (selection.kind === "relic" || selection.kind === "tablet") {
      setOpenPanel("relics");
    }
  }

  function undoPaint() {
    const last = paintHistory.at(-1);
    if (!last) return;
    game.paintLeaves(last.segmentId, last.previous);
    setPaintHistory((steps) => steps.slice(0, -1));
  }

  function togglePaint() {
    setPlacingItem(null);
    setPaintMode((on) => !on);
    setPaintHistory([]);
    closePanel();
  }

  if (screen === "title") {
    return (
      <TitleScreen
        hasSave={state.selfCareLogs.length > 0}
        onStart={() => setScreen("tree")}
      />
    );
  }

  return (
    <div className="app">
      <TreeCanvas
        ref={canvas}
        onSelect={handleCanvasSelect}
        segments={game.segments}
        revealedRelics={game.revealedRelics.map((relic) => relic.id)}
        inscriptionCount={game.inscriptions.length}
        lp={game.totalLP}
        purchases={purchases}
        paintMode={paintMode || placingItem !== null}
        reducedMotion={state.settings.reducedMotion}
        spiritEnabled={state.spirit.enabled}
      />

      <Hud
        totalLP={balance}
        paintMode={paintMode}
        onOpenPanel={(panel) => {
          setPlacingItem(null);
          setPaintMode(false);
          setOpenPanel(panel);
        }}
        onTogglePaint={togglePaint}
        onZoomIn={() => canvas.current?.zoomIn()}
        onZoomOut={() => canvas.current?.zoomOut()}
        onFitTree={() => canvas.current?.fitTree()}
      />

      {paintMode && (
        <PaintPalette
          colors={game.unlockedColors}
          selectedColor={paintColor}
          onSelectColor={setPaintColor}
          canUndo={paintHistory.length > 0}
          onUndo={undoPaint}
          onDone={togglePaint}
        />
      )}

      {openPanel === "shop" && <ShopPanel
        balance={balance}
        purchases={purchases}
        onBuy={itemId => game.dispatch({ type: "buyItem", itemId, id: crypto.randomUUID() })}
        onPlace={purchaseId => { setPlacingItem(purchaseId); setPaintMode(false); closePanel(); }}
        onStore={purchaseId => game.dispatch({ type: "placeItem", purchaseId, segmentId: null })}
        onClose={closePanel}
      />}
      {placingItem && <div className="shop-placement" role="status">
        <span>Click a leafy branch to place your item.</span>
        <button onClick={() => setPlacingItem(null)}>Cancel</button>
      </div>}
      {openPanel === "selfCare" && <SelfCarePanel onClose={closePanel} />}
      {openPanel === "journal" && <JournalBook onClose={closePanel} />}
      {openPanel === "relics" && <RelicsPanel onClose={closePanel} />}
      {openPanel === "settings" && <SettingsPanel onClose={closePanel} />}

      {state.spirit.enabled && (
        <SpiritBubble message={game.spiritMessage} onClose={game.markSpiritShown} />
      )}

      <GrowBoost />
      {DEMO_MODE && <DemoControls />}
    </div>
  );
}
