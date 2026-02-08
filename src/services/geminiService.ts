import { GoogleGenerativeAI, Content, Part } from "@google/generative-ai";
import { getDifficulty, Difficulty } from './storageService';

// Initialize the client
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const MODEL_NAME = 'gemini-3-flash-preview';

// Feedback instructions based on difficulty
const FEEDBACK_INSTRUCTIONS: Record<Difficulty, string> = {
  beginner: `
    Provide DETAILED, encouraging feedback for a beginner:
    - Explain WHY certain lines should converge
    - Point out what they did WELL first
    - Give step-by-step guidance on fixing issues
    - Use simple language, avoid jargon
    - Be encouraging and supportive`,
  intermediate: `
    Provide BALANCED feedback:
    - Note strengths and areas for improvement
    - Give specific, actionable advice
    - Reference perspective principles briefly`,
  advanced: `
    Provide CONCISE, technical feedback:
    - Skip basics, focus on subtle errors
    - Use technical terminology
    - Brief, direct critique
    - Challenge them to refine details`
};

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

    let chatHistory: Content[] = history.map(msg => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: msg.parts.map(p => ({ text: p.text } as Part))
    }));

    // Gemini requires first message to be 'user' - remove any leading 'model' messages
    while (chatHistory.length > 0 && chatHistory[0].role === 'model') {
      chatHistory = chatHistory.slice(1);
    }

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

// Critique style and strictness based on difficulty
const CRITIQUE_STYLE: Record<Difficulty, string> = {
  beginner: `Be encouraging and educational. Start by noting what they did well. Explain concepts simply. Grading strictness: LENIENT. Allow minor wobbles or slight perspective errors. Focus on the big picture (does it look like a cube?).`,
  intermediate: `Balance praise with constructive criticism. Reference perspective principles. Grading strictness: STANDARD. Expect correct convergence but allow very minor deviations. Point out specific errors clearly.`,
  advanced: `Be concise and technical. Skip basic explanations. Grading strictness: STRICT. Deduct points for ANY slight convergence drift, line wobble, or proportion error. Hold them to a professional standard.`
};

/**
 * Generates a critique for an uploaded image.
 */
export const generateCritique = async (imageBase64: string, userQuestion: string): Promise<string> => {
  try {
    const difficulty = getDifficulty();
    const critiqueStyle = CRITIQUE_STYLE[difficulty];

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: `You are a Perspective Expert. You analyze drawings of cubes and geometric shapes for mathematical and visual accuracy. You are strict about parallel vertical lines (in 1 and 2 point perspective) and convergence.

Style guidance: ${critiqueStyle}`
    });

    const base64Data = imageBase64.split(',')[1] || imageBase64;

    const basePrompt = userQuestion
      ? `Critique this perspective drawing. Focus on: ${userQuestion}. Analyze vanishing points, parallel lines, convergence, and cube proportions.`
      : "Critique this perspective drawing of cubes. Check if lines converge correctly to vanishing points. Check for distortion (e.g., 'fish-eye' effect or forced perspective). Give 3 actionable tips to improve the 3D solidity of the form.";

    const prompt = `${basePrompt}

Remember to match your response style to the student's level: ${critiqueStyle}`;

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

// Edge type definition
export type Edge = { start: [number, number], end: [number, number], type: 'left' | 'right' | 'vertical' };

/**
 * Extracts cube edges from a single image.
 * Used for step-by-step edge detection.
 */
export const extractEdges = async (imageBase64: string, imageType: 'reference' | 'drawing'): Promise<Edge[]> => {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: { responseMimeType: "application/json" },
      systemInstruction: "You are a Perspective Geometry Analyzer. Extract the visible edges of a cube from an image with precise coordinates."
    });

    const imageData = imageBase64.split(',')[1] || imageBase64;

    const prompt = `
      Extract the VISIBLE cube edges from this ${imageType === 'reference' ? '3D rendered cube' : 'hand-drawn cube'}.

      Instructions:
      - Identify each visible corner of the cube first
      - Draw edges from corner to corner with PRECISE coordinates
      - Categorize each edge:
        - **left**: Edges receding toward left vanishing point
        - **right**: Edges receding toward right vanishing point
        - **vertical**: Vertical edges (parallel in 2-point perspective)
      
      ONLY include edges that are actually visible (typically 9 edges).
      Do NOT include hidden/occluded edges.

      Return JSON:
      {
        "edges": [
          { "start": [x1, y1], "end": [x2, y2], "type": "left" | "right" | "vertical" }
        ]
      }

      Coordinates: Normalize to [0-1000] range (0,0 = top-left, 1000,1000 = bottom-right).
      Be EXACT - edges should connect at shared corners.
    `;

    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType: 'image/png', data: imageData } }
    ]);
    const response = await result.response;
    const text = response.text();

    try {
      const data = JSON.parse(text);
      return data.edges || [];
    } catch {
      console.error("Failed to parse edges JSON:", text);
      return [];
    }
  } catch (error) {
    console.error("Edge extraction error:", error);
    return [];
  }
};

