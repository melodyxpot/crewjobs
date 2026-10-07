import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import eslintConfigPrettier from "eslint-config-prettier"
import reactHooks from "eslint-plugin-react-hooks"
import tseslint from "typescript-eslint"

const webFiles = ["apps/web/**/*.{js,jsx,mjs,ts,tsx}"]
const tsFiles = ["apps/api/**/*.ts", "apps/extension/**/*.ts", "packages/shared/**/*.ts"]

function withoutGlobalIgnores(configs) {
  return configs.filter((config) => {
    const keys = Object.keys(config).filter((key) => key !== "name")
    return !(keys.length === 1 && keys[0] === "ignores")
  })
}

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/out/**",
      "**/build/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/next-env.d.ts",
      "pnpm-lock.yaml",
    ],
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: tsFiles,
  })),
  ...withoutGlobalIgnores(nextVitals).map((config) => ({
    ...config,
    files: webFiles,
  })),
  ...withoutGlobalIgnores(nextTs).map((config) => ({
    ...config,
    files: ["apps/web/**/*.ts", "apps/web/**/*.tsx"],
  })),
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        require: "readonly",
        module: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
        exports: "writable",
      },
    },
  },
  {
    files: webFiles,
    plugins: {
      "react-hooks": reactHooks,
    },
    settings: {
      next: {
        rootDir: "apps/web/",
      },
    },
    rules: {
      // These rules target React Compiler. This app does not use the compiler.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/incompatible-library": "off",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
    },
  },
  eslintConfigPrettier,
)
