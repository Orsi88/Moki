// The mark of an item brought in from a project's settings ("Bring to this project"): a small upload icon by its
// name in the workspace's settings, saying from which project it came. The record is scripts/lib/uploads.ts.

import { useEffect, useState } from 'react';
import { api } from '../api';
import { t } from '../i18n';
import { IconUpload } from './Icons';

type Uploads = Record<string, { project: string; projectName: string; at: string }>;

export function useUploads(): Uploads {
  const [uploads, setUploads] = useState<Uploads>({});
  useEffect(() => { api.uploads().then(setUploads).catch(() => setUploads({})); }, []);
  return uploads;
}

export function BroughtMark({ uploads, kind, name }: { uploads: Uploads; kind: 'skill' | 'agent' | 'activity'; name: string }) {
  const record = uploads[`${kind}:${name}`];
  if (!record) return null;
  const text = t('Brought from {project}', { project: record.projectName });
  return <span className="brought-mark" title={text} aria-label={text} role="img"><IconUpload size={13} /></span>;
}
