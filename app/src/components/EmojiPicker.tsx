// Moki's own emoji picker for a marker's icon: emojis only (the system panel also offers GIFs and kaomoji), in groups,
// with a search by name in English and Portuguese. A click chooses; Esc or a click outside closes.
import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n';

// [emoji, words to find it by (English and Portuguese)]
const GROUPS: { name: string; items: [string, string][] }[] = [
  { name: 'Marks', items: [
    ['⭐', 'star important estrela importante'], ['🌟', 'glowing star brilho destaque'], ['🔍', 'search review magnifier lupa revisar'], ['🔎', 'search zoom lupa'],
    ['➕', 'plus add complete mais adicionar completar'], ['➖', 'minus remove menos remover'], ['⚠️', 'warning attention alerta atencao aviso'], ['✅', 'done check ok pronto feito'],
    ['☑️', 'checkbox checked marcado'], ['✔️', 'check certo'], ['❌', 'cross wrong no errado nao'], ['❎', 'cross mark negado'], ['❓', 'question doubt pergunta duvida'],
    ['❔', 'question white pergunta'], ['❗', 'exclamation important exclamacao'], ['‼️', 'double exclamation urgente'], ['⁉️', 'interrobang'], ['🚫', 'forbidden blocked proibido bloqueado'],
    ['⛔', 'no entry stop parar'], ['🛑', 'stop sign pare'], ['🔴', 'red circle vermelho'], ['🟠', 'orange circle laranja'], ['🟡', 'yellow circle amarelo'],
    ['🟢', 'green circle verde'], ['🔵', 'blue circle azul'], ['🟣', 'purple circle roxo'], ['⚫', 'black circle preto'], ['⚪', 'white circle branco'],
    ['🟥', 'red square vermelho'], ['🟧', 'orange square laranja'], ['🟨', 'yellow square amarelo'], ['🟩', 'green square verde'], ['🟦', 'blue square azul'], ['🟪', 'purple square roxo'],
    ['🔺', 'up triangle subir'], ['🔻', 'down triangle descer'], ['💯', 'hundred perfect cem perfeito'], ['🆕', 'new novo'], ['🆗', 'ok'], ['🆘', 'sos help socorro ajuda'],
  ] },
  { name: 'Work', items: [
    ['📌', 'pin pinned fixar alfinete'], ['📍', 'location pin local'], ['📎', 'clip attach anexo clipe'], ['🏷️', 'tag label etiqueta'], ['🔖', 'bookmark marcador'],
    ['📝', 'note memo nota anotacao'], ['✏️', 'pencil edit lapis editar'], ['🖊️', 'pen caneta'], ['📄', 'page document pagina documento'], ['📑', 'tabs abas'],
    ['📋', 'clipboard prancheta lista'], ['📊', 'chart graph grafico'], ['📈', 'up trend crescimento'], ['📉', 'down trend queda'], ['🗂️', 'folders pastas'],
    ['📁', 'folder pasta'], ['📅', 'calendar date calendario data'], ['⏰', 'alarm deadline prazo alarme'], ['⏳', 'hourglass waiting aguardando espera'], ['⌛', 'time tempo'],
    ['🚧', 'construction wip obra andamento'], ['🧪', 'test lab teste laboratorio'], ['🐞', 'bug defect defeito erro'], ['🐛', 'bug inseto'], ['🔧', 'fix wrench consertar'],
    ['🔨', 'hammer build martelo'], ['⚙️', 'settings gear configuracao'], ['🛠️', 'tools ferramentas'], ['🔒', 'lock locked bloqueado cadeado'], ['🔓', 'unlocked aberto'],
    ['🔑', 'key chave'], ['💡', 'idea light ideia lampada'], ['🎯', 'target goal alvo meta'], ['🚀', 'launch rocket lancar foguete'], ['📣', 'announce megafone anuncio'],
    ['💬', 'comment chat comentario'], ['🗨️', 'speech fala'], ['📢', 'loudspeaker alto falante'], ['🔗', 'link'], ['🧩', 'puzzle piece peca'], ['📦', 'package pacote entrega'],
    ['🗑️', 'trash delete lixo apagar'], ['♻️', 'recycle refactor reciclar'], ['🔁', 'repeat repetir'], ['🔄', 'refresh update atualizar'], ['🧭', 'compass direction direcao'],
  ] },
  { name: 'People', items: [
    ['👀', 'eyes look see olhos ver olhar'], ['👍', 'thumbs up like ok joinha'], ['👎', 'thumbs down dislike'], ['👏', 'clap palmas'], ['🙌', 'hands celebrate'],
    ['🙋', 'raise hand question levantar mao'], ['🤔', 'thinking pensar duvida'], ['😀', 'smile happy feliz sorriso'], ['😅', 'sweat ufa'], ['😬', 'grimace tenso'],
    ['😕', 'confused confuso'], ['😡', 'angry bravo'], ['🤯', 'mind blown explodiu'], ['😴', 'sleep sono'], ['🤝', 'handshake deal acordo'], ['🧠', 'brain cerebro'],
    ['❤️', 'heart love coracao'], ['🔥', 'fire hot urgent fogo quente urgente'], ['✨', 'sparkles new brilho'], ['🎉', 'party celebrate festa'], ['🏆', 'trophy win trofeu'],
  ] },
];

export function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const plain = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const found = useMemo(() => {
    const words = plain(query).split(/\s+/).filter(Boolean);
    if (!words.length) return null;
    return GROUPS.flatMap((g) => g.items).filter(([, names]) => words.every((w) => plain(names).includes(w)));
  }, [query]);
  useEffect(() => {
    const outside = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [onClose]);
  const grid = (items: [string, string][]) => <div className="emoji-grid">
    {items.map(([emoji, names]) => <button key={emoji} type="button" className="emoji-cell" title={names.split(' ')[0]} aria-label={names.split(' ')[0]} onClick={() => onPick(emoji)}>{emoji}</button>)}
  </div>;
  return <div ref={box} className="emoji-picker" role="dialog" aria-label={t('Choose an emoji')} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
    <input type="search" autoFocus className="emoji-search" value={query} placeholder={t('Search emoji')} aria-label={t('Search emoji')} onChange={(e) => setQuery(e.target.value)} />
    <div className="emoji-scroll">
      {found ? (found.length ? grid(found) : <p className="muted small">{t('No emoji found.')}</p>)
        : GROUPS.map((g) => <section key={g.name}><h4>{t(g.name)}</h4>{grid(g.items)}</section>)}
    </div>
  </div>;
}
