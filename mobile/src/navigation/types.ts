export type RootStackParamList = {
  SelectSite: undefined;
  SiteDetail: { siteId: number };
  CategoryDetail: { siteId: number; categoryId: number };
  Camera: {
    siteId: number;
    categoryId: number;
    pictureTypeId: number;
    siteName: string;
    pictureTypeName: string;
  };
};
