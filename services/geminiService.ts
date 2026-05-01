
import { GoogleGenAI, Type } from "@google/genai";
import { ActivityLog } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// @fix: Refactored to use systemInstruction and Type-based responseSchema for robust payroll estimation
export async function getPayrollEstimation(logs: ActivityLog[]) {
  const logSummary = logs.map(l => `${l.time}: ${l.action}`).join('\n');
  
  const prompt = `Analyse ces logs d'activité pour une estimation de paie :\n\n${logSummary}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Complex reasoning task
      contents: prompt,
      config: {
        systemInstruction: "Vous êtes un expert en gestion de paie pour ambulances de transport sanitaire (convention collective 3085). Tâches : 1. Calcule une estimation des heures travaillées aujourd'hui. 2. Identifie les primes potentielles (Panier repas, prime de nuit). 3. Donne un message court sur l'état de la rémunération variable. Répondez au format JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            totalHours: { type: Type.STRING },
            estimatedBonus: { type: Type.STRING },
            message: { type: Type.STRING },
            breakdown: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["totalHours", "estimatedBonus", "message", "breakdown"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Réponse vide de l'IA");
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      totalHours: "Calcul en cours...",
      estimatedBonus: "0.00 €",
      message: "Commencez votre service pour voir l'estimation.",
      breakdown: []
    };
  }
}

// @fix: Refactored to use systemInstruction and responseSchema for structured daily insights
export async function getDailyInsights(logs: ActivityLog[], userName: string) {
  const logSummary = logs.map(l => `${l.time}: ${l.action}`).join('\n');
  
  const prompt = `Analyse l'activité de ${userName} aujourd'hui :\n${logSummary}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "En tant qu'assistant intelligent AmbuFlow, analysez l'activité de l'utilisateur. Répondez impérativement au format JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            stats: { type: Type.STRING },
            advice: { type: Type.STRING }
          },
          required: ["summary", "stats", "advice"]
        }
      }
    });
    
    const text = response.text;
    if (!text) throw new Error("Réponse vide de l'IA");
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return { summary: "N/A", stats: "N/A", advice: "N/A" };
  }
}