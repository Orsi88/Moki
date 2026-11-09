// Rendered Markdown, with diagram blocks drawn after the escaped HTML is in place.
import { useEffect, useRef, type MouseEvent } from 'react';
import { dressCodeEmbeds } from '../code-embed';
import { replaceDiagram, type DiagramLang } from '../diagram-source';
import { mountDiagrams } from './Diagrams';
import { linkProjectPaths, type LinkResolver } from './useInternalLinks';

interface Props {
  html: string;
  className?: string;
  text?: string;
  onChange?: (text: string) => void;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  resolveLink?: LinkResolver;
}

export function MarkdownBody({ html, className, text, onChange, onClick, resolveLink }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef({ text, onChange });
  latest.current = { text, onChange };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancel = false;
    el.innerHTML = html;
    linkProjectPaths(el, resolveLink);
    dressCodeEmbeds(el, false);
    const save = latest.current.onChange
      ? (index: number, lang: DiagramLang, body: string) => {
        const current = latest.current;
        if (cancel || current.text === undefined || !current.onChange) return;
        current.onChange(replaceDiagram(current.text, index, lang, body));
      }
      : undefined;
    void mountDiagrams(el, save);
    return () => { cancel = true; };
  }, [html, resolveLink]);

  return <div ref={ref} className={className} onClick={onClick} />;
}
