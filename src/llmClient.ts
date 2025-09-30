import axios from "axios";
import {
  Category,
  ClaimInput,
  ClaimOutput,
  LLMConfig,
  LLMResult,
} from "./types.js";

/**
 * Default configuration for OpenRouter API
 */
const DEFAULT_CONFIG: Omit<LLMConfig, "apiKey"> = {
  baseUrl: "https://openrouter.ai/api/v1",
  model: "anthropic/claude-3.5-sonnet",
};

/**
 * System prompt for the LLM to understand its role and output format
 */
const SYSTEM_PROMPT = `You are a medical billing expert. Your task is to classify claim denial notes into structured JSON. Always respond with valid JSON only, no explanations or extra text.`;

/**
 * Creates a user prompt for a specific denial note
 */
function createUserPrompt(denialNote: string): string {
  return `Classify the following medical claim denial note.

Denial Note:
"${denialNote}"

Return a JSON object with this structure:
{
  "categories": [ "one or more from: Eligibility, Coding Error, Prior Authorization, Incorrect Patient Info, Payer Specific Rule, Other" ],
  "extracted_fields": {
    "payer": "string or null",
    "cpt_codes": ["list of codes if any, else []"],
    "suggested_action": "short plain English suggestion"
  }
}
`;
}

/**
 * Validates and parses LLM response into structured format
 */
function parseLLMResponse(response: string): LLMResult {
  try {
    const responseJSON = JSON.parse(response);

    if (
      !responseJSON.categories ||
      !Array.isArray(responseJSON.categories) ||
      responseJSON.categories.some((v: any) => typeof v !== "string")
    )
      throw new Error("Incorrect categories format in LLM Response");

    if (
      responseJSON.categories.some(
        (category: any) => !Object.values(Category).includes(category)
      )
    )
      throw new Error("Invalid category values in LLM Response");

    if (
      !responseJSON.extracted_fields ||
      !["payer", "cpt_codes", "suggested_action"].every((field) =>
        Object.hasOwn(responseJSON.extracted_fields, field)
      )
    )
      throw new Error("Incorrect extracted_fields format in LLM Response");

    if (
      !Array.isArray(responseJSON.extracted_fields.cpt_codes) ||
      responseJSON.extracted_fields.cpt_codes.some(
        (code: any) => typeof code !== "string"
      )
    )
      throw new Error("Incorrect cpt_codes in LLM Response");

    return responseJSON;
  } catch (error) {
    throw error;
  }
}

/**
 * OpenRouter LLM client class
 */
export class LLMClient {
  private config: LLMConfig;

  constructor(apiKey: string, customConfig?: Partial<LLMConfig>) {
    this.config = {
      apiKey,
      ...DEFAULT_CONFIG,
      ...customConfig,
    };
  }

  /**
   * Calls OpenRouter API with retry logic
   */
  private async callAPI(
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    try {
      const endpoint = this.config.baseUrl + "/chat/completions";

      const headers = {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Medical Claim Issue Classifier",
      };

      const data = {
        model: this.config.model,
        messages,
        temperature: 0.2,
        max_tokens: 512,
      };

      let lastError: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await axios.post(endpoint, data, {
            headers,
            timeout: 30000,
          });
          if (
            response &&
            response.data &&
            response.data.choices &&
            response.data.choices[0] &&
            response.data.choices[0].message &&
            typeof response.data.choices[0].message.content === "string"
          ) {
            return response.data.choices[0].message.content;
          } else {
            throw new Error("Malformed response from OpenRouter API");
          }
        } catch (error: any) {
          lastError = error;
          if (attempt < 3) {
            // Exponential backoff: 500ms, 1000ms
            await new Promise((res) =>
              setTimeout(res, 500 * Math.pow(2, attempt - 1))
            );
          }
        }
      }
      throw new Error(
        `OpenRouter API call failed after 3 attempts: ${
          lastError?.message || lastError
        }`
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Classifies a medical claim denial and extracts structured fields
   */
  async classifyDenial(claim: ClaimInput): Promise<ClaimOutput> {
    try {
      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: createUserPrompt(claim.denial_note) },
      ];

      const llmResponse = await this.callAPI(messages);

      const parsed = parseLLMResponse(llmResponse);

      return {
        ...claim,
        categories: parsed.categories,
        extracted_fields: parsed.extracted_fields,
      };
    } catch (error: any) {
      throw new Error(
        `Failed to classify claim denial (id: ${claim.id}): ${
          error.message || error
        }`
      );
    }
  }
}

/**
 * Creates an LLM client instance with API key from environment or parameter
 */
export function createLLMClient(apiKey?: string): LLMClient {
  try {
    const key = apiKey || process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("No API key provided");

    return new LLMClient(key);
  } catch (error) {
    throw error;
  }
}
