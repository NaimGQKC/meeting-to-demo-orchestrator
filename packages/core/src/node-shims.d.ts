declare module "node:fs" {
  const fs: {
    mkdirSync(path: string, options?: { recursive?: boolean }): void;
    writeFileSync(path: string, data: string, encoding?: string): void;
    readFileSync(path: string, encoding: string): string;
    existsSync(path: string): boolean;
  };
  export default fs;
}

declare module "node:path" {
  const path: {
    join: (...parts: string[]) => string;
  };
  export default path;
}

declare module "node:crypto" {
  const crypto: {
    randomBytes: (size: number) => { toString: (encoding: string) => string };
  };
  export default crypto;
}
