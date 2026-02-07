import { GoogleGenerativeAI, Content, Part } from "@google/generative-ai";

// Initialize the client
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const MODEL_NAME = 'gemini-3-flash-preview';
const FALLBACK_MODEL_NAME = 'gemini-2.5-flash';

// Helper to check if error is a rate limit error
const isRateLimitError = (error: unknown): boolean => {
  return error instanceof Error && error.message.includes('429');
};

export interface LineSegment {
  start: [number, number];
  end: [number, number];
}

export interface GeometricScanResult {
  leftSet: LineSegment[];
  rightSet: LineSegment[];
  verticalSet: LineSegment[];
}

export interface GradingResult {
  grade: string;
  feedback: string;
  thought_process?: string;
}

/**
 * Sends a text message to the chat model.
 */
export const sendMessageToGemini = async (
  history: { role: string; parts: { text: string }[] }[],
  newMessage: string
): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: "You are an expert Art Tutor specializing exclusively in Linear Perspective and Geometric Forms. Your goal is to help users master drawing cubes in 1-point, 2-point, and 3-point perspective. Be precise about vanishing points, horizon lines, and convergence. Use markdown for clarity."
    });

    const chatHistory: Content[] = history.map(msg => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: msg.parts.map(p => ({ text: p.text } as Part))
    }));

    const chat = model.startChat({
      history: chatHistory,
    });

    const result = await chat.sendMessage(newMessage);
    const response = await result.response;

    return response.text();
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "Sorry, I encountered an error connecting to the Art Tutor service.";
  }
};

/**
 * Generates a critique for an uploaded image.
 */
export const generateCritique = async (imageBase64: string, userQuestion: string): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: "You are an expert Art Tutor. You analyze geometric drawings with simple, clear language. Avoid mathematical jargon. Focus on 'flow', 'direction', and 'slant'."
    });

    const base64Data = imageBase64.split(',')[1] || imageBase64;

    const prompt = userQuestion
      ? `Critique this perspective drawing. Focus on: ${userQuestion}. Analyze vanishing points and lines naturally. No math terms.`
      : "Critique this perspective drawing of cubes. Check if lines converge nicely. Check for distortion. Give 3 actionable tips to improve the 3D solidity. Use simple art terms.";

    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType: 'image/png', data: base64Data } }
    ]);
    const response = await result.response;

    return response.text();
  } catch (error) {
    console.error("Gemini Critique Error:", error);
    return "Failed to analyze the image. Please ensure it is a valid image file.";
  }
};

/**
 * Scans a single image to extract perspective structure.
 */
export const scanImageStructure = async (
  imageBase64: string,
  label: "Reference Model" | "User Drawing"
): Promise<GeometricScanResult> => {
  const base64Data = imageBase64.split(',')[1] || imageBase64;

  const prompt = `
    Analyze this ${label}.
    Task: Identify the structural edges of the CUBE form.
    
    Stats:
    - Image Type: ${label === "User Drawing" ? "Hand-drawn sketch (Pencil/Ink)" : "3D Render (High Contrast Wireframe)"}
    - Goal: Extract ONLY the lines that define the cube's structure.
    
    For 3D Render (Reference):
    - The lines are perfect, high-contrast black pixels on white.
    - SNAP EXACTLY to the pixel line centers.
    - Do not "hallucinate" curves. These are straight lines.
    - Consistency is key.
    
    For User Drawing:
    - Ignore erasings, smudges, or grid lines.
    - LOOK FOR DARK, DEFINITE STROKES.
    - Connect broken lines if they clearly form a single edge.
    
    Categorize lines into:
    - leftSet: Lines converging to Left VP (or Horizontal in 1pt).
    - rightSet: Lines converging to Right VP (or Depth in 1pt).
    - verticalSet: Vertical lines (Y-axis).
    
    Return JSON:
    {
      "leftSet": [ { "start": [x, y], "end": [x, y] }, ... ],
      "rightSet": [ ... ],
      "verticalSet": [ ... ]
    }
    
    Coordinate System:
    - [0, 0] is Top-Left corner of the image.
    - [1000, 1000] is Bottom-Right corner.
    - Normalize all points to this 1000x1000 space regardless of aspect ratio.
  `;

  const contentPayload = [
    prompt,
    { inlineData: { mimeType: 'image/png', data: base64Data } }
  ];

  const modelsToTry = [MODEL_NAME, FALLBACK_MODEL_NAME];

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
      });
      const result = await model.generateContent(contentPayload);
      const data = JSON.parse(result.response.text());
      return {
        leftSet: data.leftSet || [],
        rightSet: data.rightSet || [],
        verticalSet: data.verticalSet || []
      };
    } catch (e) {
      console.warn(`Scan failed on ${modelName}`, e);
      if (modelName === FALLBACK_MODEL_NAME) throw e;
    }
  }
  return { leftSet: [], rightSet: [], verticalSet: [] };
};

/**
 * Compares two already-scanned geometric sets.
 */
