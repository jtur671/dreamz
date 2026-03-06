export type Platform = 'pinterest' | 'reddit' | 'facebook' | 'tiktok';
export type QueueStatus = 'pending' | 'posted' | 'failed';

export interface QueueItem {
  id: string;
  platform: Platform;
  status: QueueStatus;
  content: PostContent;
  scheduledFor: string; // ISO datetime
  postedAt?: string;
  error?: string;
  retries: number;
}

export interface PostContent {
  title?: string;       // reddit title, pin title
  text: string;         // caption / body
  imagePath?: string;   // local path to generated image
  videoPath?: string;   // local path to video (tiktok)
  link?: string;        // app store or landing page URL
  hashtags?: string[];
  // platform-specific
  subreddit?: string;
  boardId?: string;
  flair?: string;
}

export interface PlatformPoster {
  name: Platform;
  enabled: boolean;
  post(item: QueueItem): Promise<{ success: boolean; url?: string; error?: string }>;
}

export interface GeneratedContent {
  platform: Platform;
  content: PostContent;
  scheduledFor?: string;
}
