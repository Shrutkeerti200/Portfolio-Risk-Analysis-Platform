const PALETTE = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
    '#6366f1', // indigo
    '#14b8a6', // teal
    '#e879f9', // fuchsia
    '#84cc16', // lime
    '#fb7185', // rose
    '#38bdf8', // sky
    '#a78bfa', // purple-light
    '#fbbf24', // yellow
    '#2dd4bf', // teal-light
    '#f472b6', // pink-light
    '#60a5fa', // blue-light
    '#34d399', // emerald-light
    '#c084fc', // purple
    '#fb923c', // orange-light
    '#4ade80', // green
    '#f87171', // red-light
    '#22d3ee', // cyan-light
    '#a3e635', // lime-light
    '#818cf8', // indigo-light
    '#fca5a5', // rose-light
    '#67e8f9', // sky-light
    '#d946ef', // fuchsia-bold
];
 
/**
 * Simple string hash that produces a consistent integer for any input.
 */
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit int
    }
    return Math.abs(hash);
}
 
/**
 * Cache so we don't recompute, and more importantly so we can
 * track which palette indices are already taken within a session
 * to minimize collisions when many stocks are displayed together.
 */
const assignedColors = {};
const usedIndices = new Set();
 
/**
 * Get a consistent, unique color for a stock symbol.
 * 
 * @param {string} symbol - Stock ticker (e.g., "AAPL", "GOOGL")
 * @returns {string} Hex color string
 */
export function getStockColor(symbol) {
    if (!symbol) return '#6b7280'; // gray fallback
 
    const key = symbol.toUpperCase();
 
    // Return cached color if already assigned
    if (assignedColors[key]) {
        return assignedColors[key];
    }
 
    // Hash the symbol to get a starting index
    let index = hashString(key) % PALETTE.length;
 
    // If that index is already taken, find the next available one
    if (usedIndices.has(index)) {
        let attempts = 0;
        while (usedIndices.has(index) && attempts < PALETTE.length) {
            index = (index + 1) % PALETTE.length;
            attempts++;
        }
        // If ALL 30 colors are taken, wrap around (very unlikely with 30 colors)
        if (attempts >= PALETTE.length) {
            index = hashString(key) % PALETTE.length;
        }
    }
 
    usedIndices.add(index);
    assignedColors[key] = PALETTE[index];
    return PALETTE[index];
}
 
/**
 * Get colors for multiple symbols at once.
 * Useful when rendering a chart with many stocks.
 * 
 * @param {string[]} symbols - Array of stock tickers
 * @returns {Object} Map of symbol -> color
 */
export function getStockColors(symbols) {
    const colors = {};
    for (const symbol of symbols) {
        colors[symbol.toUpperCase()] = getStockColor(symbol);
    }
    return colors;
}
 
/**
 * Get the full palette (for pie charts that need indexed colors).
 */
export function getPaletteColor(index) {
    return PALETTE[index % PALETTE.length];
}
 
export default { getStockColor, getStockColors, getPaletteColor };