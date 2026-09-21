"use client";

import { useState } from "react";

export type CatalogSticker = { value: string; label: string; category: string; kind?: "sticker" | "tape" };

const CATALOG: CatalogSticker[] = [
  { value: "🌿", label: "Leaf sprig", category: "Botanical" }, { value: "🌱", label: "Seedling", category: "Botanical" },
  { value: "🌵", label: "Cactus", category: "Botanical" }, { value: "🌼", label: "Daisy", category: "Botanical" },
  { value: "🌷", label: "Tulip", category: "Botanical" }, { value: "🍂", label: "Autumn leaf", category: "Botanical" },
  { value: "dream gently", label: "Dream gently", category: "Quotes" }, { value: "little moments", label: "Little moments", category: "Quotes" },
  { value: "you are growing", label: "You are growing", category: "Quotes" }, { value: "slow days", label: "Slow days", category: "Quotes" },
  { value: "💌", label: "Love letter", category: "Stamps" }, { value: "🏷️", label: "Parcel tag", category: "Stamps" },
  { value: "🦋", label: "Butterfly stamp", category: "Stamps" }, { value: "🗼", label: "Travel stamp", category: "Stamps" },
  { value: "✦", label: "Sparkle", category: "Doodles" }, { value: "☁︎", label: "Cloud", category: "Doodles" },
  { value: "♡", label: "Heart", category: "Doodles" }, { value: "☾", label: "Moon", category: "Doodles" },
];

const TAPES: CatalogSticker[] = [
  { value: "stripe", label: "Kraft stripe", category: "Washi", kind: "tape" }, { value: "floral", label: "Tiny florals", category: "Washi", kind: "tape" },
  { value: "blush", label: "Blush gingham", category: "Washi", kind: "tape" }, { value: "sage", label: "Sage grid", category: "Washi", kind: "tape" },
  { value: "sky", label: "Powder blue", category: "Washi", kind: "tape" }, { value: "sun", label: "Butter stripe", category: "Washi", kind: "tape" },
];

export function StickerCatalog({ onAdd }: { onAdd: (item: CatalogSticker) => void }) {
  const categories = ["Botanical", "Quotes", "Stamps", "Doodles"];
  const [category, setCategory] = useState(categories[0]);
  const drag = (event: React.DragEvent, item: CatalogSticker) => event.dataTransfer.setData("application/x-journal-sticker", JSON.stringify(item));
  return <div className="sticker-catalog">
    <div className="catalog-tabs" role="tablist">{categories.map(item => <button key={item} role="tab" aria-selected={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <div className="catalog-grid sticker-grid">{CATALOG.filter(item => item.category === category).map(item => <button key={item.label} draggable onDragStart={event => drag(event, item)} onClick={() => onAdd(item)} title="Drag or tap to add"><span>{item.value}</span><small>{item.label}</small></button>)}</div>
    <h3>Washi tapes</h3>
    <div className="washi-grid">{TAPES.map(item => <button key={item.value} className={`washi-swatch ${item.value}`} draggable onDragStart={event => drag(event, item)} onClick={() => onAdd(item)} aria-label={item.label}/>)}</div>
  </div>;
}
