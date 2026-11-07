/* shared behaviour: dock shadow, copy buttons, the reply ticker, command search, parallax. */

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

/* the 3d furniture leans with the pointer */
const scene = document.querySelector('.scene');

if (scene && !reduce) {
  let queued = false;

  window.addEventListener('pointermove', (event) => {
    if (queued) return;

    queued = true;

    requestAnimationFrame(() => {
      queued = false;
      scene.style.setProperty('--mx', ((event.clientX / window.innerWidth) - 0.5).toFixed(3));
      scene.style.setProperty('--my', ((event.clientY / window.innerHeight) - 0.5).toFixed(3));
    });
  }, { passive: true });
}

/* the hero card types real replies from the bot */
const ticker = document.querySelector('.ticker-line');

if (ticker) {
  const replies = [
    '@you: deposited 🟡 500 into your bank.',
    '@you: you only have 🟡 3 on you.',
    '@you: withdrew 🟡 1.9K from your bank.',
    '@you: your bank is empty.',
  ];

  const caret = document.createElement('span');
  caret.className = 'caret';

  /* the text node has to come first — the caret is decoration after it. */
  const line = document.createTextNode('');
  ticker.textContent = '';
  ticker.append(line, caret);

  let index = 0;

  const write = (text, position = 0) => {
    line.nodeValue = text.slice(0, position);

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
      line.nodeValue = text.slice(0, Math.max(0, position));

      if (position > 0) {
        setTimeout(step, 14);
        return;
      }

      index = (index + 1) % replies.length;
      setTimeout(() => write(replies[index]), 260);
    };

    step();
  };

  if (reduce) {
    line.nodeValue = replies[0];
  } else {
    setTimeout(() => write(replies[0]), 500);
  }
}

/* commands page */
const deck = document.querySelector('.deck');

if (deck && Array.isArray(window.COMMANDS)) {
  const search = document.querySelector('#search');
  const button = document.querySelector('#picker-btn');
  const menu = document.querySelector('#picker-menu');
  const pickerLabel = document.querySelector('#picker-label');
  const pickerTotal = document.querySelector('#picker-total');
  const options = [...(menu?.querySelectorAll('li') ?? [])];
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

  /* the picker: our own menu, because a native select opens a white os popup */
  let cursor = 0;

  const paint = () => {
    options.forEach((option, position) => {
      option.classList.toggle('cursor', position === cursor);
    });
  };

  const choose = (value) => {
    category = value;

    const picked = options.find((option) => option.dataset.value === value);
    if (picked && pickerLabel) pickerLabel.textContent = picked.dataset.label;
    if (picked && pickerTotal) pickerTotal.textContent = picked.dataset.count;

    options.forEach((option) => option.setAttribute('aria-selected', String(option.dataset.value === value)));
    render();
  };

  const open = () => {
    if (!menu) return;

    cursor = Math.max(0, options.findIndex((option) => option.dataset.value === category));
    menu.hidden = false;
    button?.setAttribute('aria-expanded', 'true');
    paint();
    options[cursor]?.focus?.();
  };

  const close = () => {
    if (!menu) return;

    menu.hidden = true;
    button?.setAttribute('aria-expanded', 'false');
    options.forEach((option) => option.classList.remove('cursor'));
  };

  button?.addEventListener('click', () => (menu?.hidden ? open() : close()));

  options.forEach((option, position) => {
    option.tabIndex = -1;

    option.addEventListener('click', () => {
      choose(option.dataset.value);
      close();
      button?.focus();
    });

    option.addEventListener('pointerenter', () => {
      cursor = position;
      paint();
    });
  });

  button?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  });

  menu?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      close();
      button?.focus();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      cursor = Math.max(0, Math.min(options.length - 1, cursor + (event.key === 'ArrowDown' ? 1 : -1)));
      paint();
      options[cursor]?.focus();
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(options[cursor].dataset.value);
      close();
      button?.focus();
    }
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.picker')) close();
  });

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

  search?.addEventListener('input', () => { query = search.value; render(); });

  document.querySelector('#clear')?.addEventListener('click', () => {
    if (search) search.value = '';
    query = '';
    render();
  });

  choose('all');
}
