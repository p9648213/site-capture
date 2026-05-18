export type AdminStatus = "INCOMPLETE" | "COMPLETED";

export type AdminPictureType = {
  id: number;
  categoryId: number;
  name: string;
  isFulfilled: boolean;
  updatedAt: string;
};

export type AdminCategory = {
  id: number;
  siteId: number;
  name: string;
  status: AdminStatus;
  updatedAt: string;
  pictureTypes: AdminPictureType[];
};

export type AdminSite = {
  id: number;
  name: string;
  address: string;
  status: AdminStatus;
  updatedAt: string;
  categories: AdminCategory[];
};
