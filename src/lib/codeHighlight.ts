// Syntax highlighting utilities for TermiChat code snippets
// Uses highlight.js with a subset of common languages

import hljs from "highlight.js/lib/core";

// Import only common languages to keep bundle size small
import python from "highlight.js/lib/languages/python";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import java from "highlight.js/lib/languages/java";
import c from "highlight.js/lib/languages/c";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";

// Register each language with highlight.js
hljs.registerLanguage("python", python);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("java", java);
hljs.registerLanguage("c", c);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);

// Takes raw code string → returns highlighted HTML string
// highlightAuto detects the language automatically from the code content
export function highlightCode(code: string): string {
  return hljs.highlightAuto(code).value;
}