export const compareLineSets = async (
  refSet: GeometricScanResult,
  userSet: GeometricScanResult,
  context?: string
): Promise<GradingResult> => {
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: { responseMimeType: "application/json" }
  });

  const prompt = `
    COMPARE these two geometric datasets.
    
    CONTEXT: ${context || "General Perspective Drawing"}
    
    Reference Data (Ground Truth - PERFECT 3D MODEL):
    ${JSON.stringify(refSet)}
    
    User Data (Hand-drawn Attempt):
    ${JSON.stringify(userSet)}
    
    **Task & Rules**:
    1. **THE REFERENCE IS LAW**: The "Reference Data" comes from a perfect 3D engine. It is the absolute correct answer.
    2. **COMPARE SLOPE/ANGLE**: Check if the User's lines match the SLOPE of the Reference lines.
    3. **IGNORE POSITION**: A user can draw the cube slightly to the left or right. That is OKAY.
    4. **STRICT ON ANGLES**: If a User line is horizontal, but the Reference line is angled, that is a FAIL (Wrong perspective type).
    5. **PENALIZE DIVERGENCE**: If the user's lines do not converge to the same VP area as the reference, deduct points heavily.
    
    **Grading Scale**:
    - **A (Excellent)**: Angles match the reference almost perfectly. Perspective is accurate.
    - **B (Good)**: General shape is correct, but some lines have slight angle errors.
    - **C (Average)**: Noticeable perspective errors. Lines are parallel when they should converge (or vice-versa).
    - **D (Poor)**: Significant distortion. The drawing does not look like the reference model's perspective.
    - **F (Fail)**: Completely wrong perspective type (e.g. drawing 2-point when reference is 1-point).

    **TONE GUIDE**:
    - Be strict but constructive (like a serious Art Professor).
    - Point out *specific* lines that are wrong (e.g. "Your vertical lines are tilting").
    - **FORBIDDEN WORDS**: Vector, Orthogonal, Cartesian, Co-linear, Delta, Slope.
    - **PREFERRED WORDS**: Slant, Angle, Direction, Flow, Going back, Converging, Steepness.
    
    Return JSON:
    {
      "thought_process": "Critically analyze match between Reference (Truth) and User (Attempt).",
      "grade": "A/B/C/D/F",
      "feedback": "Markdown feedback. specific and tough on accuracy."
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (e) {
    console.error("Comparison Logic Error", e);
    return { grade: "C", feedback: "Error during comparison." };
  }
};

/**
 * Compares a user's drawing with a reference image.
 * @deprecated Use scanImageStructure + compareLineSets instead.
 */
export const compareDrawings = async (
  referenceImage: string,
  userDrawing: string,
  meta?: {
    edgesX?: number[][],
    edgesZ?: number[][],
    vpLeft?: number[] | null,
    vpRight?: number[] | null
  },
  onStream?: (text: string) => void
): Promise<{
  grade: string,
  feedback: string,
  leftSet: { start: [number, number], end: [number, number] }[],
  rightSet: { start: [number, number], end: [number, number] }[],
  verticalSet: { start: [number, number], end: [number, number] }[]
  refLeftSet: { start: [number, number], end: [number, number] }[],
  refRightSet: { start: [number, number], end: [number, number] }[],
  refVerticalSet: { start: [number, number], end: [number, number] }[],
  thought_process?: string,
}> => {
  const refData = referenceImage.split(',')[1] || referenceImage;
  const userData = userDrawing.split(',')[1] || userDrawing;

  let groundTruthPrompt = "";
  if (meta) {
    groundTruthPrompt = `
    **GROUND TRUTH DATA (The Correct Answer)**:
    - This is the exact screen-space geometry of the reference cube.
    - X-Axis Edges (should converge to one VP in 2pt, or be horizontal in 1pt): ${JSON.stringify(meta.edgesX)}
    - Z-Axis Edges (should converge to Depth VP): ${JSON.stringify(meta.edgesZ)}
    
    **Comparison Logic**:
    1. IGNORE the reference image styles. Look only at the GEOMETRY.
    2. Compare the USER'S drawn lines to the GROUND TRUTH lines above.
    3. If the user's angles match the Ground Truth, they get a high grade.
    4. If the user drew a 2-point cube (angled X-edges) but the Ground Truth is a 1-point cube (horizontal X-edges), they have FAILED the perspective type. Grade = D or F.
    `;
  }

  const prompt = `
    PERFORM A DUAL-IMAGE ANALYSIS WITH CHAIN-OF-THOUGHT REASONING.
    
    **Task**:
    1. **Analyze Image 1 (Reference)**: Identify the structural edges of the 3D Model.
       - **MANDATORY**: You MUST extract the actual lines from this image for the "ref" sets.
    2. **Analyze Image 2 (User Drawing)**: Identify the structural edges of the user's sketch.
    3. **Compare Geometry (Flow & Direction)**: 
       - Check if the User's lines follow the same path/slant as the Reference lines.
       - **CRITICAL**: Ignore position offsets (translation). Only penalize if the LINE DIRECTIONS diverge.
    
    **Grading Scale**:
    - **A (Excellent)**: Lines flow perfectly to the vanishing points.
    - **B (Good)**: Minor wobbles but general direction is correct.
    - **C (Average)**: Some lines go the wrong way.
    - **D/F (Fail)**: Completely wrong perspective type.

    **TONE GUIDE**:
    - Speak like an encouraging Art Teacher.
    - **FORBIDDEN WORDS**: Vector, Orthogonal, Cartesian, Co-linear, Delta, Slope, Degrees.
    - **PREFERRED WORDS**: Slant, Angle, Direction, Flow, Going back, Converging, Steepness.
    - Keep it simple and visual.

    Return JSON:
    {
      "thought_process": "Explain: 1. Ref Image Structure found. 2. User Image Structure found. 3. Comparison logic.",
      "grade": "A",
      "feedback": "Markdown string. Compare the User's lines to the Reference lines detected.",
      "leftSet": [ { "start": [x1, y1], "end": [x2, y2] }, ... ],
      "rightSet": [ { "start": [x1, y1], "end": [x2, y2] }, ... ],
      "verticalSet": [ { "start": [x1, y1], "end": [x2, y2] }, ... ],
      "refLeftSet": [ { "start": [x1, y1], "end": [x2, y2] }, ... ],
      "refRightSet": [ { "start": [x1, y1], "end": [x2, y2] }, ... ],
      "refVerticalSet": [ { "start": [x1, y1], "end": [x2, y2] }, ... ]
    }
    
    - Coordinate System: Top-Left=[0,0], Bottom-Right=[1000,1000] relative to the image dimensions.
    - **Verify output**: Ensure "refLeftSet" etc. are NOT EMPTY if lines exist in Image 1.
  `;

  const contentPayload = [
    "Reference Image (Wireframe Geometry):",
    { inlineData: { mimeType: 'image/png', data: refData } },
    "User's Drawing:",
    { inlineData: { mimeType: 'image/png', data: userData } },
    prompt
  ];

  const systemInstruction = "You are a friendly Art Tutor. Your job is to extract the key structural lines from a user's drawing of a cube and grade them based on visual flow and direction. Avoid mathematical jargon like 'orthogonal', 'vector', or 'cartesian'. Use 'slant', 'angle', and 'direction' instead.";

  // Try primary model, fallback on rate limit
  const modelsToTry = [MODEL_NAME, FALLBACK_MODEL_NAME];

  for (const modelName of modelsToTry) {
    try {
      console.log(`Trying model: ${modelName}`);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" },
        systemInstruction
      });

      // Use streaming if callback provided
      if (onStream) {
        const result = await model.generateContentStream(contentPayload);
        let fullText = '';

        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          fullText += chunkText;
          onStream(fullText);
        }

        try {
          const data = JSON.parse(fullText);
          if (!data.grade) data.grade = 'C';
          console.log(`Success with model: ${modelName}`);
          return data;
        } catch (e) {
          console.error("Failed to parse JSON:", fullText);
          // Return empty structure on failure
          return { grade: 'F', feedback: fullText, leftSet: [], rightSet: [], verticalSet: [], refLeftSet: [], refRightSet: [], refVerticalSet: [] };
        }
      } else {
        // Non-streaming fallback
        const result = await model.generateContent(contentPayload);
        const response = await result.response;
        const text = response.text();

        try {
          const data = JSON.parse(text);
          if (!data.grade) data.grade = 'C';
          console.log(`Success with model: ${modelName}`);
          return data;
        } catch (e) {
          console.error("Failed to parse JSON:", text);
          return { grade: 'F', feedback: text, leftSet: [], rightSet: [], verticalSet: [], refLeftSet: [], refRightSet: [], refVerticalSet: [] };
        }
      }
    } catch (error) {
      console.warn(`Model ${modelName} failed:`, error);
      if (isRateLimitError(error) && modelName !== FALLBACK_MODEL_NAME) {
        console.log(`Rate limited on ${modelName}, trying fallback...`);
        continue; // Try next model
      }
      // If not a rate limit error or we're already on fallback, throw
      if (modelName === FALLBACK_MODEL_NAME) {
        console.error("Gemini Comparison Error (all models exhausted):", error);
        return { grade: 'F', feedback: "Failed to compare images. Please try again later.", leftSet: [], rightSet: [], verticalSet: [], refLeftSet: [], refRightSet: [], refVerticalSet: [] };
      }
    }
  }

  return { grade: 'F', feedback: "Failed to compare images. Please try again.", leftSet: [], rightSet: [], verticalSet: [], refLeftSet: [], refRightSet: [], refVerticalSet: [] };
}

/**
 * Generates a lesson content based on a topic.
 */
export const generateLesson = async (topic: string): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `Create a short, interactive art lesson about: "${topic}" specifically in the context of drawing CUBES in perspective.
    Include:
    1. Definition.
    2. Key Rules(e.g., relationship to the Horizon Line).
    3. Common Mistakes(e.g., expanding rear planes).
    4. A Short "Cube Sketch" Exercise(e.g., Draw a cube floating above the horizon).
    Use Markdown formatting with bold headers and bullet points.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;

    return response.text();
  } catch (error) {
    console.error("Gemini Lesson Error:", error);
    return "Error generating lesson.";
  }
};
