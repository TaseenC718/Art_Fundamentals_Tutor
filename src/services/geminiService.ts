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

// Critique style based on difficulty
const CRITIQUE_STYLE: Record<Difficulty, string> = {
  beginner: `Be encouraging and educational. Start by noting what they did well. Explain concepts simply - avoid jargon like "station point" without explanation. Give step-by-step guidance. Use phrases like "A helpful trick is..." or "Try this next time..."`,
  intermediate: `Balance praise with constructive criticism. Reference perspective principles (vanishing points, convergence) but briefly explain when needed. Be specific about what to fix and how.`,
  advanced: `Be concise and technical. Skip basic explanations - they know the theory. Focus on subtle errors: slight convergence drift, minor proportion issues, line quality. Challenge them to refine details. Direct and efficient.`
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

/**
 * Compares a user's drawing with a reference image.
 */
export const compareDrawings = async (referenceImage: string, userDrawing: string): Promise<{
  feedback: string,
  leftSet: { start: [number, number], end: [number, number] }[],
  rightSet: { start: [number, number], end: [number, number] }[],
  verticalSet: { start: [number, number], end: [number, number] }[]
}> => {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: { responseMimeType: "application/json" },
      systemInstruction: "You are a specialized Perspective Geometry Analyzer. Your job is to extract the key structural lines from a user's drawing of a cube and categorize them by their intended vanishing point."
    });

    const refData = referenceImage.split(',')[1] || referenceImage;
    const userData = userDrawing.split(',')[1] || userDrawing;

    const difficulty = getDifficulty();
    const feedbackStyle = FEEDBACK_INSTRUCTIONS[difficulty];

    const prompt = `
      Analyze the User's Drawing (Image 2) compared to the Reference (Image 1).

      ## Step 1: Extract Lines
      Identify the 12 edges of the drawn cube. Look for the dominant structural lines, ignoring light sketch marks.

      ## Step 2: Categorize Lines
      Group them into three sets based on their intended vanishing point:
      - **Left Set**: Lines converging to the Left VP (typically receding left)
      - **Right Set**: Lines converging to the Right VP (typically receding right)
      - **Vertical Set**: Vertical edges (should be parallel in 1pt/2pt perspective)

      ## Step 3: Score (0-100)
      Evaluate based on these criteria:
      - **Line Convergence (40 pts)**: Do parallel edges actually meet at their VP when extended? Check if left-set lines share a common intersection, same for right-set.
      - **Vertical Accuracy (20 pts)**: Are vertical lines truly vertical and parallel?
      - **Proportions (20 pts)**: Are cube faces roughly equal? Is the visible foreshortening believable?
      - **Line Confidence (20 pts)**: Are lines clean and decisive vs sketchy/uncertain?

      ## Step 4: Feedback
      ${feedbackStyle}

      Structure your feedback as:
      - **Score**: X/100
      - **What's Working**: 1-2 specific strengths (be genuine, not generic)
      - **Focus On**: 1-2 specific improvements with actionable tips

      Return JSON:
      {
        "feedback": "Markdown string following the structure above",
        "leftSet": [ { "start": [x1, y1], "end": [x2, y2] }, ... ],
        "rightSet": [ { "start": [x1, y1], "end": [x2, y2] }, ... ],
        "verticalSet": [ { "start": [x1, y1], "end": [x2, y2] }, ... ]
      }

      - Coordinates in range [0-1000] normalized to image dimensions.
      - Only include the dominant structural edges (typically 8-12 lines for a visible cube).
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
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse JSON:", text);
      return { feedback: text, leftSet: [], rightSet: [], verticalSet: [] };
    }
  } catch (error) {
    console.error("Gemini Comparison Error:", error);
    return { feedback: "Failed to compare images. Please try again.", leftSet: [], rightSet: [], verticalSet: [] };
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
