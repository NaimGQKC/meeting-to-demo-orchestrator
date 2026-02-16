declare module "node:path" {
  const path: {
    join: (...parts: string[]) => string;
  };
  export default path;
}

declare const process: {
  env: Record<string, string | undefined>;
  cwd: () => string;
  exit: (code?: number) => never;
};
