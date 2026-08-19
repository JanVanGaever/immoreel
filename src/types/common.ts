export type ID = string;

export type Timestamps = {
  createdAt: string;
  updatedAt: string;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type AsyncState = "idle" | "loading" | "success" | "error";
