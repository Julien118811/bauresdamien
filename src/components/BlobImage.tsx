/** Affiche une image stockée dans IndexedDB à partir de sa clé de blob. */

import { useEffect, useState } from 'react';
import { getBlobUrl } from '../lib/db';

export function BlobImage({
  blobId,
  alt,
  className,
  style,
}: {
  blobId: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    let alive = true;
    getBlobUrl(blobId).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [blobId]);

  if (!url) return <div className={className} style={{ ...style, background: 'var(--surface-2)' }} />;
  return <img src={url} alt={alt ?? ''} className={className} style={style} />;
}
