// Small, non-expanding OOXML reader. Source offsets let editors change one part without serializing the rest.
export interface XmlNode { name: string; attrs: Record<string, string>; start: number; openEnd: number; closeStart: number; end: number; children: XmlNode[] }
export const localName = (name: string): string => name.split(':').pop() ?? name;
export const xmlEscape = (value: string): string => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const xmlDecode = (value: string): string => value.replace(/&#x([\da-f]+);|&#(\d+);|&(lt|gt|quot|apos|amp);/gi, (whole, hex: string, dec: string, named: string) => {
  if (named) return ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' } as Record<string, string>)[named.toLowerCase()] ?? whole;
  const code = parseInt(hex || dec, hex ? 16 : 10);
  return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
});
export const attribute = (node: XmlNode | undefined, name: string): string => node ? node.attrs[name] ?? Object.entries(node.attrs).find(([key]) => localName(key) === name)?.[1] ?? '' : '';
export const child = (node: XmlNode | undefined, name: string): XmlNode | undefined => node?.children.find((n) => localName(n.name) === name);
export function descendants(node: XmlNode | undefined, name: string): XmlNode[] {
  return node?.children.flatMap((n) => [...(localName(n.name) === name ? [n] : []), ...descendants(n, name)]) ?? [];
}
export function parseXml(xml: string): XmlNode {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Document type declarations are not supported.');
  const root: XmlNode = { name: '', attrs: {}, start: 0, openEnd: 0, closeStart: xml.length, end: xml.length, children: [] };
  const stack = [root];
  let count = 0;
  for (const match of xml.matchAll(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<(?:[^>"']|"[^"]*"|'[^']*')*>/g)) {
    const token = match[0], at = match.index;
    if (/^<\?|^<!/.test(token)) continue;
    const name = token.match(/^<\/?([^\s/>]+)/)?.[1] ?? '';
    if (token.startsWith('</')) {
      const current = stack.pop();
      if (!current || current === root || current.name !== name) throw new Error('Invalid document XML.');
      current.closeStart = at; current.end = at + token.length;
    } else {
      if (++count > 250_000 || stack.length > 160) throw new Error('Document XML is too complex.');
      const attrs = Object.fromEntries([...token.matchAll(/([^\s=<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((m) => [m[1], xmlDecode(m[2] ?? m[3])]));
      const node: XmlNode = { name, attrs, start: at, openEnd: at + token.length, closeStart: at + token.length, end: at + token.length, children: [] };
      stack[stack.length - 1].children.push(node);
      if (!token.endsWith('/>')) stack.push(node);
    }
  }
  if (stack.length !== 1) throw new Error('Incomplete document XML.');
  return root;
}
export const nodeText = (xml: string, node: XmlNode): string => xmlDecode(xml.slice(node.openEnd, node.closeStart).replace(/<[^>]*>/g, ''));
export function appendXmlChild(xml: string, node: XmlNode, content: string): string {
  const opening = xml.slice(node.start, node.openEnd);
  return opening.endsWith('/>')
    ? patchXml(xml, [{ start: node.start, end: node.end, text: opening.slice(0, -2) + '>' + content + `</${node.name}>` }])
    : patchXml(xml, [{ start: node.closeStart, end: node.closeStart, text: content }]);
}
export interface XmlPatch { start: number; end: number; text: string }
export function patchXml(xml: string, patches: XmlPatch[]): string {
  let end = xml.length;
  for (const patch of [...patches].sort((a, b) => b.start - a.start || b.end - a.end)) {
    if (patch.start < 0 || patch.end > end || patch.end < patch.start) throw new Error('Overlapping document edits.');
    xml = xml.slice(0, patch.start) + patch.text + xml.slice(patch.end); end = patch.start;
  }
  return xml;
}
export function setXmlAttribute(tag: string, name: string, value: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\s${escaped}\\s*=\\s*(?:"[^"]*"|'[^']*')`);
  const attr = ` ${name}="${xmlEscape(value)}"`;
  return pattern.test(tag) ? tag.replace(pattern, attr) : tag.replace(/\s*\/?>(?=$)/, (end) => attr + end);
}
