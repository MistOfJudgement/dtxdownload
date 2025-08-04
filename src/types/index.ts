export interface IDtxChart {
  title: string;
  artist: string;
  bpm: string;
  difficulties: number[];
  dlURL: string;
  imgURL?: string;
}

export interface IDownloadLink {
  getDownloadURL(): Promise<string>;
  download(path: string): Promise<void>;
}

export interface IDatabaseFilter {
  (song: IDtxChart): boolean;
}

export interface IDownloadProgress {
  current: number;
  total: number;
  title: string;
  status: 'downloading' | 'completed' | 'failed';
}
