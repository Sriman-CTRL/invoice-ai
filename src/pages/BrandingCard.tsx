import { useRef, useState } from "react";
import { ImagePlus, Palette, Trash2 } from "lucide-react";
import { settingsApi } from "../api";
import { useToast } from "../toast";
import type { OrgSettings } from "../types";

const PRESETS = ["#4f46e5", "#2563eb", "#0d9488", "#059669", "#d97706", "#e11d48", "#7c3aed", "#0f172a"];

/** Shrinks a logo to at most 256px on its longest side, keeping transparency, and under the server's 150 KB cap. */
async function prepareLogo(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Please choose a PNG, JPEG or WebP image.");
  if (file.size > 8 * 1024 * 1024) throw new Error("That image is too large. Please choose one under 8 MB.");
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 256 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * scale));
  c.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Could not process the image.");
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  const bytes = (u: string) => (u.length - u.indexOf(",") - 1) * 0.75;
  const png = c.toDataURL("image/png");
  if (bytes(png) <= 140 * 1024) return png;
  // Fall back to JPEG on white if the PNG is too heavy.
  const j = document.createElement("canvas");
  j.width = c.width; j.height = c.height;
  const jc = j.getContext("2d")!;
  jc.fillStyle = "#fff"; jc.fillRect(0, 0, j.width, j.height); jc.drawImage(c, 0, 0);
  for (const q of [0.85, 0.7, 0.55]) { const u = j.toDataURL("image/jpeg", q); if (bytes(u) <= 140 * 1024) return u; }
  throw new Error("That logo is still too large. Try a simpler image.");
}

export function BrandingCard({ settings, onSaved }: { settings: OrgSettings; onSaved: () => void }) {
  const toast = useToast();
  const [color, setColor] = useState(settings.brand_color || "#4f46e5");
  const [logo, setLogo] = useState<string | null>(settings.logo_data || null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = color !== (settings.brand_color || "#4f46e5") || logo !== (settings.logo_data || null);

  const pick = async (file?: File) => {
    if (!file) return;
    try { setLogo(await prepareLogo(file)); } catch (e: any) { toast.error("Logo not added", e?.message); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await settingsApi.save({ brand_color: color, logo_data: logo });
      toast.success("Branding saved", "Your invoices, PDFs and client pay page now use it.");
      onSaved();
    } catch (e: any) {
      toast.error("Could not save", e?.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel mt-6 p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-600"><Palette className="h-4.5 w-4.5" /></span>
        <div>
          <h2 className="text-base font-bold text-slate-900">Your branding</h2>
          <p className="text-xs text-slate-500">Your logo and colour go on the client pay page, PDF invoices and emails.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold text-slate-700">Logo</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50">
                {logo ? <img src={logo} alt="Your logo" className="h-full w-full object-contain p-1" /> : <ImagePlus className="h-5 w-5 text-slate-300" />}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary h-9 px-3 text-xs" onClick={() => fileRef.current?.click()}>{logo ? "Change logo" : "Upload logo"}</button>
                {logo && <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50" onClick={() => setLogo(null)}><Trash2 className="h-3.5 w-3.5" /> Remove</button>}
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">PNG, JPG or WebP. It's shrunk automatically.</p>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-700">Brand colour</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => setColor(p)} aria-label={`Use ${p}`} className={`h-7 w-7 rounded-full border-2 transition ${color === p ? "scale-110 border-slate-900" : "border-white shadow ring-1 ring-slate-200"}`} style={{ background: p }} />
              ))}
              <label className="ml-1 inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0" /> Custom
              </label>
            </div>
          </div>

          <button type="button" className="btn-primary h-10 px-5 text-sm" disabled={!dirty || saving} onClick={save}>{saving ? "Saving..." : "Save branding"}</button>
        </div>

        {/* Live preview */}
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">What your client sees</p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-sm">
            <div className="h-1" style={{ background: color }} />
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              {logo ? <img src={logo} alt="" className="h-9 w-9 rounded-xl bg-white object-contain p-0.5" /> : <span className="grid h-9 w-9 place-items-center rounded-xl text-sm font-black text-white" style={{ background: color }}>P</span>}
              <div><p className="text-sm font-extrabold text-white">Your business</p><p className="font-mono text-[10px] text-slate-400">Invoice INV-1042</p></div>
            </div>
            <div className="space-y-2 p-4">
              <div className="h-2 w-2/3 rounded bg-white/10" />
              <div className="h-2 w-1/2 rounded bg-white/10" />
              <div className="flex items-center justify-between pt-3"><span className="text-xs text-slate-400">Total due</span><span className="font-mono text-lg font-black text-white">₹45,000.00</span></div>
              <div className="mt-2 rounded-xl py-2.5 text-center text-xs font-bold text-white" style={{ background: color }}>Pay with UPI</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
