

# Fix: Add Voice Mode Button to the AI Assistant

## Problem Found

After inspecting the code, I found that **the voice mode button is missing on desktop**. Here's why:

- **Mobile** uses `DoriPanel`, which has a mic button in its header -- this should work
- **Desktop** uses `ChatPanel` for the assistant, which has NO voice mode button at all
- The `onVoiceMode` callback exists and is passed through the component chain, but it's never connected to `ChatPanel` on desktop
- The only ways to trigger voice mode right now are the wake word ("Hey Dori") or a hidden keyboard shortcut (Ctrl+Shift+V) -- neither is discoverable

## What Changes

### 1. Add Voice Mode Button to ChatPanel (Desktop Fix)

Add an `onVoiceMode` prop to `ChatPanel` and render a prominent mic/voice button in the header bar, matching DoriPanel's design. This gives desktop users a clear, visible way to enter voice mode.

### 2. Pass onVoiceMode Through to ChatPanel

Update `StandardMode.tsx` to forward the `onVoiceMode` prop when rendering `ChatPanel` inside the assistant panel.

---

## Technical Details

### File: `src/components/chat/ChatPanel.tsx`
- Add `onVoiceMode?: () => void` to `ChatPanelProps`
- Render a voice mode button (mic icon with "Voice Mode" tooltip) in the header area, next to the fullscreen toggle
- Style it consistently with DoriPanel's voice button

### File: `src/components/layout/StandardMode.tsx`
- Pass `onVoiceMode={onVoiceMode}` to the `ChatPanel` component at line ~413

### No other files need changes
The mobile `DoriPanel` already has the button. The `onVoiceMode` callback already works end-to-end (it calls `setMode('ghost')` in Index.tsx).

