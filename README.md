# Art Coach

A turn-based visual drawing coach that teaches one-point perspective cube construction using AI-powered image analysis.

## How It Works

Art Coach is a **turn-based visual tutor** — think chess, not video chat. The user draws, captures an image, and receives AI feedback with visual overlays showing what to fix and what to draw next.

### Core Loop

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  User Draws │ ──▶ │   Capture   │ ──▶ │  AI Analyzes│ ──▶ │   Overlay   │
│             │     │   Image     │     │   Drawing   │     │   Feedback  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       ▲                                                           │
       └───────────────────────────────────────────────────────────┘
                              User redraws
```

### Architecture

```
src/
├── components/
│   ├── DrawingCoach.tsx    # Main orchestrator - wires state, canvas, and AI
│   ├── ImageCapture.tsx    # Camera capture + file upload
│   ├── CanvasOverlay.tsx   # Layered canvas rendering system
│   ├── StepIndicator.tsx   # Progress bar (3 steps)
│   └── InstructionPanel.tsx # Feedback display + action buttons
├── hooks/
│   ├── useDrawingState.ts  # State machine (useReducer)
│   ├── useGeminiAnalysis.ts # TanStack Query mutation
│   ├── useCamera.ts        # MediaDevices API wrapper
│   └── useLineAnimation.ts # requestAnimationFrame animations
├── services/
│   └── gemini.ts           # Gemini Vision client + prompts + response parsing
├── types/
│   └── index.ts            # TypeScript definitions
└── utils/
    └── canvas.ts           # Drawing helpers + coordinate conversion
```

### Key Design Decisions

#### 1. State Machine with `useReducer`
All state transitions are explicit and typed. The app progresses through states:
```
idle → capturing → analyzing → showing_feedback → animating_guide → awaiting_redraw → [next step or completed]
```

#### 2. Normalized Coordinates (0-1)
Gemini returns coordinates normalized to 0-1. This decouples AI output from canvas dimensions:
```typescript
// Gemini returns: { x: 0.5, y: 0.3 }
// Canvas converts: { x: 400, y: 180 } (for 800x600 canvas)
```

#### 3. Layered Canvas Rendering
Single `<canvas>` element with multiple render passes:
- Layer 0: Base image (user's drawing)
- Layer 1: Error highlights (red/orange boxes)
- Layer 2: Suggested guide lines (green, animated)

#### 4. EXIF-Safe Image Processing
Phone photos have EXIF rotation metadata. We draw to canvas before extracting base64, which applies the rotation so Gemini sees the correct orientation.

---

## Setup

### Prerequisites
- Node.js 18+
- A Google AI Studio API key

### 1. Clone and Install

```bash
cd drawing-app
npm install
```

### 2. Configure Environment

Create a `.env` file from the sample:

```bash
cp .env.sample .env
```

Edit `.env` and add your Gemini API key:

```
VITE_GEMINI_API_KEY=your_api_key_here
```

#### Getting a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key and paste it into your `.env` file

> **Note:** The free tier has generous limits for hackathon/development use.

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for Production

```bash
npm run build
npm run preview
```

---

## Usage

1. **Start** — You'll see the capture screen
2. **Draw** — Draw a cube on paper (or use a drawing app)
3. **Capture** — Use camera or upload an image
4. **Review** — See AI feedback with score, errors, and suggestions
5. **Show Guide Lines** — Optional animated overlay showing what to draw
6. **Retry or Next Step** — Fix issues or proceed to the next construction step

### The 3 Steps

| Step | Goal | What AI Checks |
|------|------|----------------|
| 1. Front Face | Draw a square | Four lines, ~90° corners, equal sides |
| 2. Depth Lines | Lines toward vanishing point | Convergence, direction (upper-right) |
| 3. Back Face | Complete the cube | Parallel to front, proper perspective |

---

## How the AI Works

### Prompt Strategy

Gemini is framed as a **geometry analyzer**, not an art critic. The prompt:
- Specifies one-point perspective rules
- Requests normalized (0-1) coordinates
- Enforces JSON-only output
- Limits errors to top 3 issues

### Response Schema

```json
{
  "success": true,
  "overallScore": 78,
  "errors": [
    {
      "type": "line_angle",
      "severity": "minor",
      "description": "Front face slightly tilted",
      "location": { "x": 0.2, "y": 0.3, "width": 0.3, "height": 0.3 }
    }
  ],
  "suggestedCorrections": [
    {
      "type": "draw_line",
      "description": "Draw vertical edge here",
      "line": {
        "start": { "x": 0.6, "y": 0.2 },
        "end": { "x": 0.6, "y": 0.5 }
      }
    }
  ],
  "feedback": "Good start! Your front face is well-proportioned.",
  "readyForNextStep": true
}
```

### Error Handling

- **Bad JSON** → Zod validation catches it, shows fallback message
- **Rate limiting** → TanStack Query retries (2 attempts)
- **Off-screen coordinates** → Clamped to valid range

---

## Future Improvements

### Short-term (Hackathon Polish)

- [ ] **Better visual feedback** — Pulsing animations on error regions
- [ ] **Voice instructions** — Text-to-speech for hands-free guidance
- [ ] **Undo/history** — Let users go back to previous captures
- [ ] **Mobile optimization** — Responsive layout, touch-friendly buttons

### Medium-term (Feature Expansion)

- [ ] **More shapes** — Cylinders, spheres, two-point perspective
- [ ] **Difficulty levels** — Beginner (guided) vs Advanced (less hand-holding)
- [ ] **Progress tracking** — Save session history, show improvement over time
- [ ] **Custom exercises** — Let users define their own construction steps
- [ ] **Drawing on canvas** — Draw directly in-app instead of uploading photos

### Long-term (Product Vision)

- [ ] **Real-time feedback** — Gemini Live integration for streaming analysis
- [ ] **AR overlay** — Use device camera to overlay guides on physical paper
- [ ] **Curriculum system** — Structured lessons: perspective → shading → composition
- [ ] **Community features** — Share drawings, get peer feedback
- [ ] **Instructor mode** — Teachers create custom exercises for students

### Technical Debt

- [ ] **Add tests** — Unit tests for state machine, integration tests for Gemini parsing
- [ ] **Error boundaries** — Graceful recovery from component crashes
- [ ] **Accessibility** — Screen reader support, keyboard navigation
- [ ] **Performance** — Lazy load components, optimize canvas rendering
- [ ] **Offline support** — Service worker for PWA capabilities

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + TypeScript |
| Build | Vite 6 |
| State | useReducer + TanStack Query |
| AI | Google Gemini Vision (@google/genai) |
| Validation | Zod |
| Styling | Plain CSS (CSS variables) |

---

## License

MIT
