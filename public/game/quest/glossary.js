// 役所の言葉の用語集。
//
// 「券面記載事項変更」と言われても分からない、が課題そのものなので、
// 画面で言葉に印を付けて、意味を出せるようにする。
//
// 用語は新しく書かない。procedures.json にある
// officialName（役所の言い方）と displayName / what（画面の言い方）を組にするだけ。
/** 用語集を作る。長い言葉から先に並べる（文中を探すときに取りこぼさないため） */
export function buildGlossary(data) {
    const terms = new Map();
    for (const p of data.procedures) {
        const term = {
            word: p.officialName,
            plain: p.displayName,
            what: p.what,
            from: "procedure",
            procedureId: p.id,
        };
        add(terms, term);
        // 「個人番号カードの券面記載事項変更（継続利用手続き）」のように
        // かっこ付きで書いてあるものは、かっこ無しでも拾えるようにする
        for (const short of shorten(p.officialName))
            add(terms, { ...term, word: short });
        for (const item of p.bring) {
            const itemTerm = fromItem(item, p.id);
            add(terms, itemTerm);
            for (const short of shorten(item.label))
                add(terms, { ...itemTerm, word: short });
        }
    }
    return [...terms.values()].sort((a, b) => b.word.length - a.word.length);
}
function fromItem(item, procedureId) {
    return {
        word: item.label,
        // 持ち物は言い換えが無いので、注記をそのまま説明にする
        plain: item.note ?? item.label,
        what: item.note,
        from: "item",
        procedureId,
    };
}
/** かっこ書きを外した短い形。「学生証の写し（両面）」→「学生証の写し」 */
function shorten(word) {
    const out = new Set();
    const cut = word.replace(/（[^）]*）/g, "").trim();
    if (cut && cut !== word && cut.length >= 3)
        out.add(cut);
    return [...out];
}
function add(terms, term) {
    if (!term.word || terms.has(term.word))
        return;
    // 言い方が同じなら、用語集に入れる意味がない
    if (term.word === term.plain && !term.what)
        return;
    terms.set(term.word, term);
}
/**
 * 文を用語で分解する。画面はこの配列を並べるだけで、
 * 用語のところだけボタンにできる。
 */
export function markTerms(text, glossary) {
    const hits = [];
    const taken = new Array(text.length).fill(false);
    // 長い用語から探す（「転出証明書」より先に「個人番号カードの…」を取る）
    for (const term of glossary) {
        let from = 0;
        for (;;) {
            const at = text.indexOf(term.word, from);
            if (at === -1)
                break;
            const end = at + term.word.length;
            if (!taken.slice(at, end).some(Boolean)) {
                hits.push({ term, start: at, end });
                for (let i = at; i < end; i++)
                    taken[i] = true;
            }
            from = at + 1;
        }
    }
    hits.sort((a, b) => a.start - b.start);
    const out = [];
    let cursor = 0;
    for (const hit of hits) {
        if (hit.start > cursor)
            out.push(text.slice(cursor, hit.start));
        out.push(hit);
        cursor = hit.end;
    }
    if (cursor < text.length)
        out.push(text.slice(cursor));
    return out;
}
/** 用語を1つ引く。無ければ null */
export function lookup(word, glossary) {
    return glossary.find((t) => t.word === word) ?? null;
}
