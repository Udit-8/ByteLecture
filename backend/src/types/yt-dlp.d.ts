declare module 'yt-dlp-wrap' {
  interface VideoInfo {
    id: string;
    title: string;
    description?: string;
    uploader?: string;
    channel?: string;
    duration?: number;
    thumbnail?: string;
    upload_date?: string;
    view_count?: number;
    tags?: string[];
    [key: string]: any;
  }

  export default class YTDlpWrap {
    constructor(binaryPath?: string);
    
    getVideoInfo(url: string): Promise<VideoInfo>;
    
    exec(args: string[]): Promise<void>;
    
    getVersion(): Promise<string>;
  }
} 