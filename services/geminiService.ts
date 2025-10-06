import { GoogleGenAI, Type } from "@google/genai";
import type { Lead, HistoryEvent, PersistentLead, PowerHourProgress, PowerHourGoal, SuccessInsight } from '../types';

// This is a placeholder for the actual API key, which should be handled by the execution environment.
const API_KEY = process.env.API_KEY || '';
if (!API_KEY) {
    console.warn("API_KEY for Gemini is not set. AI features will not work.");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

const model = 'gemini-2.5-flash';

export async function scoreLead(lead: Lead): Promise<{ score: number, justification: string }> {
    if (!API_KEY) throw new Error("API key not configured.");
    
    const prompt = `
        Analise o seguinte lead de vendas e forneça uma pontuação de 1 a 100, onde 100 é o mais promissor. 
        Forneça também uma justificativa curta (10-15 palavras) para a pontuação.
        Considere o nome, a informação original e as notas do histórico.
        
        Informações do Lead:
        - Nome: ${lead.name}
        - Informação Original: ${lead.original}
        - Nota Atual: ${lead.note || 'Nenhuma'}
        - Histórico: ${lead.history.slice(0, 5).map(h => h.details).join('; ')}
    `;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    score: { type: Type.NUMBER, description: 'A pontuação do lead de 1 a 100.' },
                    justification: { type: Type.STRING, description: 'Uma breve justificativa para a pontuação.' }
                },
                required: ['score', 'justification']
            }
        }
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
}

export async function generateCallScript(lead: Lead, insights?: SuccessInsight | null): Promise<string> {
    if (!API_KEY) throw new Error("API key not configured.");

    let prompt = `
        Crie um roteiro de abertura de chamada curto e amigável para um vendedor contatar um lead potencial.
        O roteiro deve ser casual e direto.

        Nome do Lead: ${lead.name}
        Detalhes do Lead: ${lead.original}
    `;

    if (insights && insights.winningPhrases.length > 0) {
        prompt += `\n\n**Padrão de Sucesso do Vendedor:** Baseie o roteiro no estilo de comunicação que já se provou eficaz para este vendedor. Incorpore frases-chave que ele costuma usar, como: "${insights.winningPhrases.join('", "')}".`;
    }

    prompt += `\n\nApenas a resposta do vendedor, sem introduções como "Aqui está o roteiro:".`;

    const response = await ai.models.generateContent({
        model,
        contents: prompt
    });
    
    return response.text.trim();
}

export async function summarizeNotes(history: HistoryEvent[], currentNote: string): Promise<string> {
    if (!API_KEY) throw new Error("API key not configured.");

    const fullHistory = [
        ...history.map(h => `${new Date(h.timestamp).toLocaleString()}: ${h.details}`),
        `Nota atual: ${currentNote}`
    ].join('\n');

    const prompt = `
        Resuma o seguinte histórico de interações com um cliente em um único parágrafo conciso (2-3 frases).
        Capture os pontos principais e o estado atual da negociação.

        Histórico:
        ${fullHistory}
    `;

    const response = await ai.models.generateContent({
        model,
        contents: prompt
    });

    return response.text.trim();
}


export async function suggestTagsForLead(original: string): Promise<string[]> {
    if (!API_KEY) return [];

    const prompt = `
        Analise o seguinte texto de um lead: "${original}".
        Extraia entidades relevantes como nomes de empresas, cargos, cidades ou tecnologias.
        Retorne as entidades como tags. Use letras minúsculas e hífen para espaços (ex: "gerente-vendas", "acme-corp", "sao-paulo").
        Se nenhuma entidade relevante for encontrada, retorne um array vazio.
    `;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    tags: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                },
                required: ['tags']
            }
        }
    });

    try {
        const jsonText = response.text.trim();
        const parsed = JSON.parse(jsonText);
        return parsed.tags || [];
    } catch (e) {
        console.error("Failed to parse tags from AI response:", e);
        return [];
    }
}

export async function generateFollowUpMessage(lead: Lead | PersistentLead, objective: string, insights?: SuccessInsight | null): Promise<string> {
    if (!API_KEY) throw new Error("API key not configured.");

    const context = lead.historySummary || lead.note || 'Nenhum contexto adicional.';

    let prompt = `
        Você é um assistente de vendas. Escreva uma mensagem de follow-up curta e profissional para ser enviada por WhatsApp ou e-mail.
        
        **Lead:** ${lead.name}
        **Objetivo da Mensagem:** ${objective}
        **Contexto da última interação:** ${context}
    `;
    
    if (insights && insights.winningPhrases.length > 0) {
        prompt += `\n\n**Estilo do Vendedor:** Incorpore o tom e frases-chave que este vendedor costuma usar com sucesso, como: "${insights.winningPhrases.join('", "')}".`;
    }

    prompt += `\n\nA mensagem deve ser amigável, direta e personalizada com base no contexto. Retorne apenas o texto da mensagem, sem nenhuma introdução.`;


    const response = await ai.models.generateContent({
        model,
        contents: prompt
    });

    return response.text.trim();
}

