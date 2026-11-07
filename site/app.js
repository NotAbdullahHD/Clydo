/* shared behaviour: dock shadow on scroll, copy buttons, the reply ticker, command search. */

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* dock gets a firmer surface once the page moves under it */
const onScroll = () => document.body.classList.toggle('scrolled', window.scrollY > 12);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* copy: any [data-copy] element copies its value and says so */
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-copy]');
  if (!button) return;

  try {
    await navigator.clipboard.writeText(button.dataset.copy);
  } catch {
    return;
  }

  button.classList.add('done');

  const label = button.querySelector('.copy-label');
  if (label) label.textContent = 'copied';

  clearTimeout(button.dataset.timer);
  button.dataset.timer = setTimeout(() => {
    button.classList.remove('done');
    if (label) label.textContent = button.dataset.original ?? 'copy';
  }, 1400);
});

/* the hero card types real replies from the bot */
const ticker = document.querySelector('.ticker-line');

if (ticker) {
  const replies = [
    { text: '@you: deposited 🟡 500 into your bank.' },
    { text: '@you: you only have 🟡 3 on you.' },
    { text: '@you: withdrew 🟡 1.9K from your bank.' },
    { text: '@you: your bank is empty.' },
  ];

  const caret = document.createElement('span');
  caret.className = 'caret';
  ticker.textContent = '';
  ticker.append(caret);

  let index = 0;

  const write = (text, position = 0) => {
    ticker.firstChild.nodeValue = text.slice(0, position);

    if (position < text.length) {
      setTimeout(() => write(text, position + 1), 26);
      return;
    }

    setTimeout(() => erase(text), 2100);
  };

  const erase = (text) => {
    let position = text.length;

    const step = () => {
      position -= 2;
      ticker.firstChild.nodeValue = text.slice(0, Math.max(0, position));

      if (position > 0) {
        setTimeout(step, 14);
        return;
      }

      index = (index + 1) % replies.length;
      setTimeout(() => write(replies[index].text), 260);
    };

    step();
  };

  ticker.append(document.createTextNode(''));

  if (reduce) {
    ticker.firstChild.nodeValue = replies[0].text;
  } else {
    setTimeout(() => write(replies[0].text), 500);
  }
}

/* commands page */
const deck = document.querySelector('.deck');

if (deck && Array.isArray(window.COMMANDS)) {
  const search = document.querySelector('#search');
  const picker = document.querySelector('#category');
  const meta = document.querySelector('#shown');
  const empty = document.querySelector('.empty');
  const emptyTerm = document.querySelector('#empty-term');

  const escape = (value) => String(value).replace(/[&<>"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[character]));

  const card = (command, index) => `
    <article class="cmd" style="--i:${index}">
      <div class="cmd-head">
        <span class="cmd-cat">${escape(command.category)}</span>
        <button class="copy" data-copy=",${escape(command.name)}" aria-label="copy ,${escape(command.name)}" title="copy ,${escape(command.name)}">
          <svg class="i-copy" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>
          <svg class="i-done" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
        </button>
      </div>
      <h3><i>,</i>${escape(command.name)}</h3>
      <code class="cmd-use">${escape(command.usage)}</code>
      <p class="cmd-about">${escape(command.about || 'no description yet.')}</p>
      ${command.aliases.length ? `<p class="cmd-alias">${command.aliases.map((alias) => `<code>,${escape(alias)}</code>`).join('')}</p>` : ''}
    </article>`;

  let category = 'all';
  let query = '';

  const render = () => {
    const term = query.trim().toLowerCase();

    const rows = window.COMMANDS.filter((command) => {
      if (category !== 'all' && command.category !== category) return false;
      if (!term) return true;

      return [command.name, command.category, command.about, ...command.aliases]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });

    deck.innerHTML = rows.map(card).join('');
    if (meta) meta.textContent = `${rows.length} of ${window.COMMANDS.length} shown`;
    if (empty) empty.classList.toggle('show', rows.length === 0);
    if (emptyTerm) emptyTerm.textContent = query.trim() || 'that';
  };

  search?.addEventListener('input', () => { query = search.value; render(); });

  picker?.addEventListener('change', () => { category = picker.value; render(); });

  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== search) {
      event.preventDefault();
      search?.focus();
    }

    if (event.key === 'Escape' && document.activeElement === search) {
      search.value = '';
      query = '';
      render();
      search.blur();
    }
  });

  document.querySelector('#clear')?.addEventListener('click', () => {
    if (search) search.value = '';
    query = '';
    render();
  });

  render();
}
