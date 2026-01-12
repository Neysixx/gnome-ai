import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { APP_NAME } from '../constants.js';

export class FileService {
  private static _instance: FileService;
  private readonly _appDir: string;

  private constructor() {
    this._appDir = GLib.build_filenamev([GLib.get_user_data_dir(), APP_NAME]);
  }

  public static getInstance(): FileService {
    if (!FileService._instance) {
      FileService._instance = new FileService();
    }
    return FileService._instance;
  }

  public get appDir(): string {
    return this._appDir;
  }

  public buildPath(...parts: string[]): string {
    return GLib.build_filenamev([this._appDir, ...parts]);
  }

  public fileExists(path: string): boolean {
    return GLib.file_test(path, GLib.FileTest.EXISTS);
  }

  public isRegularFile(path: string): boolean {
    return GLib.file_test(path, GLib.FileTest.IS_REGULAR);
  }

  public ensureAppDirExists(): void {
    if (!this.fileExists(this._appDir)) {
      GLib.mkdir_with_parents(this._appDir, 0o755);
      console.log(`[AI] Created app directory: ${this._appDir}`);
    }
  }

  public copyFile(sourcePath: string, destPath: string): boolean {
    try {
      const sourceFile = Gio.File.new_for_path(sourcePath);
      const destFile = Gio.File.new_for_path(destPath);
      sourceFile.copy(destFile, Gio.FileCopyFlags.NONE, null, null);
      console.log(`[AI] Copied ${sourcePath} to ${destPath}`);
      return true;
    } catch (e) {
      console.error(`[AI] Failed to copy file: ${e}`);
      return false;
    }
  }

  public readTextFile(path: string): string | null {
    try {
      const [ok, contents] = GLib.file_get_contents(path);
      if (!ok || !contents) return null;
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(contents as AllowSharedBufferSource);
    } catch (e) {
      console.error(`[AI] Failed to read file: ${e}`);
      return null;
    }
  }

  public writeTextFile(path: string, content: string): boolean {
    try {
      const file = Gio.File.new_for_path(path);
      const outputStream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
      if (!outputStream) return false;

      const encoder = new TextEncoder();
      const bytes = encoder.encode(content);
      outputStream.write_all(bytes, null);
      outputStream.close(null);
      console.log(`[AI] Written file: ${path}`);
      return true;
    } catch (e) {
      console.error(`[AI] Failed to write file: ${e}`);
      return false;
    }
  }

  public async downloadToFile(url: string, destPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const downloadFile = Gio.File.new_for_uri(url);
        const destFile = Gio.File.new_for_path(destPath);

        downloadFile.read_async(0, null, (sourceFile, readRes) => {
          try {
            if (!sourceFile) {
              console.error(`[AI] Failed to download from ${url}`);
              resolve(false);
              return;
            }

            const inputStream = sourceFile.read_finish(readRes);
            if (!inputStream) {
              console.error(`[AI] Failed to read stream from ${url}`);
              resolve(false);
              return;
            }

            const outputStream = destFile.replace(null, false, Gio.FileCreateFlags.NONE, null);
            if (!outputStream) {
              console.error(`[AI] Failed to create file ${destPath}`);
              resolve(false);
              return;
            }

            outputStream.splice_async(
              inputStream,
              Gio.OutputStreamSpliceFlags.CLOSE_SOURCE | Gio.OutputStreamSpliceFlags.CLOSE_TARGET,
              0,
              null,
              (stream, spliceRes) => {
                try {
                  if (stream) {
                    stream.splice_finish(spliceRes);
                    console.log(`[AI] Downloaded ${url} to ${destPath}`);
                    resolve(true);
                  } else {
                    resolve(false);
                  }
                } catch (e) {
                  console.error(`[AI] Failed to download: ${e}`);
                  resolve(false);
                }
              },
            );
          } catch (e) {
            console.error(`[AI] Failed to read download URL: ${e}`);
            resolve(false);
          }
        });
      } catch (e) {
        console.error(`[AI] Failed to initiate download: ${e}`);
        resolve(false);
      }
    });
  }
}
