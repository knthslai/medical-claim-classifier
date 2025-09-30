import { resolve, dirname } from "node:path";
import { ClaimInput, ClaimOutput } from "./types.js";
import {
  access,
  constants,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";

/**
 * Validates that an object has the required ClaimInput structure
 */
function isValidClaimInput(obj: any): obj is ClaimInput {
  if (typeof obj !== "object") throw new Error("Claim is not an object");

  if (
    ["id", "denial_note"].some(
      (field) => !Object.hasOwn(obj, field) || !obj[field].trim()
    )
  )
    throw new Error("Claim is not formatted correctly: " + JSON.stringify(obj));

  return true;
}

/**
 * Reads and validates claims from a JSON file
 * @param filePath Path to the input JSON file
 * @returns Promise that resolves to an array of validated ClaimInput objects
 * @throws Error if file cannot be read or contains invalid data
 */
export async function readClaims(filePath: string): Promise<ClaimInput[]> {
  try {
    await access(filePath, constants.R_OK | constants.W_OK);

    const content = await readFile(filePath, { encoding: "utf-8" });

    const parsedContent = JSON.parse(content);

    if (!Array.isArray(parsedContent))
      throw new Error("Invalid content format");

    parsedContent.forEach(isValidClaimInput);

    return parsedContent;
  } catch (error) {
    throw error;
  }
}

/**
 * Writes enriched claims to a JSON file
 * @param filePath Path to the output JSON file
 * @param claims Array of enriched ClaimOutput objects
 * @throws Error if file cannot be written
 */
export async function writeClaims(
  filePath: string,
  claims: ClaimOutput[]
): Promise<void> {
  try {
    // Create the parent directory if it doesn't exist
    await mkdir(dirname(filePath), { recursive: true });

    const claimsString = JSON.stringify(claims, null, 2);

    await writeFile(filePath, claimsString);
  } catch (error) {
    throw error;
  }
}

/**
 * Validates file paths and ensures they have .json extension
 * @param filePath Path to validate
 * @param fileType Description of file type for error messages
 * @returns Normalized absolute path
 * @throws Error if path is invalid
 */
export function validateFilePath(filePath: string, fileType: string): string {
  try {
    if (!filePath) throw new Error("No file path provided");

    if (!filePath.endsWith(".json"))
      throw new Error("File does not end with .json");

    return resolve(filePath);
  } catch (error) {
    throw error;
  }
}
