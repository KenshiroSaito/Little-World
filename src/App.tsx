import ShopPanel from './shop/ShopPanel';
import { isAccessory } from './shop/catalog';
import { shopBalance, wornItems } from './shop/inventory';
import { useMemo, useRef, useState } from "react";
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
  const purchases = useMemo(() => state.shopPurchases ?? [], [state.shopPurchases]);
  const balance = shopBalance(game.totalLP, purchases);
  const outfit = useMemo(() => wornItems(purchases), [purchases]);
  // Every reflection buries a keepsake at the tip of its root.
  const keepsakes = useMemo(
    () => state.selfCareLogs.filter((log) => log.activityId === "reflect").map((log) => log.id),
    [state.selfCareLogs],
  );
  /** The record the journal or relics open on: its leaves or keepsake were clicked. */
  const [focusLog, setFocusLog] = useState<string | null>(null);

  const closePanel = () => setOpenPanel(null);

  function openPanelAt(panel: PanelId, logId: string | null) {
    setFocusLog(logId);
    setOpenPanel(panel);
  }

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
    if (selection.kind === "segment") {
      // A branch's id is its record's id plus ":b": open the journal on that record.
      openPanelAt("journal", selection.id.replace(/:b$/, ""));
    } else if (selection.kind === "reflection") {
      openPanelAt("relics", selection.id);
    } else {
      openPanelAt("relics", null);
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
        outfit={outfit}
        keepsakes={keepsakes}
        reducedMotion={state.settings.reducedMotion}
        spiritEnabled={state.spirit.enabled}
      />

      <Hud
        totalLP={balance}
        paintMode={paintMode}
        onOpenPanel={(panel) => {
          setPlacingItem(null);
          setPaintMode(false);
          openPanelAt(panel, null);
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
        onBuy={itemId => {
          const id = crypto.randomUUID();
          game.dispatch({ type: "buyItem", itemId, id });
          // Accessories go straight on the spirit.
          if (isAccessory(itemId)) game.dispatch({ type: "wearItem", purchaseId: id, worn: true });
        }}
        onPlace={purchaseId => { setPlacingItem(purchaseId); setPaintMode(false); closePanel(); }}
        onStore={purchaseId => game.dispatch({ type: "placeItem", purchaseId, segmentId: null })}
        onWear={(purchaseId, worn) => game.dispatch({ type: "wearItem", purchaseId, worn })}
        onClose={closePanel}
      />}
      {placingItem && <div className="shop-placement" role="status">
        <span>Click a leafy branch to place your item.</span>
        <button onClick={() => setPlacingItem(null)}>Cancel</button>
      </div>}
      {openPanel === "selfCare" && <SelfCarePanel onClose={closePanel} />}
      {openPanel === "journal" && (
        <JournalBook
          key={focusLog ?? "newest"}
          focusLogId={focusLog}
          onClose={closePanel}
          onShowOnTree={(logId) => {
            closePanel();
            canvas.current?.focusBranch(`${logId}:b`);
          }}
        />
      )}
      {openPanel === "relics" && (
        <RelicsPanel
          focusLogId={focusLog}
          onClose={closePanel}
          onShowOnTree={(logId) => {
            closePanel();
            canvas.current?.focusKeepsake(logId);
          }}
        />
      )}
      {openPanel === "settings" && <SettingsPanel onClose={closePanel} />}

      {state.spirit.enabled && (
        <SpiritBubble message={game.spiritMessage} onClose={game.markSpiritShown} />
      )}

      <GrowBoost />
      {DEMO_MODE && <DemoControls />}
    </div>
  );
}
