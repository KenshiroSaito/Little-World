import { useCallback, useEffect, useState } from "react";
import { loadImage } from "../state/images";

type Props = {
  ids?: readonly string[];
  className?: string;
  /** Offer to take a photo off the reflection. */
  onRemove?: (id: string) => void;
};

/** The photos kept with a reflection, each opening full size in a new tab. */
export default function ReflectionImages({ ids, className = "reflection-images", onRemove }: Props) {
  if (!ids?.length) return null;
  return (
    <div className={className}>
      {ids.map((id, i) =>
        onRemove ? (
          <span key={id} className="photo-preview">
            <StoredImage id={id} />
            <button type="button" className="btn-icon" onClick={() => onRemove(id)} aria-label={`Remove photo ${i + 1}`}>
              ×
            </button>
          </span>
        ) : (
          <StoredImage key={id} id={id} />
        ),
      )}
    </div>
  );
}

function StoredImage({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    let made: string | null = null;
    loadImage(id)
      .then((blob) => {
        if (!live) return;
        if (!blob) return setMissing(true);
        made = URL.createObjectURL(blob);
        setUrl(made);
      })
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);

  if (missing) return <span className="reflection-image-missing">Photo not on this device</span>;
  if (!url) return <span className="reflection-image-loading" aria-hidden="true" />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="A photo kept with this reflection" />
    </a>
  );
}

/** A photo picked for a reflection that is not saved yet. */
export function PhotoPreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  // The object URL lives exactly as long as the img it is shown in.
  const show = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img) return;
      const url = URL.createObjectURL(file);
      img.src = url;
      return () => URL.revokeObjectURL(url);
    },
    [file],
  );
  return (
    <span className="photo-preview">
      <img ref={show} alt={file.name} />
      <button type="button" className="btn-icon" onClick={onRemove} aria-label={`Remove ${file.name}`}>
        ×
      </button>
    </span>
  );
}
