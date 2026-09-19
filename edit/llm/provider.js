// Small registry so app.js and (from phase 5) review.js can go from a
// provider id string to its client without a switch statement.
import * as gemini from "./gemini.js";
import * as claude from "./claude.js";

export const PROVIDERS = {
  gemini: { id: "gemini", label: "Gemini", keyPlaceholder: "AIza…", defaultModel: "gemini-2.5-flash", ...gemini },
  claude: { id: "claude", label: "Claude", keyPlaceholder: "sk-ant-…", defaultModel: "claude-sonnet-5", ...claude },
};