/**
 * Compares pre-extracted edges and returns a grade and feedback.
 */
export const compareEdges = async (
  referenceEdges: Edge[],
  userEdges: Edge[],
  referenceImage: string,
  userDrawing: string
): Promise<{ grade: string, feedback: string }> => {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: { responseMimeType: "application/json" },
      systemInstruction: "You are a Perspective Expert. Compare two sets of cube edges and provide a grade and feedback."
    });

    const difficulty = getDifficulty();
    const feedbackStyle = FEEDBACK_INSTRUCTIONS[difficulty];

    const refData = referenceImage.split(',')[1] || referenceImage;
    const userData = userDrawing.split(',')[1] || userDrawing;

    const prompt = `
      Compare these cube drawings based on the detected edges.

      Reference Edges: ${JSON.stringify(referenceEdges)}
      User Edges: ${JSON.stringify(userEdges)}

      Grade the user's perspective accuracy:
      - **A**: Excellent accuracy, lines converge properly
      - **B**: Good with minor issues
      - **C**: Acceptable but noticeable errors
      - **D**: Significant perspective problems
      - **F**: Major fundamental errors

      ${feedbackStyle}

      Structure feedback as:
      - **Grade**: [Letter]
      - **What's Working**: 1-2 specific strengths
      - **Focus On**: 1-2 specific improvements

      Return JSON:
      {
        "grade": "A" | "B" | "C" | "D" | "F",
        "feedback": "Markdown string with grade and feedback"
      }
    `;

    const result = await model.generateContent([
      "Reference Image:",
      { inlineData: { mimeType: 'image/png', data: refData } },
      "User Drawing:",
      { inlineData: { mimeType: 'image/png', data: userData } },
      prompt
    ]);
    const response = await result.response;
    const text = response.text();

    try {
      const data = JSON.parse(text);
      return { grade: data.grade || 'C', feedback: data.feedback || '' };
    } catch {
      return { grade: 'C', feedback: text };
    }
  } catch (error) {
    console.error("Compare edges error:", error);
    return { grade: 'F', feedback: "Failed to compare. Please try again." };
  }
};

/**
 * Compares a user's drawing with a reference image.
 * Returns detected edges for both images and a letter grade.
 */
export const compareDrawings = async (referenceImage: string, userDrawing: string): Promise<{
  grade: string,
  feedback: string,
  referenceEdges: { start: [number, number], end: [number, number], type: 'left' | 'right' | 'vertical' }[],
  userEdges: { start: [number, number], end: [number, number], type: 'left' | 'right' | 'vertical' }[]
}> => {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: { responseMimeType: "application/json" },
      systemInstruction: "You are a specialized Perspective Geometry Analyzer. Your job is to extract and compare the key structural lines from both a reference cube and a user's drawing, then grade the accuracy."
    });

    const refData = referenceImage.split(',')[1] || referenceImage;
    const userData = userDrawing.split(',')[1] || userDrawing;

    const difficulty = getDifficulty();
    const feedbackStyle = FEEDBACK_INSTRUCTIONS[difficulty];

    const prompt = `
      Analyze BOTH images and extract their cube edges with PRECISE coordinates.

      ## Step 1: Extract Reference Edges (Image 1 - 3D Rendered Cube)
      The reference is a clean 3D rendered cube. Extract EXACTLY the visible edges:
      - Identify each corner of the cube first (there should be 6-8 visible corners)
      - Draw edges from corner to corner, not approximations
      - **left**: Edges that recede toward the left vanishing point (typically top-left and bottom-left faces)
      - **right**: Edges that recede toward the right vanishing point (typically top-right and bottom-right faces)
      - **vertical**: Perfectly vertical edges connecting top and bottom corners
      
      BE PRECISE: Place start/end coordinates exactly at the cube's corners, not near them.

      ## Step 2: Extract User Edges (Image 2 - Hand Drawing)
      Identify the drawn edges the same way. Look for the strongest, darkest lines.

      ## Step 3: Compare & Grade based on Difficulty
      Current Mode: ${difficulty.toUpperCase()}

      GRADE STRICTNESS GUIDE:
      - Beginner: Be lenient. If it looks like a cube and converges roughly, give a B or A.
      - Intermediate: Expect accuracy. Lines must converge to VPs.
      - Advanced: Zero tolerance for error. Any deviation = lower grade.

      Grading Scale:
      - **A** (90-100): Meets the strictness level perfectly
      - **B** (80-89): Good for this level
      - **C** (70-79): Acceptable for this level
      - **D** (60-69): Needs improvement
      - **F** (below 60): Major errors

      ## Step 4: Feedback
      ${feedbackStyle}

      Structure feedback as:
      - **Grade**: [Letter]
      - **What's Working**: 1-2 specific strengths
      - **Focus On**: 1-2 specific improvements

      Return JSON:
      {
        "grade": "A" | "B" | "C" | "D" | "F",
        "feedback": "Markdown string with grade and feedback",
        "referenceEdges": [
          { "start": [x1, y1], "end": [x2, y2], "type": "left" | "right" | "vertical" }
        ],
        "userEdges": [
          { "start": [x1, y1], "end": [x2, y2], "type": "left" | "right" | "vertical" }
        ]
      }

      COORDINATE RULES:
      - Normalize to [0-1000] range (0,0 = top-left, 1000,1000 = bottom-right)
      - Be EXACT - edges should connect at shared corners
      - ONLY include edges that are actually visible in the image (typically 9 edges for a cube viewed from an angle)
      - Do NOT include hidden/occluded edges
    `;

    const result = await model.generateContent([
      "Reference Image (3D Model):",
      { inlineData: { mimeType: 'image/png', data: refData } },
      "User's Drawing:",
      { inlineData: { mimeType: 'image/png', data: userData } },
      prompt
    ]);
    const response = await result.response;
    const text = response.text();

    try {
      const data = JSON.parse(text);
      return {
        grade: data.grade || 'C',
        feedback: data.feedback || '',
        referenceEdges: data.referenceEdges || [],
        userEdges: data.userEdges || []
      };
    } catch (e) {
      console.error("Failed to parse JSON:", text);
      return { grade: 'C', feedback: text, referenceEdges: [], userEdges: [] };
    }
  } catch (error) {
    console.error("Gemini Comparison Error:", error);
    return { grade: 'F', feedback: "Failed to compare images. Please try again.", referenceEdges: [], userEdges: [] };
  }
}

