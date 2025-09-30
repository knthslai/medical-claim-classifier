/**
 * Categories for classifying medical claim denial issues
 */
export enum Category {
  ELIGIBILITY = "Eligibility",
  CODING_ERROR = "Coding Error",
  PRIOR_AUTHORIZATION = "Prior Authorization",
  INCORRECT_PATIENT_INFO = "Incorrect Patient Info",
  PAYER_SPECIFIC_RULE = "Payer Specific Rule",
  OTHER = "Other",
}

/**
 * Input structure for a single medical claim denial
 */
export interface ClaimInput {
  id: string;
  denial_note: string;
}

/**
 * Extracted structured fields from the denial note
 */
export interface ExtractedFields {
  payer?: string;
  cpt_codes?: string[];
  suggested_action?: string;
}

/**
 * Output structure after LLM processing
 */
export interface ClaimOutput extends ClaimInput {
  categories: Category[];
  extracted_fields: ExtractedFields;
  error?: string;
}

/**
 * Configuration for the LLM client
 */
export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/**
 * Response structure from OpenRouter API
 */
export interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Structure for LLM processing results
 */
export interface LLMResult {
  categories: Category[];
  extracted_fields: {
    payer?: string;
    cpt_codes?: string[];
    suggested_action?: string;
  };
}
