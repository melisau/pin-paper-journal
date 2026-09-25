"use client";

import { useState } from "react";

export type CatalogSticker = { value: string; label: string; category: string; kind?: "sticker" | "tape" };

const CATALOG: CatalogSticker[] = [
  { value: "🌿", label: "Leaf sprig", category: "Botanical" }, { value: "🌱", label: "Seedling", category: "Botanical" },
  { value: "🌵", label: "Cactus", category: "Botanical" }, { value: "🌼", label: "Daisy", category: "Botanical" },
  { value: "🌷", label: "Tulip", category: "Botanical" }, { value: "🍂", label: "Autumn leaf", category: "Botanical" },
  { value: "🍄", label: "Mushroom", category: "Botanical" }, { value: "🪴", label: "Potted plant", category: "Botanical" },
  { value: "🌸", label: "Cherry blossom", category: "Botanical" }, { value: "🪻", label: "Hyacinth", category: "Botanical" },
  { value: "🌾", label: "Wheat sprig", category: "Botanical" }, { value: "🍃", label: "Floating leaf", category: "Botanical" },
  { value: "dream gently", label: "Dream gently", category: "Quotes" }, { value: "little moments", label: "Little moments", category: "Quotes" },
  { value: "you are growing", label: "You are growing", category: "Quotes" }, { value: "slow days", label: "Slow days", category: "Quotes" },
  { value: "one day at a time", label: "One day at a time", category: "Quotes" }, { value: "make room for joy", label: "Make room for joy", category: "Quotes" },
  { value: "soft heart, brave soul", label: "Soft heart", category: "Quotes" }, { value: "bloom at your pace", label: "Bloom at your pace", category: "Quotes" },
  { value: "today is enough", label: "Today is enough", category: "Quotes" }, { value: "collect small wonders", label: "Small wonders", category: "Quotes" },
  { value: "rest is productive", label: "Rest is productive", category: "Quotes" }, { value: "begin again", label: "Begin again", category: "Quotes" },
  { value: "💌", label: "Love letter", category: "Stamps" }, { value: "🏷️", label: "Parcel tag", category: "Stamps" },
  { value: "🦋", label: "Butterfly stamp", category: "Stamps" }, { value: "🗼", label: "Travel stamp", category: "Stamps" },
  { value: "📮", label: "Post box", category: "Stamps" }, { value: "✉️", label: "Envelope", category: "Stamps" },
  { value: "🗺️", label: "Travel map", category: "Stamps" }, { value: "🧳", label: "Suitcase", category: "Stamps" },
  { value: "📍", label: "Map pin", category: "Stamps" }, { value: "🎟️", label: "Ticket", category: "Stamps" },
  { value: "✦", label: "Sparkle", category: "Doodles" }, { value: "☁︎", label: "Cloud", category: "Doodles" },
  { value: "♡", label: "Heart", category: "Doodles" }, { value: "☾", label: "Moon", category: "Doodles" },
  { value: "☀︎", label: "Sun", category: "Doodles" }, { value: "⌁", label: "Wavy line", category: "Doodles" },
  { value: "✿", label: "Tiny flower", category: "Doodles" }, { value: "𓆩♡𓆪", label: "Winged heart", category: "Doodles" },
  { value: "⋆｡°✩", label: "Star trail", category: "Doodles" }, { value: "୨୧", label: "Ribbon", category: "Doodles" },
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
    <div className={`catalog-grid sticker-grid category-${category.toLowerCase()}`}>{CATALOG.filter(item => item.category === category).map(item => <button key={item.label} draggable onDragStart={event => drag(event, item)} onClick={() => onAdd(item)} title={`${item.label} — drag or tap to add`}><span>{item.value}</span><small>{item.label}</small></button>)}</div>
    <h3>Washi tapes</h3>
    <div className="washi-grid">{TAPES.map(item => <button key={item.value} className={`washi-swatch ${item.value}`} draggable onDragStart={event => drag(event, item)} onClick={() => onAdd(item)} aria-label={item.label}/>)}</div>
  </div>;
}
