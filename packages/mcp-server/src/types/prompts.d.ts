declare module 'prompts' {
  interface PromptObject {
    type: string;
    name: string;
    message: string;
    initial?: unknown;
    validate?: (value: unknown) => boolean | string | Promise<boolean | string>;
  }
  function prompts<T extends string = string>(
    questions: PromptObject | PromptObject[],
    options?: {onCancel?: () => void},
  ): Promise<Record<T, unknown>>;
  export default prompts;
  export type {PromptObject};
}
