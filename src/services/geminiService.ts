import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface CommonGroundResult {
  topics: string[];
  explanation: string;
}

/**
 * Analyzes a list of debate arguments to find common grounds between differing viewpoints.
 */
export async function analyzeCommonGround(argumentsText: string): Promise<CommonGroundResult> {
  const prompt = `
    Analyze the following debate arguments from participants with different political leanings (Right, Left, etc.).
    Identify clear "Common Ground" or shared concerns where these opposing viewpoints actually agree or express similar values.
    Return the result in JSON format.
    
    Arguments:
    ${argumentsText}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topics: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of common ground topics identified."
            },
            explanation: {
              type: Type.STRING,
              description: "A brief summary explaining why these are common grounds."
            }
          },
          required: ["topics", "explanation"]
        }
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error) {
    console.error("Common Ground analysis failed:", error);
    return { topics: [], explanation: "לא ניתן היה לנתח מכנה משותף כרגע." };
  }
}