// Lesson style based on difficulty
const LESSON_STYLE: Record<Difficulty, { depth: string; exercise: string }> = {
  beginner: {
    depth: `Keep explanations simple and visual. Use analogies (e.g., "imagine train tracks meeting at the horizon"). Include "Why this matters" sections. Define all technical terms when first used.`,
    exercise: `Give a simple, confidence-building exercise. Include step-by-step instructions (1. Draw a horizontal line... 2. Mark a point...). Focus on one concept at a time.`
  },
  intermediate: {
    depth: `Balance theory with practical application. Reference underlying geometry briefly. Include tips for common pitfalls.`,
    exercise: `Give a moderately challenging exercise that combines 2-3 concepts. Provide guidelines but let them problem-solve some details.`
  },
  advanced: {
    depth: `Focus on theory, edge cases, and professional techniques. Discuss why certain rules exist geometrically. Include advanced considerations like station point distance and cone of vision.`,
    exercise: `Give a challenging exercise that tests mastery. Minimal hand-holding - describe the goal and let them figure out the approach. Include a "push yourself" variation.`
  }
};

/**
 * Generates a lesson content based on a topic.
 */
export const generateLesson = async (topic: string): Promise<string> => {
  try {
    const difficulty = getDifficulty();
    const lessonStyle = LESSON_STYLE[difficulty];

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `Create a short, interactive art lesson about: "${topic}" specifically in the context of drawing CUBES in perspective.

## Lesson Structure (use Markdown formatting):

### 1. Definition
What is ${topic}? ${difficulty === 'beginner' ? 'Explain like teaching a curious beginner.' : difficulty === 'advanced' ? 'Be concise - they know the basics.' : 'Clear and practical.'}

### 2. Key Rules
${difficulty === 'beginner' ? '3-4 simple rules with visual descriptions' : difficulty === 'advanced' ? '2-3 precise technical rules' : '3 practical rules'}

### 3. Common Mistakes
${difficulty === 'beginner' ? '2 common beginner mistakes with friendly explanations of why they happen' : difficulty === 'advanced' ? '2 subtle errors that even experienced artists make' : '2-3 typical mistakes to avoid'}

### 4. Practice Exercise
${lessonStyle.exercise}

---
Style guidance: ${lessonStyle.depth}

Use **bold headers**, bullet points, and keep it scannable. Total length: ${difficulty === 'beginner' ? '400-500 words' : difficulty === 'advanced' ? '250-350 words' : '300-400 words'}.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;

    return response.text();
  } catch (error) {
    console.error("Gemini Lesson Error:", error);
    return "Error generating lesson.";
  }
};