export async function recycleLeads(leads: Lead[]): Promise<string[]> {
    if (!API_KEY) throw new Error("API key not configured.");

    const leadsForAnalysis = leads.map(l => ({
        id: l.id,
        result: l.result,
        attempts: l.attempts.filter(Boolean).length,
        lastUpdatedAt: l.lastUpdatedAt
    }));

    const prompt = `
        Você é um assistente de vendas inteligente. Sua tarefa é reciclar uma lista de leads.
        Analise a lista de leads JSON a seguir.
        1.  Filtre e remova permanentemente quaisquer leads com um resultado de 'refused' (recusado).
        2.  Para os leads restantes, calcule uma "pontuação de reengajamento" de 1 a 100.
        3.  Priorize leads com base nos seguintes critérios, em ordem de importância:
            a.  Leads que nunca foram contatados com sucesso (ex: apenas voicemails).
            b.  Leads cujo último contato foi há mais tempo (lastUpdatedAt mais antigo).
            c.  Leads com menos tentativas de chamada.
        4.  Retorne um JSON com um único array chamado "sortedIds", contendo os IDs dos leads que devem ser recontactados, ordenados da pontuação de reengajamento mais alta para a mais baixa.

        Leads:
        ${JSON.stringify(leadsForAnalysis)}
    `;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    sortedIds: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                },
                required: ['sortedIds']
            }
        }
    });

    try {
        const jsonText = response.text.trim();
        const parsed = JSON.parse(jsonText);
        return parsed.sortedIds || [];
    } catch (e) {
        console.error("Failed to parse recycled leads from AI response:", e);
        return [];
    }
}

// --- Power Hour AI Functions ---

export async function getLiveCallFeedback(transcript: string): Promise<string> {
    if (!API_KEY) return "Análise indisponível (API Key não configurada).";
    if (!transcript.trim()) return "Nenhuma fala detectada para análise.";

    const prompt = `
        Você é um coach de vendas. Analise a seguinte transcrição da fala de um vendedor durante uma chamada.
        Forneça um feedback curto (1-2 frases), construtivo e acionável.
        Foque em um ponto positivo e uma área para melhoria.
        Seja encorajador.

        Transcrição do vendedor:
        "${transcript}"
    `;

    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text.trim();
}

export async function getMotivationalMessage(progress: PowerHourProgress, goals: PowerHourGoal, timeLeft: number): Promise<string> {
    if (!API_KEY) return "Continue focado!";

    const prompt = `
        Você é um coach de vendas motivacional. Crie uma mensagem curta (1-2 frases) para um vendedor durante uma sessão de "Power Hour".

        Situação atual:
        - Tempo restante: ${timeLeft} minutos.
        - Progresso de chamadas: ${progress.calls} de ${goals.calls}.
        - Progresso de resultados positivos: ${progress.positives} de ${goals.positives}.

        A mensagem deve ser energética e apropriada para o momento.
    `;
    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text.trim();
}

export async function decideOnRequeue(lead: Lead): Promise<{ requeue: boolean, reason: string }> {
     if (!API_KEY) return { requeue: false, reason: "" };

    const prompt = `
        Um vendedor marcou o seguinte lead como 'voicemail' durante uma sessão de Power Hour.
        Com base no potencial do lead (aiScore), decida se ele deve ser reinserido no final da fila para uma nova tentativa ainda nesta sessão.
        Leads com aiScore > 70 têm alta probabilidade de re-fila.

        - Lead aiScore: ${lead.aiScore || 50}

        Responda em formato JSON.
    `;

     const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    requeue: { type: Type.BOOLEAN },
                    reason: { type: Type.STRING }
                },
                required: ['requeue', 'reason']
            }
        }
    });

    try {
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (e) {
        return { requeue: false, reason: "" };
    }
}

export async function analyzeSuccessPatterns(successfulLeads: Lead[]): Promise<SuccessInsight> {
    if (!API_KEY) throw new Error("API key not configured.");
    if (successfulLeads.length === 0) {
        return {
            winningPhrases: [],
            effectiveFollowups: [],
            topLeadProfiles: [],
            strategicSummary: "Nenhum dado de sucesso para analisar ainda. Continue finalizando leads com status positivo!"
        };
    }

    const analysisData = successfulLeads.map(l => ({
        id: l.id,
        note: l.note,
        tags: l.tags,
        audioTranscripts: l.audioNotes.map(an => an.transcript).filter(Boolean),
        history: l.history.slice(0, 10).map(h => h.details).join(' | ')
    }));

    const prompt = `
        Você é um analista de vendas sênior. Analise os seguintes dados de leads que foram convertidos com sucesso.
        Seu objetivo é extrair os padrões de sucesso do vendedor.

        Dados dos Leads de Sucesso:
        ${JSON.stringify(analysisData, null, 2)}

        Sua tarefa é identificar:
        1.  **winningPhrases**: Frases ou perguntas comuns e impactantes que o vendedor usou nas transcrições de áudio e notas que parecem levar ao sucesso. Extraia 3 a 5 frases literais.
        2.  **effectiveFollowups**: Descreva 1 ou 2 padrões de follow-up que parecem funcionar bem (ex: "Enviar proposta imediatamente após a chamada", "Follow-up de voicemail enviado 1 hora depois").
        3.  **topLeadProfiles**: Descreva 1 ou 2 perfis de leads que convertem melhor, com base nas tags e notas (ex: "Leads com a tag 'tecnologia'", "Gerentes da empresa Acme Corp").
        4.  **strategicSummary**: Escreva um resumo estratégico de uma frase sobre por que a abordagem do vendedor está funcionando.

        Retorne a resposta estritamente no formato JSON.
    `;
    
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    winningPhrases: { type: Type.ARRAY, items: { type: Type.STRING } },
                    effectiveFollowups: { type: Type.ARRAY, items: { type: Type.STRING } },
                    topLeadProfiles: { type: Type.ARRAY, items: { type: Type.STRING } },
                    strategicSummary: { type: Type.STRING }
                },
                required: ['winningPhrases', 'effectiveFollowups', 'topLeadProfiles', 'strategicSummary']
            }
        }
    });

    try {
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (e) {
        console.error("Failed to parse success patterns from AI response:", e);
        throw new Error("Não foi possível analisar os padrões de sucesso.");
    }
}