import fs from 'fs';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const acquireLock = async (filePath: string, timeoutMs: number = 5000): Promise<() => void> => {
  const lockFile = `${filePath}.lock`;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      // wx flag means write exclusively; fails if file already exists.
      // This guarantees atomic operation at the OS level.
      fs.writeFileSync(lockFile, process.pid.toString(), { flag: 'wx' });
      
      // Return a function to release the lock
      return () => {
        try {
          fs.unlinkSync(lockFile);
        } catch {
          // ignore
        }
      };
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'EEXIST') {
        // Lock file exists, wait and retry
        await sleep(50);
      } else {
        throw e;
      }
    }
  }
  
  throw new Error(`Timeout waiting for file lock on: ${filePath}`);
};
