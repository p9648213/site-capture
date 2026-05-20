export type CompletionStatus = "INCOMPLETE" | "COMPLETED";

export type PictureType = {
  id: number;
  categoryId: number;
  name: string;
  isFulfilled: boolean;
  lastSyncedAt: string | null;
};

export type Category = {
  id: number;
  siteId: number;
  name: string;
  status: CompletionStatus;
  lastSyncedAt: string | null;
};

export type Site = {
  id: number;
  name: string;
  siteId: string;
  status: CompletionStatus;
  lastSyncedAt: string | null;
};

export type SiteWithCategories = Site & {
  categories: Array<
    Category & {
      pictureTypes: PictureType[];
    }
  >;
};

export type SyncResponse = {
  syncedAt: string;
  sites: Array<{
    id: number;
    name: string;
    siteId: string;
    status: CompletionStatus;
    updatedAt: string;
    categories: Array<{
      id: number;
      name: string;
      status: CompletionStatus;
      updatedAt: string;
      pictureTypes: Array<{
        id: number;
        name: string;
        isFulfilled: boolean;
        updatedAt: string;
      }>;
    }>;
  }>;
};
