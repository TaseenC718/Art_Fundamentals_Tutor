import { GoogleGenerativeAI, Content, Part } from "@google/generative-ai";

// Initialize the client
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const MODEL_NAME = 'gemini-3-flash-preview';

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
      systemInstruction: "You are a Perspective Expert. You analyze drawings of cubes and geometric shapes for mathematical and visual accuracy. You are strict about parallel vertical lines (in 1 and 2 point perspective) and convergence."
    });

    const base64Data = imageBase64.split(',')[1] || imageBase64;

    const prompt = userQuestion
      ? `Critique this perspective drawing. Focus on: ${userQuestion}. Analyze vanishing points, parallel lines, convergence, and cube proportions.`
      : "Critique this perspective drawing of cubes. Check if lines converge correctly to vanishing points. Check for distortion (e.g., 'fish-eye' effect or forced perspective). Give 3 actionable tips to improve the 3D solidity of the form.";

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
export const compareDrawings = async (referenceImage: string, userDrawing: string): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: "You are a strict art teacher checking a student's observational drawing exercise. You value precision in copying the angle and perspective of the reference object."
    });

    const refData = referenceImage.split(',')[1] || referenceImage;
    const userData = userDrawing.split(',')[1] || userDrawing;

    const prompt = `
      Compare the User's Drawing (Image 2) with the Reference Cube (Image 1). 
      1. **Perspective Accuracy**: Do the angles in the drawing match the reference?
      2. **Proportions**: Is the cube too thin, tall, or wide compared to the reference?
      3. **Line Quality**: Are the lines straight and confident?
      
      Give a score out of 100% for Accuracy. 
      Provide 3 specific corrections to help the user match the reference better next time.
    `;

    const result = await model.generateContent([
      "Reference Image (3D Model):",
      { inlineData: { mimeType: 'image/png', data: refData } },
      "User's Drawing:",
      { inlineData: { mimeType: 'image/png', data: userData } },
      prompt
    ]);
    const response = await result.response;

    return response.text();
  } catch (error) {
    console.error("Gemini Comparison Error:", error);
    return "Failed to compare images. Please try again.";
  }
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
    2. Key Rules (e.g., relationship to the Horizon Line).
    3. Common Mistakes (e.g., expanding rear planes).
    4. A Short "Cube Sketch" Exercise (e.g., Draw a cube floating above the horizon).
    Use Markdown formatting with bold headers and bullet points.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;

    return response.text();
  } catch (error) {
    console.error("Gemini Lesson Error:", error);
    return "Error generating lesson.";
  }
};

