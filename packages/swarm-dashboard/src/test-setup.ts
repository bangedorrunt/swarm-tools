/**
 * Test setup for Bun + Testing Library
 * 
 * Provides DOM environment using happy-dom
 */

import { Window } from "happy-dom";

// Create and register happy-dom window
const window = new Window({ url: "http://localhost:3000" });
const document = window.document;

// Set globals for testing-library
globalThis.window = window as any;
globalThis.document = document as any;
globalThis.navigator = window.navigator as any;
globalThis.HTMLElement = window.HTMLElement as any;
