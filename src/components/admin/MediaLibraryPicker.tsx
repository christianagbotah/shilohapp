"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ImageIcon, Loader2, RefreshCcw, Search, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchJson } from "@/hooks/use-store-data";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type MediaItem = {
  path: string;
  name: string;
  folder: "Products" | "Website";
  bytes: number;
  updatedAt: string;
};

export function MediaLibraryPicker({
  open,
  onOpenChange,
  onSelect,
  token,
  title = "Choose an image",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (path: string) => void;
  token: string;
  title?: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState<"All" | "Products" | "Website">("All");
  const [selected, setSelected] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin-media-library", token],
    queryFn: () => fetchJson<{ items: MediaItem[] }>("/api/admin/upload", {
      headers: { "x-admin-token": token },
      cache: "no-store",
    }),
    enabled: open && !!token,
    staleTime: 0,
  });

  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.items ?? []).filter((item) =>
      (folder === "All" || item.folder === folder) &&
      (!query || item.name.toLowerCase().includes(query) || item.path.toLowerCase().includes(query))
    );
  }, [data, search, folder]);

  const selectedItem = data?.items.find((item) => item.path === selected);

  const choose = (path: string) => {
    onSelect(path);
    setSelected(null);
    onOpenChange(false);
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const result = await fetchJson<{ path: string }>("/api/admin/upload", {
        method: "POST",
        headers: { "x-admin-token": token },
        body,
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-media-library"] });
      toast({ title: "Image uploaded", description: "Saved to the website media library." });
      choose(result.path);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please select a valid image.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!uploading) onOpenChange(next); }}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-4 sm:px-6">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Reuse an image already on the website or upload a new one. Your selection will not remove or duplicate an existing file.
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
          <div className="relative min-w-[150px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search website images"
              placeholder="Search images..."
              className="h-10 rounded-xl pl-9"
            />
          </div>
          <select
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            aria-label="Filter media folder"
            value={folder}
            onChange={(event) => setFolder(event.target.value as "All" | "Products" | "Website")}
          >
            <option value="All">All folders</option>
            <option value="Products">Products</option>
            <option value="Website">Website</option>
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Refresh media library"
            disabled={isFetching}
            onClick={() => void refetch()}
            className="h-10 rounded-xl"
          >
            <RefreshCcw className={cn("h-4 w-4", isFetching && "animate-spin")} aria-hidden />
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            tabIndex={-1}
            aria-label="Upload a new website image"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="h-10 rounded-xl"
          >
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Upload className="mr-2 h-4 w-4" aria-hidden />}
            {uploading ? "Uploading..." : "Upload new"}
          </Button>
        </div>

        <div className="pretty-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {isLoading ? (
            <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading website images...
            </div>
          ) : isError ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-destructive">Could not load the media library.</p>
              <Button type="button" variant="outline" onClick={() => void refetch()}>Try again</Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
              <ImageIcon className="h-10 w-10 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                {data?.items.length ? "No images match your search." : "No website images yet. Use Upload new to add one."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" role="group" aria-label="Images available to select">
              {items.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  aria-pressed={selected === item.path}
                  onClick={() => setSelected(item.path)}
                  onDoubleClick={() => choose(item.path)}
                  className={cn(
                    "relative min-w-0 overflow-hidden rounded-xl border-2 bg-card text-left outline-offset-2 transition hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-gold",
                    selected === item.path ? "border-gold" : "border-border"
                  )}
                >
                  <span className="block aspect-[4/3] overflow-hidden bg-secondary">
                    {/* Files are same-origin, authenticated uploads or pre-existing static site assets. */}
                    <img src={item.path} alt="" loading="lazy" className="h-full w-full object-contain" />
                  </span>
                  {selected === item.path ? (
                    <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-gold text-primary" aria-hidden>
                      <Check className="h-4 w-4" />
                    </span>
                  ) : null}
                  <span className="block min-w-0 space-y-1 px-2 py-2">
                    <span className="block truncate text-xs font-semibold" title={item.name}>{item.name}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {item.folder} · {Math.max(1, Math.round(item.bytes / 1024)).toLocaleString("en-GH")} KB
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 sm:px-6">
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {selectedItem ? selectedItem.path : (data?.items.length ?? 0) + " images available"}
          </p>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={!selected || uploading} onClick={() => selected && choose(selected)}>
            Use selected image
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}