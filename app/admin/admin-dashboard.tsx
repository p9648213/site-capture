"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Download,
  Pencil,
  FolderPlus,
  ImagePlus,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { AdminCategory, AdminSite } from "@/lib/admin/types";

type Props = {
  initialSites: AdminSite[];
};

type FormState = {
  error: string | null;
  isSubmitting: boolean;
};

const emptyFormState: FormState = {
  error: null,
  isSubmitting: false,
};

function statusVariant(status: AdminSite["status"]) {
  return status === "COMPLETED" ? "completed" : "incomplete";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getSiteProgress(site: AdminSite) {
  const pictureTypes = site.categories.flatMap((category) => category.pictureTypes);
  const total = pictureTypes.length;
  const fulfilled = pictureTypes.filter((pictureType) => pictureType.isFulfilled).length;
  const percent = total === 0 ? 0 : Math.round((fulfilled / total) * 100);

  return { fulfilled, total, percent };
}

async function postJson(path: string, body: unknown) {
  return requestJson(path, "POST", body);
}

async function requestJson(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error("Request failed");
  }
}

export function AdminDashboard({ initialSites }: Props) {
  const router = useRouter();
  const [siteForm, setSiteForm] = useState(emptyFormState);
  const [categoryForm, setCategoryForm] = useState(emptyFormState);
  const [pictureTypeForm, setPictureTypeForm] = useState(emptyFormState);
  const [selectedSiteId, setSelectedSiteId] = useState(initialSites[0]?.id.toString() ?? "");
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    initialSites[0]?.categories[0]?.id.toString() ?? "",
  );

  const selectedSite = useMemo(
    () => initialSites.find((site) => site.id.toString() === selectedSiteId) ?? initialSites[0],
    [initialSites, selectedSiteId],
  );
  const categoriesForSelectedSite = selectedSite?.categories ?? [];
  const allCategories = initialSites.flatMap((site) => site.categories);
  const overview = useMemo(
    () => ({
      sites: initialSites.length,
      completedSites: initialSites.filter((site) => site.status === "COMPLETED").length,
      categories: allCategories.length,
      pictureTypes: allCategories.reduce(
        (total, category) => total + category.pictureTypes.length,
        0,
      ),
    }),
    [allCategories, initialSites],
  );

  async function submitSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSiteForm({ error: null, isSubmitting: true });

    try {
      await postJson("/api/sites", {
        name: form.get("name"),
        address: form.get("address"),
      });
      formElement.reset();
      router.refresh();
    } catch {
      setSiteForm({ error: "Site could not be created.", isSubmitting: false });
      return;
    }

    setSiteForm(emptyFormState);
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const siteId = Number(form.get("siteId"));
    setCategoryForm({ error: null, isSubmitting: true });

    try {
      await postJson("/api/categories", {
        siteId,
        name: form.get("name"),
      });
      formElement.reset();
      setSelectedSiteId(siteId.toString());
      router.refresh();
    } catch {
      setCategoryForm({ error: "Category could not be created.", isSubmitting: false });
      return;
    }

    setCategoryForm(emptyFormState);
  }

  async function submitPictureType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const categoryId = Number(form.get("categoryId"));
    setPictureTypeForm({ error: null, isSubmitting: true });

    try {
      await postJson("/api/picture-types", {
        categoryId,
        name: form.get("name"),
      });
      formElement.reset();
      setSelectedCategoryId(categoryId.toString());
      router.refresh();
    } catch {
      setPictureTypeForm({ error: "Picture type could not be created.", isSubmitting: false });
      return;
    }

    setPictureTypeForm(emptyFormState);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">SiteCapture Admin</h1>
            <p className="mt-1 text-sm text-slate-600">Build inspection sites and monitor completion.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.refresh()}>
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="ghost" onClick={logout}>
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Sites" value={overview.sites} icon={<ClipboardList className="h-4 w-4" />} />
          <Metric label="Completed" value={overview.completedSites} icon={<CheckCircle2 className="h-4 w-4" />} />
          <Metric label="Categories" value={overview.categories} icon={<FolderPlus className="h-4 w-4" />} />
          <Metric label="Picture types" value={overview.pictureTypes} icon={<ImagePlus className="h-4 w-4" />} />
        </section>

        <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Create site</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={submitSite}>
                  <Field label="Site name" name="name" placeholder="North Tower" />
                  <Field label="Address" name="address" placeholder="1200 Ridge Road" />
                  {siteForm.error ? <p className="text-sm text-red-600">{siteForm.error}</p> : null}
                  <Button type="submit" disabled={siteForm.isSubmitting}>
                    <Plus aria-hidden="true" className="h-4 w-4" />
                    Add site
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Add category</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={submitCategory}>
                  <div className="space-y-2">
                    <Label htmlFor="category-site">Site</Label>
                    <Select
                      id="category-site"
                      name="siteId"
                      value={selectedSiteId}
                      onChange={(event) => {
                        const nextSite = initialSites.find(
                          (site) => site.id.toString() === event.target.value,
                        );
                        setSelectedSiteId(event.target.value);
                        setSelectedCategoryId(nextSite?.categories[0]?.id.toString() ?? "");
                      }}
                      required
                    >
                      <option value="" disabled>
                        Select a site
                      </option>
                      {initialSites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Field label="Category name" name="name" placeholder="Indoor Pictures" />
                  {categoryForm.error ? <p className="text-sm text-red-600">{categoryForm.error}</p> : null}
                  <Button type="submit" disabled={categoryForm.isSubmitting || initialSites.length === 0}>
                    <FolderPlus aria-hidden="true" className="h-4 w-4" />
                    Add category
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Add picture type</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={submitPictureType}>
                  <div className="space-y-2">
                    <Label htmlFor="picture-category">Category</Label>
                    <Select
                      id="picture-category"
                      name="categoryId"
                      value={selectedCategoryId}
                      onChange={(event) => setSelectedCategoryId(event.target.value)}
                      required
                    >
                      <option value="" disabled>
                        Select a category
                      </option>
                      {categoriesForSelectedSite.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Field label="Picture type" name="name" placeholder="Tower-1" />
                  {pictureTypeForm.error ? (
                    <p className="text-sm text-red-600">{pictureTypeForm.error}</p>
                  ) : null}
                  <Button type="submit" disabled={pictureTypeForm.isSubmitting || allCategories.length === 0}>
                    <ImagePlus aria-hidden="true" className="h-4 w-4" />
                    Add picture type
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Site Overview</h2>
              <Badge>{initialSites.length} total</Badge>
            </div>
            {initialSites.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-600">
                No sites have been created yet.
              </div>
            ) : (
              <div className="grid gap-4">
                {initialSites.map((site) => (
                  <SiteOverview key={site.id} site={site} />
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-sm">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} placeholder={placeholder} required />
    </div>
  );
}

function SiteOverview({ site }: { site: AdminSite }) {
  const router = useRouter();
  const progress = getSiteProgress(site);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(site.name);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  async function saveName() {
    setIsSaving(true);
    setError(null);

    try {
      await requestJson(`/api/sites/${site.id}`, "PATCH", { name });
      setIsEditing(false);
      router.refresh();
    } catch {
      setError("Site name could not be updated.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteSite() {
    setError(null);

    try {
      await requestJson(`/api/sites/${site.id}`, "DELETE");
      setIsDeleteDialogOpen(false);
      router.refresh();
    } catch {
      setError("Site could not be deleted.");
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {isEditing ? (
                <Input
                  className="h-9 max-w-xs"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              ) : (
                <h3 className="text-lg font-semibold">{site.name}</h3>
              )}
              {isEditing ? (
                <>
                  <Button
                    size="icon"
                    title="Save site name"
                    onClick={saveName}
                    disabled={isSaving || name.trim().length === 0}
                  >
                    <Save aria-hidden="true" className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    title="Cancel edit"
                    variant="ghost"
                    onClick={() => {
                      setName(site.name);
                      setIsEditing(false);
                      setError(null);
                    }}
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button size="icon" title="Edit site name" variant="outline" onClick={() => setIsEditing(true)}>
                  <Pencil aria-hidden="true" className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="icon"
                title="Delete site"
                variant="destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </Button>
              <Badge variant={statusVariant(site.status)}>{site.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-600">{site.address}</p>
            <p className="mt-1 text-xs text-slate-500">Updated {formatDate(site.updatedAt)}</p>
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          </div>
          <div className="min-w-36 text-sm text-slate-700">
            {progress.fulfilled}/{progress.total} required photos
            <div className="mt-2 h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-emerald-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <Button
              className="mt-3 w-full"
              size="sm"
              variant="outline"
              onClick={() => {
                window.location.href = `/api/export/excel/site/${site.id}`;
              }}
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
        <div className="grid gap-3">
          {site.categories.length === 0 ? (
            <p className="text-sm text-slate-500">No categories yet.</p>
          ) : (
            site.categories.map((category) => <CategoryOverview key={category.id} category={category} />)
          )}
        </div>
      </CardContent>
      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        title="Delete site"
        message={`Delete "${site.name}" and all of its categories, picture types, and photos?`}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={deleteSite}
      />
    </Card>
  );
}

function CategoryOverview({ category }: { category: AdminCategory }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  async function saveName() {
    setIsSaving(true);
    setError(null);

    try {
      await requestJson(`/api/categories/${category.id}`, "PATCH", { name });
      setIsEditing(false);
      router.refresh();
    } catch {
      setError("Category name could not be updated.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteCategory() {
    setError(null);

    try {
      await requestJson(`/api/categories/${category.id}`, "DELETE");
      setIsDeleteDialogOpen(false);
      router.refresh();
    } catch {
      setError("Category could not be deleted.");
    }
  }

  return (
    <div className="rounded-md border border-slate-200 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {isEditing ? (
            <Input
              className="h-9 max-w-xs"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          ) : (
            <div className="font-medium">{category.name}</div>
          )}
          {isEditing ? (
            <>
              <Button
                size="icon"
                title="Save category name"
                onClick={saveName}
                disabled={isSaving || name.trim().length === 0}
              >
                <Save aria-hidden="true" className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                title="Cancel edit"
                variant="ghost"
                onClick={() => {
                  setName(category.name);
                  setIsEditing(false);
                  setError(null);
                }}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              size="icon"
              title="Edit category name"
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              <Pencil aria-hidden="true" className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="icon"
            title="Delete category"
            variant="destructive"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
        <Badge variant={statusVariant(category.status)}>{category.status}</Badge>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {category.pictureTypes.length === 0 ? (
          <span className="text-sm text-slate-500">No picture types.</span>
        ) : (
          category.pictureTypes.map((pictureType) => (
            <Badge key={pictureType.id} variant={pictureType.isFulfilled ? "completed" : "default"}>
              {pictureType.name}
            </Badge>
          ))
        )}
      </div>
      <PictureTypeManager category={category} />
      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        title="Delete category"
        message={`Delete "${category.name}" and all of its picture types and photos?`}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={deleteCategory}
      />
    </div>
  );
}

function PictureTypeManager({
  category,
}: {
  category: AdminCategory;
}) {
  const router = useRouter();
  const [selectedPictureTypeId, setSelectedPictureTypeId] = useState(
    category.pictureTypes[0]?.id.toString() ?? "",
  );
  const selectedPictureType =
    category.pictureTypes.find((pictureType) => pictureType.id.toString() === selectedPictureTypeId) ??
    category.pictureTypes[0];
  const [name, setName] = useState(selectedPictureType?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (!selectedPictureType) {
      setSelectedPictureTypeId("");
      setName("");
      return;
    }

    if (selectedPictureType.id.toString() !== selectedPictureTypeId) {
      setSelectedPictureTypeId(selectedPictureType.id.toString());
    }

    setName(selectedPictureType.name);
  }, [selectedPictureType, selectedPictureTypeId]);

  function selectPictureType(id: string) {
    const pictureType = category.pictureTypes.find((item) => item.id.toString() === id);
    setSelectedPictureTypeId(id);
    setName(pictureType?.name ?? "");
    setError(null);
  }

  async function saveName() {
    if (!selectedPictureType) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await requestJson(`/api/picture-types/${selectedPictureType.id}`, "PATCH", { name });
      router.refresh();
    } catch {
      setError("Picture type name could not be updated.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePictureType() {
    if (!selectedPictureType) {
      return;
    }

    setError(null);

    try {
      await requestJson(`/api/picture-types/${selectedPictureType.id}`, "DELETE");
      setIsDeleteDialogOpen(false);
      router.refresh();
    } catch {
      setError("Picture type could not be deleted.");
    }
  }

  if (category.pictureTypes.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
        <Select
          aria-label="Select picture type"
          value={selectedPictureTypeId}
          onChange={(event) => selectPictureType(event.target.value)}
        >
          {category.pictureTypes.map((pictureType) => (
            <option key={pictureType.id} value={pictureType.id}>
              {pictureType.name}
            </option>
          ))}
        </Select>
        <Input
          aria-label="Picture type name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button title="Save picture type name" onClick={saveName} disabled={isSaving || name.trim().length === 0}>
          <Save aria-hidden="true" className="h-4 w-4" />
          Save
        </Button>
        <Button
          title="Delete picture type"
          variant="destructive"
          onClick={() => setIsDeleteDialogOpen(true)}
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
          Delete
        </Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        title="Delete picture type"
        message={`Delete "${selectedPictureType?.name ?? "this picture type"}" and its photos?`}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={deletePictureType}
      />
    </div>
  );
}

function ConfirmDeleteDialog({
  open,
  title,
  message,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
