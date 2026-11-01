import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = [{ ignores: ["history-civ/**"] }, ...compat.extends("next/core-web-vitals", "next/typescript")];

export default eslintConfig;
