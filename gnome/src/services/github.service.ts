import { GITHUB_REPO } from '../constants.js';
import { FileService } from './file.service.js';

export class GithubService {
  private static _instance: GithubService;
  private readonly _fileService: FileService;
  private readonly _baseUrl: string;

  private constructor() {
    this._fileService = FileService.getInstance();
    this._baseUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/main`;
  }

  public static getInstance(): GithubService {
    if (!GithubService._instance) {
      GithubService._instance = new GithubService();
    }
    return GithubService._instance;
  }

  private getFileUrl(fileName: string): string {
    return `${this._baseUrl}/${fileName}`;
  }

  public async downloadFile(
    fileName: string,
    destPath: string,
    overwrite = false,
  ): Promise<boolean> {
    if (!overwrite && this._fileService.isRegularFile(destPath)) {
      console.log(`[AI] File already exists: ${destPath}`);
      return true;
    }

    const url = this.getFileUrl(fileName);
    console.log(`[AI] Downloading ${fileName} from ${url}`);

    return this._fileService.downloadToFile(url, destPath);
  }

  public async downloadToAppDir(fileName: string, overwrite = false): Promise<boolean> {
    const destPath = this._fileService.buildPath(fileName);
    return this.downloadFile(fileName, destPath, overwrite);
  }
}
