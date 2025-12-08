/**
 * OpenCode Plugin Entry Point
 *
 * This file ONLY exports the plugin function.
 * The plugin loader iterates over all exports and calls them as functions,
 * so we cannot export anything else here (classes, constants, types, etc.)
 */
import { SwarmPlugin } from "./index";

// Only export the plugin function - nothing else!
export { SwarmPlugin };
