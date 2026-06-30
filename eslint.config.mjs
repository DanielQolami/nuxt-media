// @ts-check
import { createConfigForNuxt } from "@nuxt/eslint-config/flat";

// Run `npx @eslint/config-inspector` to inspect the resolved config interactively
export default createConfigForNuxt({
  features: {
    // Rules for module authors
    tooling: true,
    // Rules for formatting
    stylistic: true,
  },
  dirs: {
    src: ["./playground"],
  },
}).append(
  // your custom flat config here...
  [
    {
      rules: {
        // Enforce trailing commas when an object, array, or function spans multiple lines
        // (Helps with cleaner Git diffs).
        "@stylistic/comma-dangle": ["error", "always-multiline"], // or 'always'

        // Enforce the use of double quotes ("") instead of single quotes ('') or backticks (unless templating)
        "@stylistic/quotes": ["error", "double"],

        // Requires a semicolon (;) at the end of every statement.
        "@stylistic/semi": ["error", "always"],

        // Enforce "stroustrup" brace style.
        // The opening brace stays on the same line, but `else` or `catch` starts on a new line.
        // `allowSingleLine: true` permits keeping short blocks on one line: `if (foo) { bar(); }`
        "@stylistic/brace-style": [
          "error",
          "stroustrup",
          { allowSingleLine: true },
        ],

        // When a statement spans multiple lines, operators (like `?`) goes to the next line
        // Default to "before" for most operators, but override "=" to "after"
        "@stylistic/operator-linebreak": [
          "error",
          "before",
          { overrides: { "=": "after" } },
        ],

        "@stylistic/member-delimiter-style": [
          "error",
          {
            multiline: {
              delimiter: "semi",
              requireLast: true,
            },
            singleline: {
              delimiter: "semi",
              requireLast: false,
            },
            multilineDetection: "brackets",
          },
        ],

        "@stylistic/arrow-parens": ["error", "always"],

        // --------------------------------------------------------
        // Vue Specific Rules
        // --------------------------------------------------------

        // Same logic as the stylistic rule, but applies specifically inside
        // Vue `<template>` tags (e.g., inside object syntax for v-bind or classes).
        "vue/comma-dangle": ["error", "always-multiline"],

        // Enforces using `<script setup>` for Vue components.
        // Throws an error if you try to use the older Options API or the standard `setup()` function.
        "vue/component-api-style": ["error", ["script-setup"]],

        // Forces all `<script>` blocks in your Vue components to use TypeScript.
        // Throws an error if you omit `lang="ts"`.
        "vue/block-lang": [
          "error",
          {
            script: {
              lang: "ts",
            },
          },
        ],

        // Enforces the use of the full `v-slot` syntax in templates.
        // Throws an error if you try to use the shorthand `#` (e.g., `#header` becomes `v-slot:header`).
        "vue/v-slot-style": ["error", "longform"],

        "vue/max-attributes-per-line": [
          "warn",
          {
            singleline: {
              max: 3,
            },
            multiline: {
              max: 1,
            },
          },
        ],
      },
    },
  ],
);
